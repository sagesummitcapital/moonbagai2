-- THE WOODS MACHINE (Stavros, 2026-10-16: "I love the woods map. I want you to really hone that in and make it a machine.
-- accuracy and r:r ... make sure i always know the time of this data, if i use bad data its a bad trade ... always have
-- limits with confidence score that way i can throw them in if i agree").
-- Every 15 minutes (pg_cron, right after the BloFin candle feed) for BTC/ETH/SOL:
--   * the four-part Woods checklist on the last closed 4H bars (sweep, SFP, 4H RSI divergence, 1H trigger),
--   * the BTC anchor (line in the sand from woods_levels),
--   * one resting limit per coin and side at the nearest liquidity pool / zone edge outside no-man's land,
--     with stop, TP1 (first pop >= 1R, 70%), TP2 (>= 3R), R:R and a transparent 0-100 confidence score,
--   * every A/A+ limit is paper-tracked in limit_orders (setup 'woods_limit') so the weekly scorecard grades it.
-- Analysis only. Stavros places every order.

create table if not exists public.woods_machine (
  coin text not null,
  side text not null check (side in ('long','short')),
  as_of timestamptz not null default now(),       -- when the machine ran
  data_as_of timestamptz,                          -- close time of the newest 1H bar used
  price numeric,                                   -- last 15m close
  anchor jsonb,                                    -- BTC vs the line in the sand
  checklist jsonb,                                 -- {a,b,c,d, pool, wick, rsi, notes}
  trigger boolean not null default false,          -- all four legs on closed bars
  limit_plan jsonb,                                -- {entry, stop, tp1, tp2, rr1, rr2, pool, pool_kind, stop_pct}
  confidence integer,
  grade text,
  components jsonb,
  blocked text,                                    -- why no limit (no-man's land, anchor, R:R < 1 ...)
  primary key (coin, side)
);
alter table public.woods_machine enable row level security;

create table if not exists public.woods_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  coin text not null, side text not null, kind text not null,   -- 'trigger' | 'sweep' (a+b) | 'limit_placed'
  bar_ts timestamptz, detail jsonb,
  notified_at timestamptz,
  unique (coin, side, kind, bar_ts)
);
alter table public.woods_events enable row level security;

create or replace function public.woods_scan(p_save boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare
  v_coin text; v_side text; sg integer;
  c4 numeric[]; hi4 numeric[]; lo4 numeric[]; ts4 timestamptz[]; n4 integer;
  rsi numeric[]; up numeric; dn numeric; d numeric; i integer; j integer;
  atr1 numeric; px numeric; data_ts timestamptz; ema50 numeric;
  btc_px numeric; line_lo numeric; line_hi numeric; anchor_state text; anchor jsonb;
  pools jsonb; p jsonb; best jsonb; tgt jsonb;
  pdh numeric; pdl numeric; pwh numeric; pwl numeric; sw_hi numeric; sw_lo numeric;
  a_ok boolean; b_ok boolean; c_ok boolean; d_ok boolean; sweep_i integer; sweep_lvl numeric; sweep_kind text; wick numeric;
  prior_ext numeric; prior_i integer; rsi_note text; d_ts timestamptz;
  v_entry numeric; v_stop numeric; v_tp1 numeric; v_tp2 numeric; rr1 numeric; rr2 numeric; minpct numeric; risk numeric;
  e numeric; s numeric; t1 numeric; t2 numeric; q1 numeric; q2 numeric; rk numeric; why text;
  conf integer; comp jsonb; grade text; blocked text; rec_n integer; rec_avg numeric; lvl_pts integer; v_id text;
  out jsonb := '[]'::jsonb; mid numeric; edge numeric;
begin
  select low, high into line_lo, line_hi from woods_levels where coin = 'BTC' and kind = 'line_in_sand' and active order by updated_at desc limit 1;
  select c into btc_px from candles where asset = 'BTC' and tf = '15m' order by ts desc limit 1;
  anchor_state := case when line_lo is null then 'no line' when btc_px < line_lo then 'below' when btc_px > line_hi then 'above' else 'inside' end;
  anchor := jsonb_build_object('btc', btc_px, 'line_low', line_lo, 'line_high', line_hi, 'state', anchor_state,
    'text', case anchor_state when 'below' then format('BTC %s is below the line %s–%s — chop; no alt longs', round(btc_px), round(line_lo), round(line_hi))
                              when 'above' then format('BTC %s is above the line %s–%s — bullish only after a 4H close holds above %s', round(btc_px), round(line_lo), round(line_hi), round(line_hi))
                              when 'inside' then format('BTC %s is inside the line %s–%s — no-man''s land, wait', round(btc_px), round(line_lo), round(line_hi))
                              else 'no Woods line set' end);
  select count(*) filter (where outcome_r is not null), avg(outcome_r) into rec_n, rec_avg from limit_orders where setup_id = 'woods_limit' and origin = 'paper';

  foreach v_coin in array array['BTC','ETH','SOL'] loop
    select array_agg(c order by ts), array_agg(h order by ts), array_agg(l order by ts), array_agg(ts order by ts)
      into c4, hi4, lo4, ts4 from (select ts, c, h, l from candles where asset = v_coin and tf = '4h' order by ts desc limit 120) z;
    n4 := coalesce(array_length(c4, 1), 0);
    select ts + interval '1 hour' into data_ts from candles where asset = v_coin and tf = '1h' order by ts desc limit 1;
    select c into px from candles where asset = v_coin and tf = '15m' order by ts desc limit 1;
    if n4 < 40 or px is null then out := out || jsonb_build_object('coin', v_coin, 'skip', 'not enough data'); continue; end if;
    rsi := array_fill(null::numeric, array[n4]); up := 0; dn := 0;
    for i in 2..15 loop d := c4[i] - c4[i-1]; up := up + greatest(d, 0); dn := dn + greatest(-d, 0); end loop;
    up := up / 14; dn := dn / 14; rsi[15] := case when dn = 0 then 100 else 100 - 100 / (1 + up / dn) end;
    for i in 16..n4 loop d := c4[i] - c4[i-1]; up := (up * 13 + greatest(d, 0)) / 14; dn := (dn * 13 + greatest(-d, 0)) / 14; rsi[i] := case when dn = 0 then 100 else 100 - 100 / (1 + up / dn) end; end loop;
    ema50 := c4[1]; for i in 2..n4 loop ema50 := ema50 + (2.0 / 51) * (c4[i] - ema50); end loop;
    select avg(tr) into atr1 from (select greatest(h - l, abs(h - lag(c) over (order by ts)), abs(l - lag(c) over (order by ts))) tr, ts
      from (select * from candles where asset = v_coin and tf = '1h' order by ts desc limit 15) q) z where tr is not null;
    select max(h), min(l) into pdh, pdl from candles where asset = v_coin and tf = '1h' and ts >= (date_trunc('day', now() at time zone 'utc') - interval '1 day') at time zone 'utc' and ts < date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    select max(h), min(l) into pwh, pwl from candles where asset = v_coin and tf = '4h' and ts >= (date_trunc('week', now() at time zone 'utc') - interval '7 days') at time zone 'utc' and ts < date_trunc('week', now() at time zone 'utc') at time zone 'utc';
    sw_hi := null; sw_lo := null;
    for i in reverse (n4 - 4)..4 loop
      if sw_lo is null and lo4[i] = (select min(x) from unnest(lo4[i-3:i+3]) x) then sw_lo := lo4[i]; end if;
      if sw_hi is null and hi4[i] = (select max(x) from unnest(hi4[i-3:i+3]) x) then sw_hi := hi4[i]; end if;
      exit when sw_lo is not null and sw_hi is not null;
    end loop;
    -- pools: Woods' own levels first (they override), the open planner's map, then computed liquidity
    pools := '[]'::jsonb;
    for p in select jsonb_build_object('kind', kind, 'src', 'woods', 'low', low, 'high', high, 'note', note, 'pol', case when kind = 'demand' then 'low' when kind = 'supply' then 'high' when high < px then 'low' else 'high' end) from woods_levels where coin = v_coin and active and kind in ('demand','supply','liquidity') loop pools := pools || p; end loop;
    for p in select z from lev_open_plan op, jsonb_array_elements(coalesce(op.woods->'zones', '[]'::jsonb)) z
              where op.plan_date = (select max(plan_date) from lev_open_plan) and z->>'coin' = v_coin and op.plan_date >= current_date - 3 loop
      pools := pools || jsonb_build_object('kind', p->>'kind', 'src', 'plan', 'low', (p->>'low')::numeric, 'high', (p->>'high')::numeric, 'note', p->>'note', 'pol', case when p->>'kind' = 'demand' then 'low' when p->>'kind' = 'supply' then 'high' when (p->>'high')::numeric < px then 'low' else 'high' end);
    end loop;
    pools := pools || jsonb_build_array(
      jsonb_build_object('kind','liquidity','src','PDH','low',pdh,'high',pdh,'note','previous day high','pol','high'),
      jsonb_build_object('kind','liquidity','src','PDL','low',pdl,'high',pdl,'note','previous day low','pol','low'),
      jsonb_build_object('kind','liquidity','src','PWH','low',pwh,'high',pwh,'note','previous week high','pol','high'),
      jsonb_build_object('kind','liquidity','src','PWL','low',pwl,'high',pwl,'note','previous week low','pol','low'),
      jsonb_build_object('kind','liquidity','src','4H swing','low',sw_hi,'high',sw_hi,'note','last 4H swing high','pol','high'),
      jsonb_build_object('kind','liquidity','src','4H swing','low',sw_lo,'high',sw_lo,'note','last 4H swing low','pol','low'));
    mid := (select (max(h) + min(l)) / 2 from candles where asset = v_coin and tf = '4h' and ts > now() - interval '7 days');
    minpct := case when v_coin in ('BTC','ETH') then 0.008 else 0.015 end;

    foreach v_side in array array['long','short'] loop
      sg := case when v_side = 'long' then 1 else -1 end;
      -- ---------- (a)(b) sweep + close back, on the last 3 closed 4H bars: lows of demand/liquidity (long), highs of supply/liquidity (short)
      a_ok := false; b_ok := false; c_ok := false; d_ok := false; sweep_i := null; sweep_lvl := null; sweep_kind := null; wick := null; rsi_note := null; d_ts := null;
      for i in reverse n4..greatest(n4 - 2, 2) loop
        for p in select x from jsonb_array_elements(pools) x
                  where (x->>'low') is not null and x->>'pol' = (case when sg = 1 then 'low' else 'high' end) loop
          edge := case when sg = 1 then (p->>'low')::numeric else (p->>'high')::numeric end;
          if (sg = 1 and lo4[i] < edge and c4[i] > edge) or (sg = -1 and hi4[i] > edge and c4[i] < edge) then
            a_ok := true; b_ok := true; sweep_i := i; sweep_lvl := edge; sweep_kind := p->>'src' || ' · ' || coalesce(p->>'note', p->>'kind'); wick := case when sg = 1 then lo4[i] else hi4[i] end;
            exit;
          elsif (sg = 1 and lo4[i] < edge and lo4[i] > edge * 0.97) or (sg = -1 and hi4[i] > edge and hi4[i] < edge * 1.03) then
            a_ok := true;
          end if;
        end loop;
        exit when sweep_i is not null;
      end loop;
      -- ---------- (c) 4H RSI divergence from oversold / overbought
      if sweep_i is not null and sweep_i > 33 then
        prior_i := null;
        for j in (sweep_i - 30)..(sweep_i - 3) loop
          if prior_i is null or (sg = 1 and lo4[j] < lo4[prior_i]) or (sg = -1 and hi4[j] > hi4[prior_i]) then prior_i := j; end if;
        end loop;
        prior_ext := case when sg = 1 then lo4[prior_i] else hi4[prior_i] end;
        c_ok := ((sg = 1 and lo4[sweep_i] <= prior_ext * 1.003 and rsi[sweep_i] > rsi[prior_i] and least(rsi[sweep_i], rsi[prior_i]) < 35)
              or (sg = -1 and hi4[sweep_i] >= prior_ext * 0.997 and rsi[sweep_i] < rsi[prior_i] and greatest(rsi[sweep_i], rsi[prior_i]) > 65));
        rsi_note := format('4H RSI %s at the sweep vs %s at the prior %s %s', round(rsi[sweep_i]), round(rsi[prior_i]), case when sg = 1 then 'low' else 'high' end, round(prior_ext, 2));
      end if;
      -- ---------- (d) 1H trigger within 12h after the sweep bar closed, wick never taken out
      if sweep_i is not null then
        select min(q.ts) into d_ts from (
          select ts, c, max(h) over w3 as ph, min(l) over w3 as pl
            from candles where asset = v_coin and tf = '1h' and ts >= ts4[sweep_i] + interval '1 hour' and ts < ts4[sweep_i] + interval '16 hours'
          window w3 as (order by ts rows between 3 preceding and 1 preceding)) q
         where q.ts >= ts4[sweep_i] + interval '4 hours' and ((sg = 1 and q.c > q.ph) or (sg = -1 and q.c < q.pl))
           and not exists (select 1 from candles x where x.asset = v_coin and x.tf = '1h' and x.ts >= ts4[sweep_i] + interval '4 hours' and x.ts <= q.ts and ((sg = 1 and x.l < wick) or (sg = -1 and x.h > wick)));
        d_ok := d_ts is not null;
      end if;

      -- ---------- the resting limit: nearest edge beyond price that is OUT of no-man's land and gives a first pop >= 1R
      best := null; blocked := null; v_entry := null; v_stop := null; v_tp1 := null; v_tp2 := null; rr1 := null; rr2 := null;
      for p in select x from jsonb_array_elements(pools) x
                where (x->>'low') is not null and x->>'pol' = (case when sg = 1 then 'low' else 'high' end)
                  and ((sg = 1 and (x->>'low')::numeric < px - 0.5 * atr1) or (sg = -1 and (x->>'high')::numeric > px + 0.5 * atr1))
                order by abs(case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end - px) loop
        edge := case when sg = 1 then (p->>'low')::numeric else (p->>'high')::numeric end;
        e := edge - sg * 0.25 * atr1;                     -- fills only if the pool is swept
        rk := greatest(1.0 * atr1, minpct * e);           -- stop past the sweep: >= 1 x ATR1h and the house minimum
        s := e - sg * rk;
        -- TP1 = the first opposing level >= 1R (the first pop, 70%); TP2 = the next level >= max(3R, TP1 + 1R)
        select min(sg * ((case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end) - e)) into q1 from jsonb_array_elements(pools) x
          where (x->>'low') is not null and sg * ((case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end) - e) >= rk;
        t1 := case when q1 is null then e + sg * 2 * rk else e + sg * (q1 - 0.1 * atr1) end;
        select min(sg * ((case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end) - e)) into q2 from jsonb_array_elements(pools) x
          where (x->>'low') is not null and sg * ((case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end) - e) >= greatest(3 * rk, sg * (t1 - e) + rk);
        t2 := case when q2 is null then e + sg * greatest(3 * rk, sg * (t1 - e) + rk) else e + sg * (q2 - 0.1 * atr1) end;
        why := null;
        if sg * (t1 - e) / rk < 1 then why := format('first pop only %sR (under 1R)', round(sg * (t1 - e) / rk, 2)); end if;
        if abs(e - mid) < 2 * atr1 then why := coalesce(why || '; ', '') || 'no-man''s land (middle of the 7-day range)'; end if;
        if best is null or why is null then
          best := p; v_entry := e; v_stop := s; v_tp1 := t1; v_tp2 := t2; risk := rk; blocked := why;
          rr1 := round(sg * (t1 - e) / rk, 2); rr2 := round(sg * (t2 - e) / rk, 2);
        end if;
        exit when why is null;
      end loop;
      if best is null then blocked := 'no pool beyond price within the map'; end if;
      if v_side = 'long' and v_coin <> 'BTC' and anchor_state in ('below','inside') then blocked := coalesce(blocked || '; ', '') || 'BTC anchor: no alt longs below the line'; end if;

      -- ---------- confidence 0-100 (transparent components)
      lvl_pts := case when best is null then 0 when best->>'src' = 'woods' then 25 when best->>'src' in ('PWL','PWH') then 20 when best->>'src' = 'plan' then 18 when best->>'src' in ('PDL','PDH') then 15 else 12 end;
      comp := jsonb_build_object(
        'level', lvl_pts,
        'anchor', case when v_coin = 'BTC' and v_side = 'long' then (case anchor_state when 'above' then 20 when 'inside' then 8 else 12 end)
                       when v_coin = 'BTC' and v_side = 'short' then (case anchor_state when 'below' then 20 when 'inside' then 8 else 6 end)
                       when v_side = 'long' then (case anchor_state when 'above' then 20 else 0 end)
                       else (case anchor_state when 'below' then 20 when 'inside' then 10 else 4 end) end,
        'rr', case when rr1 is null then 0 when rr1 >= 3 then 20 when rr1 >= 2 then 15 when rr1 >= 1.5 then 10 when rr1 >= 1 then 5 else 0 end,
        'rsi', case when sg = 1 then (case when rsi[n4] <= 40 then 15 when rsi[n4] <= 50 then 8 else 0 end) else (case when rsi[n4] >= 60 then 15 when rsi[n4] >= 50 then 8 else 0 end) end,
        'trend', case when (sg = 1 and px > ema50) or (sg = -1 and px < ema50) then 10 else 4 end,
        'record', case when coalesce(rec_n, 0) < 3 then 5 when rec_avg > 0 then 10 else 0 end);
      conf := (select sum(value::int) from jsonb_each_text(comp));
      grade := case when conf >= 75 then 'A+' when conf >= 60 then 'A' when conf >= 45 then 'B' else 'C' end;
      if coalesce(rec_n, 0) >= 3 and rec_avg <= 0 then blocked := coalesce(blocked || '; ', '') || 'woods_limit paper record ≤ 0R — muted'; end if;

      if p_save then
        insert into woods_machine (coin, side, as_of, data_as_of, price, anchor, checklist, trigger, limit_plan, confidence, grade, components, blocked)
        values (v_coin, v_side, now(), data_ts, px, anchor,
          jsonb_build_object('a', a_ok, 'b', b_ok, 'c', case when sweep_i is null then null else c_ok end, 'd', case when sweep_i is null then null else d_ok end,
            'pool', sweep_kind, 'level', sweep_lvl, 'wick', wick, 'bar', case when sweep_i is null then null else ts4[sweep_i] end, 'rsi_now', round(rsi[n4], 1), 'rsi_note', rsi_note, 'trigger_at', d_ts),
          coalesce(a_ok and b_ok and c_ok and d_ok, false),
          case when best is null then null else jsonb_build_object('entry', mb_px(v_entry), 'stop', mb_px(v_stop), 'tp1', mb_px(v_tp1), 'tp2', mb_px(v_tp2), 'rr1', rr1, 'rr2', rr2,
            'stop_pct', round(100 * abs(v_entry - v_stop) / v_entry, 2), 'pool', best->>'src', 'pool_note', best->>'note', 'atr1h', round(atr1, 4)) end,
          conf, grade, comp, blocked)
        on conflict (coin, side) do update set as_of = excluded.as_of, data_as_of = excluded.data_as_of, price = excluded.price, anchor = excluded.anchor, checklist = excluded.checklist,
          trigger = excluded.trigger, limit_plan = excluded.limit_plan, confidence = excluded.confidence, grade = excluded.grade, components = excluded.components, blocked = excluded.blocked;
        if coalesce(a_ok and b_ok and c_ok and d_ok, false) then
          insert into woods_events (coin, side, kind, bar_ts, detail) values (v_coin, v_side, 'trigger', ts4[sweep_i],
            jsonb_build_object('pool', sweep_kind, 'level', sweep_lvl, 'wick', wick, 'trigger_at', d_ts, 'rsi', rsi_note)) on conflict do nothing;
        elsif b_ok then
          insert into woods_events (coin, side, kind, bar_ts, detail) values (v_coin, v_side, 'sweep', ts4[sweep_i],
            jsonb_build_object('pool', sweep_kind, 'level', sweep_lvl, 'wick', wick, 'c', c_ok, 'd', d_ok)) on conflict do nothing;
        end if;
        -- paper-track A / A+ limits (one working woods limit per coin and side) so the Saturday scorecard grades them
        if blocked is null and grade in ('A+','A') and v_entry is not null
           and not exists (select 1 from limit_orders where setup_id = 'woods_limit' and symbol = v_coin and direction = v_side and status in ('working','touched','filled')) then
          insert into limit_orders (venue, symbol, direction, origin, limit_price, stop, current_stop, tp1, tp2, plan_r, level, level_kind, grade, setup_id, status, expires_at, reasoning, source)
          values ('blofin', v_coin, v_side, 'paper', mb_px(v_entry), mb_px(v_stop), mb_px(v_stop), mb_px(v_tp1), mb_px(v_tp2), rr1,
                  mb_px(case when sg = 1 then (best->>'low')::numeric else (best->>'high')::numeric end), 'woods_' || lower(replace(best->>'src', ' ', '_')), grade, 'woods_limit', 'working', now() + interval '24 hours',
                  format('WOODS %s %s limit %s at %s (%s) · stop %s · TP1 %s (%sR, 70%%) · TP2 %s (%sR) · confidence %s', v_coin, v_side, mb_px(v_entry), best->>'src', best->>'note', mb_px(v_stop), mb_px(v_tp1), rr1, mb_px(v_tp2), rr2, conf),
                  'claude')
          returning limit_id into v_id;
          insert into woods_events (coin, side, kind, bar_ts, detail) values (v_coin, v_side, 'limit_placed', date_trunc('hour', now()), jsonb_build_object('limit_id', v_id, 'entry', mb_px(v_entry), 'confidence', conf)) on conflict do nothing;
        end if;
      end if;
      out := out || jsonb_build_object('coin', v_coin, 'side', v_side, 'checklist', jsonb_build_array(a_ok, b_ok, c_ok, d_ok), 'pool', sweep_kind,
        'limit', case when v_entry is null then null else jsonb_build_object('entry', mb_px(v_entry), 'stop', mb_px(v_stop), 'tp1', mb_px(v_tp1), 'rr1', rr1, 'tp2', mb_px(v_tp2), 'rr2', rr2, 'via', best->>'src') end,
        'confidence', conf, 'grade', grade, 'blocked', blocked);
    end loop;
  end loop;
  return jsonb_build_object('at', now(), 'anchor', anchor, 'rows', out);
end $f$;

-- every 15 minutes, right after the 5-minute BloFin candle feed: resolve paper limits, refresh the board, run the machine
select cron.schedule('moonbag-woods-scan', '2,17,32,47 * * * *', $$select public.lev_limit_resolve(); select public.lev_board_refresh(); select public.woods_scan(true);$$);
