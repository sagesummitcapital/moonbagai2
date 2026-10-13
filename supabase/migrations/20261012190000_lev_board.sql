-- Trading-hours board (Stavros, 2026-10-12): "a section in lev trades at the top that shows me any A+ leverage trade setups
-- or levels that updates every hour from 5am - 3pm weekdays - limit or market orders - btc, eth and sol, i always want a range
-- high and low that is good entry for a short or long on each. and on the top 5 movers ... whats getting close to either a long
-- or short ... trading view should match".
--
-- lev_board: one row per coin (BTC, ETH, SOL + the Scout's rotation top 5), refreshed by lev_board_refresh() every hour of
-- his trading window by the Desk Lead. Range high/low = the Cartographer's TradingView lines when they are fresh and bracket
-- price (so the site and TradingView match); otherwise the nearest stored-candle support/resistance (source 'auto', and the
-- Desk Lead then draws those lines in TradingView). Each edge carries the backtested limit plan (research/limits): limit
-- 0.5 x 1h ATR through the edge, stop max(0.8% core / 1.5% other, 1.5 x 1h ATR), TP1 = the other edge or the next level.

create table if not exists public.lev_board (
  asset        text primary key,
  updated_at   timestamptz not null default now(),
  last_bar     timestamptz,
  tier         text,                 -- core | mover
  rank         integer,
  price        numeric,
  change_24h   numeric,              -- %
  atr_1h       numeric,
  atr_1d       numeric,
  ema50_1d     numeric,
  trend        text,                 -- up (above daily EMA50) | down
  cooling      boolean not null default false,
  range_low    numeric,
  range_high   numeric,
  range_source text,                 -- tradingview | auto
  long_plan    jsonb,                -- {entry, stop, tp1, rr, grade, dist_pct, near, order, note}
  short_plan   jsonb,
  best_side    text,
  best_grade   text,
  near         boolean not null default false
);
alter table public.lev_board enable row level security;

create or replace function public.lev_board_refresh()
returns jsonb language plpgsql as $$
declare
  a text; out jsonb := '[]'::jsonb; u record;
  v_last timestamptz; v_now timestamptz; v_price numeric; v_prev numeric; v_a1 numeric; v_a1d numeric; v_e50 numeric;
  v_lo3 numeric; v_hi3 numeric; v_core boolean; v_min numeric; v_cool boolean; v_trend text;
  sup numeric[]; res numeric[]; v_rl numeric; v_rh numeric; v_src text; hl record; pd record; pw record; e record;
  side text; sg integer; v_edge numeric; v_entry numeric; v_risk numeric; v_stop numeric; v_tp numeric; v_rr numeric; v_dist numeric;
  v_grade text; v_near boolean; plan jsonb; lp jsonb; sp jsonb; v_best text; v_bg text; v_any_near boolean;
begin
  for u in
    select asset, case when asset in ('BTC', 'ETH', 'SOL') then 'core' else 'mover' end tier, rank
      from public.lev_universe where asset in ('BTC', 'ETH', 'SOL') or (tier = 'rotation' and rank <= 5)
  loop
    a := u.asset;
    v_core := a in ('BTC', 'ETH', 'SOL');
    v_min := case when v_core then 0.008 else 0.015 end;
    select max(ts) into v_last from public.candles where asset = a and tf = '1h';
    if v_last is null then out := out || jsonb_build_object('asset', a, 'skip', 'no_candles'); continue; end if;
    v_now := v_last + interval '1 hour';
    select c into v_price from public.candles where asset = a and tf = '1h' and ts = v_last;
    select c into v_prev from public.candles where asset = a and tf = '1h' and ts = v_last - interval '24 hours';
    select avg(tr) into v_a1 from (
      select greatest(h - l, abs(h - lag(c) over w), abs(l - lag(c) over w)) tr
        from (select * from public.candles where asset = a and tf = '1h' order by ts desc limit 15) z
      window w as (order by ts)) q where tr is not null;
    select avg(tr) into v_a1d from (
      select greatest(h - l, abs(h - lag(c) over (order by d)), abs(l - lag(c) over (order by d))) tr from (
        select date_trunc('day', ts) d, max(h) h, min(l) l, (array_agg(c order by ts desc))[1] c
          from public.candles where asset = a and tf = '1h' and ts >= v_now - interval '20 days' and ts < date_trunc('day', v_now)
         group by 1 having count(*) >= 20) dd) q where tr is not null;
    v_e50 := null;
    for e in select c from public.candles where asset = a and tf = '1d' and ts < date_trunc('day', v_now) order by ts loop
      v_e50 := case when v_e50 is null then e.c else v_e50 + (2.0 / 51.0) * (e.c - v_e50) end;
    end loop;
    v_trend := case when v_e50 is null then null when v_price >= v_e50 then 'up' else 'down' end;
    select min(l), max(h) into v_lo3, v_hi3 from public.candles where asset = a and tf = '1h' and ts > v_last - interval '72 hours';
    v_cool := v_price >= v_lo3 * 1.10 or v_price <= v_hi3 * 0.90;

    -- candle levels: 4h swings (10 days), previous day and week high/low
    sup := '{}'; res := '{}';
    for e in
      with b4 as (
        select date_trunc('day', ts) + floor(extract(hour from ts) / 4) * interval '4 hours' b, max(h) h, min(l) l
          from public.candles where asset = a and tf = '1h' and ts >= v_now - interval '13 days' and ts < v_now
         group by 1 having count(*) = 4),
      z as (select b, h, l, lag(l, 1) over w l1, lag(l, 2) over w l2, lead(l, 1) over w l3, lead(l, 2) over w l4,
                   lag(h, 1) over w h1, lag(h, 2) over w h2, lead(h, 1) over w h3, lead(h, 2) over w h4 from b4 window w as (order by b))
      select l, h, (l < least(l1, l2) and l <= least(l3, l4)) is_s, (h > greatest(h1, h2) and h >= greatest(h3, h4)) is_r
        from z where b + interval '12 hours' <= v_now and b + interval '12 hours' > v_now - interval '10 days'
    loop
      if e.is_s then sup := sup || e.l; end if;
      if e.is_r then res := res || e.h; end if;
    end loop;
    select max(h) h, min(l) l into pd from public.candles where asset = a and tf = '1h'
       and ts >= date_trunc('day', v_now) - interval '1 day' and ts < date_trunc('day', v_now);
    if pd.l is not null then sup := sup || pd.l; res := res || pd.h; end if;
    select max(h) h, min(l) l into pw from public.candles where asset = a and tf = '1h'
       and ts >= date_trunc('week', v_now) - interval '7 days' and ts < date_trunc('week', v_now);
    if pw.l is not null then sup := sup || pw.l; res := res || pw.h; end if;

    -- range: the TradingView lines (Cartographer) when fresh and bracketing price, else the nearest candle levels
    v_rl := null; v_rh := null; v_src := null;
    select (levels ->> 'range_low')::numeric rl, (levels ->> 'range_high')::numeric rh into hl
      from public.lev_hourly where asset = a and ts > now() - interval '48 hours' and levels ? 'range_low' order by ts desc limit 1;
    if hl.rl is not null and hl.rh is not null and hl.rl < v_price and hl.rh > v_price then
      v_rl := hl.rl; v_rh := hl.rh; v_src := 'tradingview';
    else
      select max(x) into v_rl from unnest(sup) x where x < v_price - 0.15 * coalesce(v_a1d, 0);
      select min(x) into v_rh from unnest(res) x where x > v_price + 0.15 * coalesce(v_a1d, 0);
      v_rl := coalesce(v_rl, v_lo3); v_rh := coalesce(v_rh, v_hi3); v_src := 'auto';
    end if;

    lp := null; sp := null; v_best := null; v_bg := null; v_any_near := false;
    foreach side in array array['long', 'short'] loop
      sg := case when side = 'long' then 1 else -1 end;
      v_edge := case when side = 'long' then v_rl else v_rh end;
      if v_edge is null or v_a1 is null then continue; end if;
      v_entry := v_edge - sg * 0.5 * v_a1;
      v_risk := greatest(v_min * v_entry, 1.5 * v_a1);
      v_stop := v_entry - sg * v_risk;
      -- TP1: the other edge if it is at least 1R away, else the next level beyond it
      if side = 'long' then
        v_tp := case when v_rh > v_entry + v_risk then v_rh end;
        if v_tp is null then select min(x) into v_tp from unnest(res) x where x > v_entry + v_risk; end if;
      else
        v_tp := case when v_rl < v_entry - v_risk then v_rl end;
        if v_tp is null then select max(x) into v_tp from unnest(sup) x where x < v_entry - v_risk; end if;
      end if;
      v_rr := case when v_tp is null then null else round(abs(v_tp - v_entry) / v_risk, 2) end;
      v_dist := abs(v_price - v_entry);
      v_grade := case
        when v_cool then 'cooling'
        when v_rr is null or v_rr < 2 then 'no trade'
        when v_trend is not null and ((side = 'long' and v_trend = 'down') or (side = 'short' and v_trend = 'up')) then 'B'
        when v_rr >= 3 and v_a1d is not null and abs(v_price - v_edge) between 0.3 * v_a1d and 2.0 * v_a1d then 'A+'
        else 'A' end;
      v_near := not v_cool and v_a1d is not null and v_dist <= 0.5 * v_a1d;
      plan := jsonb_build_object('edge', round(v_edge, 8), 'entry', round(v_entry, 8), 'stop', round(v_stop, 8), 'tp1', round(v_tp, 8),
        'rr', v_rr, 'grade', v_grade, 'dist_pct', round(100 * v_dist / v_price, 2), 'near', v_near,
        'stop_pct', round(100 * v_risk / v_entry, 2),
        'order', case when v_dist <= 0.25 * v_a1 then 'market' else 'limit' end,
        'note', case
          when v_grade = 'cooling' then 'cooling — no entries until the 3-day move is back under 10%'
          when v_grade = 'no trade' then format('no trade: TP1 is under 2R from this edge (%sR)', coalesce(v_rr::text, '—'))
          when v_grade = 'B' then 'against the daily trend — half size at most'
          else format('limit %s through the %s edge %s; stop %s (%s%%); TP1 %s', round(0.5 * v_a1, 8), side, round(v_edge, 8),
                      round(v_stop, 8), round(100 * v_risk / v_entry, 2), round(v_tp, 8)) end);
      if side = 'long' then lp := plan; else sp := plan; end if;
      if v_near and v_grade in ('A+', 'A') then v_any_near := true; end if;
    end loop;
    -- best side: higher grade first, then the closer entry
    select x.sd, x.g into v_best, v_bg from (values
        ('long', lp ->> 'grade', (lp ->> 'dist_pct')::numeric), ('short', sp ->> 'grade', (sp ->> 'dist_pct')::numeric)) x(sd, g, d)
     where x.g in ('A+', 'A', 'B')
     order by case x.g when 'A+' then 3 when 'A' then 2 else 1 end desc, x.d asc limit 1;

    insert into public.lev_board as b (asset, updated_at, last_bar, tier, rank, price, change_24h, atr_1h, atr_1d, ema50_1d, trend, cooling,
      range_low, range_high, range_source, long_plan, short_plan, best_side, best_grade, near)
    values (a, now(), v_last, u.tier, u.rank, v_price, case when v_prev > 0 then round(100 * (v_price / v_prev - 1), 2) end,
      round(v_a1, 8), round(v_a1d, 8), round(v_e50, 8), v_trend, v_cool, round(v_rl, 8), round(v_rh, 8), v_src, lp, sp, v_best, v_bg, v_any_near)
    on conflict (asset) do update set updated_at = excluded.updated_at, last_bar = excluded.last_bar, tier = excluded.tier, rank = excluded.rank,
      price = excluded.price, change_24h = excluded.change_24h, atr_1h = excluded.atr_1h, atr_1d = excluded.atr_1d, ema50_1d = excluded.ema50_1d,
      trend = excluded.trend, cooling = excluded.cooling, range_low = excluded.range_low, range_high = excluded.range_high,
      range_source = excluded.range_source, long_plan = excluded.long_plan, short_plan = excluded.short_plan,
      best_side = excluded.best_side, best_grade = excluded.best_grade, near = excluded.near;
    out := out || jsonb_build_object('asset', a, 'price', v_price, 'range', jsonb_build_array(round(v_rl, 8), round(v_rh, 8)), 'source', v_src,
      'best', v_best, 'grade', v_bg, 'near', v_any_near, 'cooling', v_cool);
  end loop;
  -- coins that left the top 5 drop off the board
  update public.lev_board set tier = 'off' where asset not in (
    select asset from public.lev_universe where asset in ('BTC', 'ETH', 'SOL') or (tier = 'rotation' and rank <= 5));
  return out;
end $$;
