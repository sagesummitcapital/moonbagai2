-- 2026-10-17 · Mentor X adopt + weekly bias + deposit fix (already live; this file records it).
-- Stavros: "meshing the minds to create a super trader ... put my thoughts in for macro / weekly on mondays".
-- Function bodies are pg_get_functiondef() snapshots, md5-checked against the live database.

create table if not exists public.weekly_bias (
  week_start date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  draft jsonb,
  bias text check (bias in ('long','short','neutral','range')),
  conviction integer check (conviction between 1 and 5),
  thoughts text,
  levels jsonb,
  confirmed_at timestamptz,
  confirmed_by text,
  result jsonb,
  graded_at timestamptz
);
alter table public.weekly_bias enable row level security;

create or replace view public.v_weekly_bias as
 SELECT week_start,
    COALESCE(bias, (draft ->> 'bias'::text)) AS bias,
    (bias IS NOT NULL) AS confirmed,
    conviction,
    thoughts,
    levels,
    draft,
    confirmed_at
   FROM weekly_bias
  ORDER BY week_start DESC
 LIMIT 1;

-- The $997.93 deposit (flow 1) was dated 0.4s after the snapshot that already included it.
update public.account_flows set flow_at = '2026-10-17 00:07:00+00' where flow_id = 1;

-- lev_candle_backfill
CREATE OR REPLACE FUNCTION public.lev_candle_backfill(p_asset text, p_tf text DEFAULT '4h'::text, p_pages integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_bar text := case p_tf when '15m' then '15m' when '1h' then '1H' else '4H' end; resp record; body jsonb; r jsonb; n integer := 0; v_oldest bigint; i integer;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  for i in 1..p_pages loop
    select (extract(epoch from min(ts)) * 1000)::bigint into v_oldest from candles where asset = p_asset and tf = p_tf;
    select * into resp from extensions.http_get(format('https://openapi.blofin.com/api/v1/market/candles?instId=%s-USDT&bar=%s&limit=100&after=%s', p_asset, v_bar, v_oldest));
    body := resp.content::jsonb;
    exit when resp.status <> 200 or body->>'code' <> '0' or jsonb_array_length(body->'data') = 0;
    for r in select * from jsonb_array_elements(body->'data') loop
      continue when r->>8 <> '1';
      insert into candles (asset, tf, ts, o, h, l, c, v)
      values (p_asset, p_tf, to_timestamp((r->>0)::bigint / 1000.0), (r->>1)::numeric, (r->>2)::numeric, (r->>3)::numeric, (r->>4)::numeric, (r->>6)::numeric)
      on conflict (asset, tf, ts) do nothing;
      n := n + 1;
    end loop;
  end loop;
  return jsonb_build_object('asset', p_asset, 'tf', p_tf, 'rows', n, 'total', (select count(*) from candles where asset = p_asset and tf = p_tf));
end $function$;

-- lev_candle_sync
CREATE OR REPLACE FUNCTION public.lev_candle_sync(p_assets text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_a text; v_tf text; v_bar text; resp record; body jsonb; r jsonb; n integer; total integer := 0; v_last timestamptz; errs jsonb := '[]'::jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  for v_a in select x from unnest(coalesce(p_assets,
      (select array_agg(distinct u.asset) from (select lu.asset from public.lev_universe lu union select unnest(array['BTC','ETH','SOL'])) u))) x
  loop
    foreach v_tf in array array['15m','1h','4h'] loop
      v_bar := case v_tf when '15m' then '15m' when '1h' then '1H' else '4H' end;
      begin
        select * into resp from extensions.http_get(format('https://openapi.blofin.com/api/v1/market/candles?instId=%s-USDT&bar=%s&limit=%s', v_a, v_bar, case v_tf when '4h' then 300 else 100 end));
        if resp.status <> 200 then raise exception 'http %', resp.status; end if;
        body := resp.content::jsonb;
        if body->>'code' <> '0' then raise exception 'blofin %', body->>'msg'; end if;
        n := 0; v_last := null;
        for r in select * from jsonb_array_elements(body->'data') loop
          continue when r->>8 <> '1';
          insert into public.candles as cd (asset, tf, ts, o, h, l, c, v)
          values (v_a, v_tf, to_timestamp((r->>0)::bigint / 1000.0), (r->>1)::numeric, (r->>2)::numeric, (r->>3)::numeric, (r->>4)::numeric, (r->>6)::numeric)
          on conflict (asset, tf, ts) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c, v = excluded.v;
          n := n + 1;
          v_last := greatest(v_last, to_timestamp((r->>0)::bigint / 1000.0));
        end loop;
        total := total + n;
        insert into public.data_feed as df (feed, asset, tf, last_bar, fetched_at, ok, error) values ('blofin', v_a, v_tf, v_last, now(), true, null)
        on conflict (feed, asset, tf) do update set last_bar = excluded.last_bar, fetched_at = excluded.fetched_at, ok = true, error = null;
      exception when others then
        errs := errs || jsonb_build_object('asset', v_a, 'tf', v_tf, 'error', sqlerrm);
        insert into public.data_feed as df (feed, asset, tf, fetched_at, ok, error) values ('blofin', v_a, v_tf, now(), false, sqlerrm)
        on conflict (feed, asset, tf) do update set fetched_at = excluded.fetched_at, ok = false, error = excluded.error;
      end;
    end loop;
  end loop;
  return jsonb_build_object('bars', total, 'errors', errs, 'at', now());
end $function$;

-- moonbag_calc_equity
CREATE OR REPLACE FUNCTION public.moonbag_calc_equity(p_venue text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with s as (select equity, reported_at from account_snapshots where venue = p_venue order by reported_at desc limit 1),
  ex as (select coalesce(sum(e.pnl - coalesce(e.fee, 0)), 0) v from trade_exits e join trades t on t.trade_id = e.trade_id, s
          where t.venue = p_venue and e.voided_at is null and coalesce(e.exited_at, e.created_at) > s.reported_at),
  tr as (select coalesce(sum(t.realized_pnl - coalesce(t.fees, 0)), 0) v from trades t, s
          where t.venue = p_venue and t.status = 'closed' and t.closed_at > s.reported_at
            and not exists (select 1 from trade_exits e where e.trade_id = t.trade_id and e.voided_at is null)),
  fl as (select coalesce(sum(f.amount), 0) v from account_flows f, s where f.venue = p_venue and f.flow_at > s.reported_at + interval '2 minutes')
  select jsonb_build_object(
    'venue', p_venue,
    'confirmed', s.equity, 'confirmed_at', s.reported_at,
    'realized_since', round(ex.v + tr.v, 2), 'deposits_since', round(fl.v, 2),
    'equity', round(s.equity + ex.v + tr.v + fl.v, 2),
    'days_since_confirmed', round(extract(epoch from now() - s.reported_at) / 86400, 1),
    'needs_check', now() - s.reported_at > interval '7 days')
  from s, ex, tr, fl
$function$;

-- woods_scan
CREATE OR REPLACE FUNCTION public.woods_scan(p_save boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  wb record; ema200 numeric; v_mon timestamptz; mon_h numeric; mon_l numeric; wo numeric; mo numeric; pmh numeric; pml numeric; yo numeric;
  ph_i integer; pl_i integer; leg_up boolean; f_lo numeric; f_hi numeric; near_fib boolean; near_ema boolean; mz_state text; mz_text text; b_lo numeric; b_hi numeric; t_lo numeric; t_hi numeric; m_lo numeric; m_hi numeric; pos numeric;
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
  -- ELIZ MACRO LAYER (Stavros 2026-10-16: "i really like eliz on macro and woods on micro"): BTC vs her weekly zones
  select low, high into b_lo, b_hi from woods_levels where coin = 'BTC' and source = 'eliz' and active and kind = 'demand' order by low limit 1;
  select low, high into t_lo, t_hi from woods_levels where coin = 'BTC' and source = 'eliz' and active and kind = 'supply' order by low limit 1;
  select low, high into m_lo, m_hi from woods_levels where coin = 'BTC' and source = 'eliz' and active and kind = 'supply' order by low desc limit 1;
  if b_lo is null or t_lo is null then mz_state := 'none'; mz_text := 'No Eliz weekly map on file.';
  else
    pos := (btc_px - b_hi) / nullif(t_lo - b_hi, 0);
    mz_state := case when btc_px < b_lo then 'invalidated' when btc_px <= b_hi then 'buy_zone'
                     when btc_px < t_lo then (case when pos < 0.33 then 'lower' when pos < 0.67 then 'mid' else 'upper' end)
                     when btc_px <= t_hi then 'range_top'
                     when m_lo is not null and m_lo > t_hi and btc_px < m_lo then 'above_range'
                     when m_lo is not null and btc_px <= m_hi then 'macro_resistance' else 'expansion' end;
    mz_text := case mz_state
      when 'invalidated' then format('Eliz: BTC %s broke below her lower weekly structure (%s) — her plan is invalidated; re-evaluate, no macro longs.', round(btc_px), round(b_lo))
      when 'buy_zone' then format('Eliz: BTC %s is in her %s–%s buy zone — longs only with confirmation (reaction, recovery, trigger).', round(btc_px), round(b_lo), round(b_hi))
      when 'lower' then format('Eliz: BTC %s is in the lower part of her %s–%s weekly range — dips toward support are opportunities; wait for a trigger.', round(btc_px), round(b_hi), round(t_lo))
      when 'mid' then format('Eliz: BTC %s is mid-range of her %s–%s weekly range — expect liquidity grabs both ways; don''t chase, buy dips near support.', round(btc_px), round(b_hi), round(t_lo))
      when 'upper' then format('Eliz: BTC %s is near the top of her %s–%s weekly range — don''t chase longs here; the range top must be reclaimed on a weekly close.', round(btc_px), round(b_hi), round(t_lo))
      when 'range_top' then format('Eliz: BTC %s is testing her %s–%s range top — a convincing WEEKLY close above shifts the structure; until then it is resistance.', round(btc_px), round(t_lo), round(t_hi))
      when 'above_range' then format('Eliz: BTC %s is above her range top %s — structure shift only once a weekly close holds; next is her %s–%s macro resistance.', round(btc_px), round(t_hi), round(m_lo), round(m_hi))
      when 'macro_resistance' then format('Eliz: BTC %s is in her %s–%s macro decision zone — the first test can reject hard; only acceptance above opens expansion.', round(btc_px), round(m_lo), round(m_hi))
      else format('Eliz: BTC %s is above her macro resistance %s — expansion phase if it consolidates there.', round(btc_px), round(m_hi)) end;
  end if;
  -- STAVROS'S WEEKLY BIAS (his Monday call; Moonbag's draft until he confirms)
  select * into wb from v_weekly_bias where week_start >= current_date - 7;
  anchor := anchor || jsonb_build_object('bias', case when wb.week_start is null then null else jsonb_build_object('bias', wb.bias, 'confirmed', wb.confirmed, 'conviction', wb.conviction, 'week', wb.week_start, 'thoughts', left(wb.thoughts, 200)) end);
  anchor := anchor || jsonb_build_object('macro', jsonb_build_object('state', mz_state, 'text', mz_text, 'buy_zone', jsonb_build_array(b_lo, b_hi), 'range_top', jsonb_build_array(t_lo, t_hi), 'macro_resistance', jsonb_build_array(m_lo, m_hi)));

  foreach v_coin in array array['BTC','ETH','SOL'] loop
    select array_agg(c order by ts), array_agg(h order by ts), array_agg(l order by ts), array_agg(ts order by ts)
      into c4, hi4, lo4, ts4 from (select ts, c, h, l from candles where asset = v_coin and tf = '4h' order by ts desc limit 400) z;
    n4 := coalesce(array_length(c4, 1), 0);
    select ts + interval '1 hour' into data_ts from candles where asset = v_coin and tf = '1h' order by ts desc limit 1;
    select c into px from candles where asset = v_coin and tf = '15m' order by ts desc limit 1;
    if n4 < 40 or px is null then out := out || jsonb_build_object('coin', v_coin, 'skip', 'not enough data'); continue; end if;
    rsi := array_fill(null::numeric, array[n4]); up := 0; dn := 0;
    for i in 2..15 loop d := c4[i] - c4[i-1]; up := up + greatest(d, 0); dn := dn + greatest(-d, 0); end loop;
    up := up / 14; dn := dn / 14; rsi[15] := case when dn = 0 then 100 else 100 - 100 / (1 + up / dn) end;
    for i in 16..n4 loop d := c4[i] - c4[i-1]; up := (up * 13 + greatest(d, 0)) / 14; dn := (dn * 13 + greatest(-d, 0)) / 14; rsi[i] := case when dn = 0 then 100 else 100 - 100 / (1 + up / dn) end; end loop;
    ema50 := c4[1]; for i in 2..n4 loop ema50 := ema50 + (2.0 / 51) * (c4[i] - ema50); end loop;
    ema200 := case when n4 >= 220 then c4[1] end; if ema200 is not null then for i in 2..n4 loop ema200 := ema200 + (2.0 / 201) * (c4[i] - ema200); end loop; end if;
    -- TIME LEVELS (Stavros approved 2026-10-17, from Eliz + Woods): Monday range, weekly / monthly / yearly open, previous month high/low
    v_mon := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
    if now() < v_mon + interval '1 day' then v_mon := v_mon - interval '7 days'; end if;   -- the last COMPLETED Monday
    select max(h), min(l) into mon_h, mon_l from candles where asset = v_coin and tf = '4h' and ts >= v_mon and ts < v_mon + interval '1 day';
    select o into wo from candles where asset = v_coin and tf = '4h' and ts >= date_trunc('week', now() at time zone 'utc') at time zone 'utc' order by ts limit 1;
    select o into mo from candles where asset = v_coin and tf = '4h' and ts >= date_trunc('month', now() at time zone 'utc') at time zone 'utc' order by ts limit 1;
    select max(h), min(l) into pmh, pml from candles where asset = v_coin and tf = '4h' and ts >= (date_trunc('month', now() at time zone 'utc') - interval '1 month') at time zone 'utc' and ts < date_trunc('month', now() at time zone 'utc') at time zone 'utc';
    select o into yo from candles where asset = v_coin and tf = '1d' and ts >= date_trunc('year', now() at time zone 'utc') at time zone 'utc' order by ts limit 1;
    -- last impulse leg on the 4H (pivots 5/5) for the 0.75–0.786 zone
    ph_i := null; pl_i := null;
    for i in reverse (n4 - 6)..6 loop
      if ph_i is null and hi4[i] = (select max(x) from unnest(hi4[i-5:i+5]) x) then ph_i := i; end if;
      if pl_i is null and lo4[i] = (select min(x) from unnest(lo4[i-5:i+5]) x) then pl_i := i; end if;
      exit when ph_i is not null and pl_i is not null;
    end loop;
    leg_up := ph_i > pl_i;
    if ph_i is not null and pl_i is not null then
      f_lo := case when leg_up then hi4[ph_i] - 0.786 * (hi4[ph_i] - lo4[pl_i]) else lo4[pl_i] + 0.75 * (hi4[ph_i] - lo4[pl_i]) end;
      f_hi := case when leg_up then hi4[ph_i] - 0.75 * (hi4[ph_i] - lo4[pl_i]) else lo4[pl_i] + 0.786 * (hi4[ph_i] - lo4[pl_i]) end;
    else f_lo := null; f_hi := null; end if;
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
    pools := '[]'::jsonb;
    for p in select jsonb_build_object('kind', kind, 'src', case when source = 'eliz' then 'eliz' else 'woods' end, 'low', low, 'high', high, 'note', note, 'pol', case when kind = 'demand' then 'low' when kind = 'supply' then 'high' when high < px then 'low' else 'high' end) from woods_levels where coin = v_coin and active and kind in ('demand','supply','liquidity') loop pools := pools || p; end loop;
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
      jsonb_build_object('kind','liquidity','src','4H swing','low',sw_lo,'high',sw_lo,'note','last 4H swing low','pol','low'),
      jsonb_build_object('kind','liquidity','src','Monday high','low',mon_h,'high',mon_h,'note','Monday range high','pol','high'),
      jsonb_build_object('kind','liquidity','src','Monday low','low',mon_l,'high',mon_l,'note','Monday range low','pol','low'),
      jsonb_build_object('kind','liquidity','src','Weekly open','low',wo,'high',wo,'note','weekly open','pol',case when wo < px then 'low' else 'high' end),
      jsonb_build_object('kind','liquidity','src','Monthly open','low',mo,'high',mo,'note','monthly open (Eliz''s grey box)','pol',case when mo < px then 'low' else 'high' end),
      jsonb_build_object('kind','liquidity','src','Prev month high','low',pmh,'high',pmh,'note','previous month high','pol','high'),
      jsonb_build_object('kind','liquidity','src','Prev month low','low',pml,'high',pml,'note','previous month low','pol','low'),
      jsonb_build_object('kind','liquidity','src','Yearly open','low',yo,'high',yo,'note','yearly open (spot)','pol',case when yo < px then 'low' else 'high' end));
    mid := (select (max(h) + min(l)) / 2 from candles where asset = v_coin and tf = '4h' and ts > now() - interval '7 days');
    minpct := case when v_coin in ('BTC','ETH') then 0.008 else 0.015 end;

    foreach v_side in array array['long','short'] loop
      sg := case when v_side = 'long' then 1 else -1 end;
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
      if sweep_i is not null then
        select min(q.ts) into d_ts from (
          select ts, c, max(h) over w3 as ph, min(l) over w3 as pl
            from candles where asset = v_coin and tf = '1h' and ts >= ts4[sweep_i] + interval '1 hour' and ts < ts4[sweep_i] + interval '16 hours'
          window w3 as (order by ts rows between 3 preceding and 1 preceding)) q
         where q.ts >= ts4[sweep_i] + interval '4 hours' and ((sg = 1 and q.c > q.ph) or (sg = -1 and q.c < q.pl))
           and not exists (select 1 from candles x where x.asset = v_coin and x.tf = '1h' and x.ts >= ts4[sweep_i] + interval '4 hours' and x.ts <= q.ts and ((sg = 1 and x.l < wick) or (sg = -1 and x.h > wick)));
        d_ok := d_ts is not null;
      end if;

      best := null; blocked := null; v_entry := null; v_stop := null; v_tp1 := null; v_tp2 := null; rr1 := null; rr2 := null;
      for p in select x from jsonb_array_elements(pools) x
                where (x->>'low') is not null and x->>'pol' = (case when sg = 1 then 'low' else 'high' end)
                  and ((sg = 1 and (x->>'low')::numeric < px - 0.5 * atr1) or (sg = -1 and (x->>'high')::numeric > px + 0.5 * atr1))
                order by abs(case when sg = 1 then (x->>'low')::numeric else (x->>'high')::numeric end - px) loop
        edge := case when sg = 1 then (p->>'low')::numeric else (p->>'high')::numeric end;
        e := edge - sg * 0.25 * atr1;
        rk := greatest(1.0 * atr1, minpct * e);
        s := e - sg * rk;
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

      near_fib := v_entry is not null and f_lo is not null and ((sg = 1 and leg_up) or (sg = -1 and not leg_up)) and v_entry between f_lo - 0.5 * atr1 and f_hi + 0.5 * atr1;
      near_ema := v_entry is not null and ema200 is not null and abs(v_entry - ema200) <= greatest(0.5 * atr1, 0.004 * v_entry);
      lvl_pts := case when best is null then 0 when best->>'src' = 'woods' then 25 when best->>'src' = 'eliz' then 22 when best->>'src' = 'Yearly open' then 20 when best->>'src' in ('Monthly open','Prev month high','Prev month low') then 18 when best->>'src' in ('Monday high','Monday low') then 15 when best->>'src' = 'Weekly open' then 12 when best->>'src' in ('PWL','PWH') then 20 when best->>'src' = 'plan' then 18 when best->>'src' in ('PDL','PDH') then 15 else 12 end;
      comp := jsonb_build_object(
        'level', lvl_pts,
        'anchor', case when v_coin = 'BTC' and v_side = 'long' then (case anchor_state when 'above' then 20 when 'inside' then 8 else 12 end)
                       when v_coin = 'BTC' and v_side = 'short' then (case anchor_state when 'below' then 20 when 'inside' then 8 else 6 end)
                       when v_side = 'long' then (case anchor_state when 'above' then 20 else 0 end)
                       else (case anchor_state when 'below' then 20 when 'inside' then 10 else 4 end) end,
        'rr', case when rr1 is null then 0 when rr1 >= 3 then 20 when rr1 >= 2 then 15 when rr1 >= 1.5 then 10 when rr1 >= 1 then 5 else 0 end,
        'rsi', case when sg = 1 then (case when rsi[n4] <= 40 then 15 when rsi[n4] <= 50 then 8 else 0 end) else (case when rsi[n4] >= 60 then 15 when rsi[n4] >= 50 then 8 else 0 end) end,
        'trend', case when (sg = 1 and px > ema50) or (sg = -1 and px < ema50) then 10 else 4 end,
        'record', case when coalesce(rec_n, 0) < 3 then 5 when rec_avg > 0 then 10 else 0 end,
        'fib', case when near_fib then 10 else 0 end,
        'bias', case when wb.week_start is null or wb.bias is null then 5
                     when wb.bias in ('neutral','range') then 5
                     when (wb.bias = 'long' and sg = 1) or (wb.bias = 'short' and sg = -1) then (case when wb.confirmed then 10 else 7 end)
                     else (case when wb.confirmed then 0 else 3 end) end,
        'macro', case when mz_state = 'none' then 5
                      when sg = 1 then (case mz_state when 'buy_zone' then 10 when 'lower' then 8 when 'mid' then 3 when 'above_range' then 6 when 'expansion' then 6 else 0 end)
                      else (case mz_state when 'range_top' then 10 when 'macro_resistance' then 10 when 'upper' then 8 when 'mid' then 3 when 'invalidated' then 6 when 'above_range' then 2 else 0 end) end);
      conf := round((select sum(value::int) from jsonb_each_text(comp)) * 100.0 / 130);
      grade := case when conf >= 75 then 'A+' when conf >= 60 then 'A' when conf >= 45 then 'B' else 'C' end;
      if coalesce(rec_n, 0) >= 3 and rec_avg <= 0 then blocked := coalesce(blocked || '; ', '') || 'woods_limit paper record ≤ 0R — muted'; end if;

      if p_save then
        insert into woods_machine (coin, side, as_of, data_as_of, price, anchor, checklist, trigger, limit_plan, confidence, grade, components, blocked)
        values (v_coin, v_side, now(), data_ts, px, anchor,
          jsonb_build_object('a', a_ok, 'b', b_ok, 'c', case when sweep_i is null then null else c_ok end, 'd', case when sweep_i is null then null else d_ok end,
            'pool', sweep_kind, 'level', sweep_lvl, 'wick', wick, 'bar', case when sweep_i is null then null else ts4[sweep_i] end, 'rsi_now', round(rsi[n4], 1), 'rsi_note', rsi_note, 'trigger_at', d_ts, 'fib_zone', case when f_lo is null then null else jsonb_build_array(round(f_lo, 2), round(f_hi, 2)) end, 'fib_confluence', near_fib, 'ema200', round(ema200, 2), 'ema200_confluence', near_ema),
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
        if blocked is null and grade in ('A+','A') and v_entry is not null
           and not exists (select 1 from limit_orders where setup_id = 'woods_limit' and symbol = v_coin and direction = v_side and status in ('working','touched','filled')) then
          insert into limit_orders (venue, symbol, direction, origin, limit_price, stop, current_stop, tp1, tp2, plan_r, level, level_kind, grade, setup_id, status, expires_at, reasoning, source)
          values ('blofin', v_coin, v_side, 'paper', mb_px(v_entry), mb_px(v_stop), mb_px(v_stop), mb_px(v_tp1), mb_px(v_tp2), rr1,
                  mb_px(case when sg = 1 then (best->>'low')::numeric else (best->>'high')::numeric end), 'woods_' || lower(replace(best->>'src', ' ', '_')), grade, 'woods_limit', 'working', now() + interval '24 hours',
                  format('WOODS %s %s limit %s at %s (%s) · stop %s · TP1 %s (%sR, 70%%) · TP2 %s (%sR) · confidence %s%s%s', v_coin, v_side, mb_px(v_entry), best->>'src', best->>'note', mb_px(v_stop), mb_px(v_tp1), rr1, mb_px(v_tp2), rr2, conf, case when near_fib then ' · FIB✓' else '' end, case when near_ema then ' · EMA200✓' else '' end),
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
end $function$;

