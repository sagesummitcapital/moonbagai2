-- Limit orders (Stavros, 2026-10-12): "I want to introduce limit orders ... store this and set up TradingView alerts
-- to let me know if the limit hits ... I also want you to be looking for limit orders now ... set up a feedback loop".
--
-- 1. limit_orders: every resting limit — his own (Grok records them), Moonbag's suggestions, and Moonbag's paper limits.
-- 2. lev_limit_plan(): the backtested limit recipe (research/limits, adopted 2026-10-12) run on stored 1h candles; places
--    one PAPER limit per coin when there is a setup and returns the candidates (the Desk Lead sends the best ones).
-- 3. lev_limit_resolve(): replays every working/filled paper limit against stored 1h candles (fill, stop, break-even,
--    target, expiry) and marks real limits as 'touched' when price trades through them.
-- 4. A trades trigger links a new BloFin trade to the working limit it filled.

create table if not exists public.limit_orders (
  limit_id      text primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  venue         text not null default 'blofin',
  symbol        text not null,
  direction     text not null check (direction in ('long', 'short')),
  origin        text not null default 'own' check (origin in ('own', 'moonbag', 'paper')),
  group_id      text,                              -- ladder / DCA group (several rungs share it)
  rung          integer,
  limit_price   numeric not null,
  quantity      numeric,
  notional      numeric,
  leverage      numeric,
  margin        numeric,
  stop          numeric,
  current_stop  numeric,
  tp1           numeric,
  tp2           numeric,
  risk_dollars  numeric,
  risk_percent  numeric,
  plan_r        numeric,
  level         numeric,                           -- the support/resistance the limit sits under/over
  level_kind    text,                              -- swing_4h | pdl | pdh | pwl | pwh | own
  grade         text,
  setup_id      text default 'limit_sweep',
  status        text not null default 'working'
                check (status in ('working', 'touched', 'filled', 'closed', 'cancelled', 'expired')),
  expires_at    timestamptz,
  touched_at    timestamptz,
  filled_at     timestamptz,
  fill_price    numeric,
  trade_id      text,
  outcome       text,                              -- target | stop | be | unfilled | target_first | cancelled
  outcome_r     numeric,
  mfe_r         numeric,
  resolved_at   timestamptz,
  alert_id      text,                              -- alerts.alert_id of its TradingView "LIMIT" alert
  notes         text,
  reasoning     text,
  source        text not null default 'grok' check (source in ('grok', 'claude', 'stavros'))
);
create index if not exists limit_orders_status on public.limit_orders (status, symbol);
create index if not exists limit_orders_created on public.limit_orders (created_at desc);
alter table public.limit_orders enable row level security;

create or replace function public.moonbag_limit_before()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.limit_id is null then
      new.limit_id := public.moonbag_next_id('MBL', public.moonbag_today(), new.symbol);
    end if;
    new.symbol := upper(new.symbol);
    new.current_stop := coalesce(new.current_stop, new.stop);
    if new.expires_at is null and new.origin = 'paper' then new.expires_at := now() + interval '24 hours'; end if;
    if new.plan_r is null and new.stop is not null and new.tp1 is not null and new.limit_price <> new.stop then
      new.plan_r := round(abs(new.tp1 - new.limit_price) / abs(new.limit_price - new.stop), 2);
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace trigger limit_orders_before before insert or update on public.limit_orders
  for each row execute function public.moonbag_limit_before();

-- A BloFin trade that opens on a coin with a working/touched real limit at (about) the same price fills that limit.
create or replace function public.moonbag_trade_links_limit()
returns trigger language plpgsql as $$
declare v text;
begin
  if new.venue = 'blofin' and new.status in ('open', 'pending') then
    select limit_id into v from public.limit_orders
     where symbol = upper(new.symbol) and direction = new.direction and origin <> 'paper'
       and status in ('working', 'touched') and abs(limit_price - new.entry) <= 0.004 * new.entry
     order by abs(limit_price - new.entry) limit 1;
    if v is not null then
      update public.limit_orders set status = 'filled', filled_at = coalesce(new.opened_at, now()),
             fill_price = new.entry, trade_id = new.trade_id
       where limit_id = v;
    end if;
  end if;
  return new;
end $$;
create or replace trigger trades_link_limit after insert on public.trades
  for each row execute function public.moonbag_trade_links_limit();

-- ------------------------------------------------------------------ the backtested recipe
create or replace function public.lev_limit_plan(p_assets text[] default null, p_save boolean default true)
returns jsonb language plpgsql as $$
declare
  a text; out jsonb := '[]'::jsonb;
  v_last timestamptz; v_now timestamptz; v_price numeric; v_a1 numeric; v_a1d numeric; v_e50 numeric;
  v_lo3 numeric; v_hi3 numeric; v_core boolean; v_min numeric;
  s numeric[]; s_kind text[]; r numeric[]; r_kind text[];
  v_side text; v_lvl numeric; v_kind text; v_entry numeric; v_risk numeric; v_stop numeric; v_tgt numeric; v_tgt2 numeric;
  v_plan numeric; best jsonb; cand jsonb; sg integer; i integer; v_id text; v_dist numeric;
  pd record; pw record; e record;
begin
  for a in
    select x from unnest(coalesce(p_assets,
      (select array_agg(asset order by asset) from public.lev_universe
        where tier = 'core' or asset = 'SOL' or (tier = 'rotation' and rank <= 5)))) x
  loop
    v_core := a in ('BTC', 'ETH', 'SOL');
    v_min := case when v_core then 0.008 else 0.015 end;
    select max(ts) into v_last from public.candles where asset = a and tf = '1h';
    if v_last is null or v_last < now() - interval '3 hours' then
      out := out || jsonb_build_object('asset', a, 'skip', 'data', 'last_bar', v_last); continue;
    end if;
    v_now := v_last + interval '1 hour';
    select c into v_price from public.candles where asset = a and tf = '1h' and ts = v_last;
    -- 1h ATR14
    select avg(tr) into v_a1 from (
      select greatest(h - l, abs(h - lag(c) over w), abs(l - lag(c) over w)) tr
        from (select * from public.candles where asset = a and tf = '1h' order by ts desc limit 15) z
      window w as (order by ts)) q where tr is not null;
    -- daily bars built from the 1h candles (same feed as the trades), ATR14(1D)
    select avg(tr) into v_a1d from (
      select greatest(h - l, abs(h - lag(c) over (order by d)), abs(l - lag(c) over (order by d))) tr, d from (
        select date_trunc('day', ts) d, max(h) h, min(l) l, (array_agg(c order by ts desc))[1] c
          from public.candles where asset = a and tf = '1h' and ts >= v_now - interval '20 days' and ts < date_trunc('day', v_now)
         group by 1 having count(*) >= 20) dd) q where tr is not null;
    if v_a1 is null or v_a1d is null then out := out || jsonb_build_object('asset', a, 'skip', 'atr'); continue; end if;
    -- daily EMA50 trend (1d table; spot feed is fine for direction)
    v_e50 := null;
    for e in select c from public.candles where asset = a and tf = '1d' and ts < date_trunc('day', v_now) order by ts loop
      v_e50 := case when v_e50 is null then e.c else v_e50 + (2.0 / 51.0) * (e.c - v_e50) end;
    end loop;
    -- no chase: 3-day move >= 10%
    select min(l), max(h) into v_lo3, v_hi3 from public.candles where asset = a and tf = '1h' and ts > v_last - interval '72 hours';
    if v_price >= v_lo3 * 1.10 or v_price <= v_hi3 * 0.90 then
      out := out || jsonb_build_object('asset', a, 'skip', 'cooling'); continue;
    end if;
    -- busy: one working limit / open trade per coin
    if exists (select 1 from public.limit_orders where symbol = a and status in ('working', 'touched') )
       or exists (select 1 from public.limit_orders where symbol = a and origin = 'paper' and status = 'filled')
       or exists (select 1 from public.trades where venue = 'blofin' and status = 'open' and symbol = a) then
      out := out || jsonb_build_object('asset', a, 'skip', 'busy'); continue;
    end if;
    -- levels known now: 4h swings (confirmed 2 bars later) of the last 10 days, previous day, previous week
    s := '{}'; s_kind := '{}'; r := '{}'; r_kind := '{}';
    for e in
      with b4 as (
        select date_trunc('day', ts) + floor(extract(hour from ts) / 4) * interval '4 hours' b, max(h) h, min(l) l
          from public.candles where asset = a and tf = '1h' and ts >= v_now - interval '13 days' and ts < v_now
         group by 1 having count(*) = 4),
      z as (select b, h, l,
              lag(l, 1) over w l1, lag(l, 2) over w l2, lead(l, 1) over w l3, lead(l, 2) over w l4,
              lag(h, 1) over w h1, lag(h, 2) over w h2, lead(h, 1) over w h3, lead(h, 2) over w h4
              from b4 window w as (order by b))
      select b, l, h, (l < least(l1, l2) and l <= least(l3, l4)) is_s, (h > greatest(h1, h2) and h >= greatest(h3, h4)) is_r
        from z where b + interval '12 hours' <= v_now and b + interval '12 hours' > v_now - interval '10 days'
    loop
      if e.is_s then s := s || e.l; s_kind := s_kind || 'swing_4h'::text; end if;
      if e.is_r then r := r || e.h; r_kind := r_kind || 'swing_4h'::text; end if;
    end loop;
    select max(h) h, min(l) l into pd from public.candles where asset = a and tf = '1h'
       and ts >= date_trunc('day', v_now) - interval '1 day' and ts < date_trunc('day', v_now);
    if pd.l is not null then s := s || pd.l; s_kind := s_kind || 'pdl'::text; r := r || pd.h; r_kind := r_kind || 'pdh'::text; end if;
    select max(h) h, min(l) l into pw from public.candles where asset = a and tf = '1h'
       and ts >= date_trunc('week', v_now) - interval '7 days' and ts < date_trunc('week', v_now);
    if pw.l is not null then s := s || pw.l; s_kind := s_kind || 'pwl'::text; r := r || pw.h; r_kind := r_kind || 'pwh'::text; end if;

    best := null;
    foreach v_side in array array['long', 'short'] loop
      sg := case when v_side = 'long' then 1 else -1 end;
      if v_e50 is not null and ((v_side = 'long' and v_price < v_e50) or (v_side = 'short' and v_price > v_e50)) then continue; end if;
      v_lvl := null; v_kind := null;
      if v_side = 'long' then
        for i in 1 .. coalesce(array_length(s, 1), 0) loop
          v_dist := v_price - s[i];
          if v_dist >= 0.3 * v_a1d and v_dist <= 2.0 * v_a1d and (v_lvl is null or s[i] > v_lvl) then v_lvl := s[i]; v_kind := s_kind[i]; end if;
        end loop;
      else
        for i in 1 .. coalesce(array_length(r, 1), 0) loop
          v_dist := r[i] - v_price;
          if v_dist >= 0.3 * v_a1d and v_dist <= 2.0 * v_a1d and (v_lvl is null or r[i] < v_lvl) then v_lvl := r[i]; v_kind := r_kind[i]; end if;
        end loop;
      end if;
      if v_lvl is null then continue; end if;
      v_entry := v_lvl - sg * 0.5 * v_a1;                       -- fills only when price sweeps the level
      v_risk := greatest(v_min * v_entry, 1.5 * v_a1);          -- the v16 stop rule
      v_stop := v_entry - sg * v_risk;
      v_tgt := null; v_tgt2 := null;
      if v_side = 'long' then
        select min(x) into v_tgt from unnest(r) x where x > v_entry + v_risk;
        select min(x) into v_tgt2 from unnest(r) x where x > v_tgt;
      else
        select max(x) into v_tgt from unnest(s) x where x < v_entry - v_risk;
        select max(x) into v_tgt2 from unnest(s) x where x < v_tgt;
      end if;
      if v_tgt is null then continue; end if;
      v_plan := abs(v_tgt - v_entry) / v_risk;
      if v_plan < 2 then continue; end if;
      cand := jsonb_build_object('asset', a, 'side', v_side, 'level', round(v_lvl, 8), 'level_kind', v_kind,
        'limit', round(v_entry, 8), 'stop', round(v_stop, 8), 'tp1', round(v_tgt, 8), 'tp2', round(v_tgt2, 8),
        'plan_r', round(v_plan, 2), 'stop_pct', round(100 * v_risk / v_entry, 2), 'price', v_price,
        'dist_atr1d', round(abs(v_lvl - v_price) / v_a1d, 2), 'e50d', round(v_e50, 8), 'atr1h', round(v_a1, 8));
      if best is null or abs(v_lvl - v_price) < abs((best ->> 'level')::numeric - v_price) then best := cand; end if;
    end loop;
    if best is null then out := out || jsonb_build_object('asset', a, 'skip', 'no_setup'); continue; end if;
    if p_save then
      insert into public.limit_orders (symbol, direction, origin, limit_price, stop, tp1, tp2, plan_r, level, level_kind,
        grade, setup_id, status, expires_at, source, reasoning)
      values (a, best ->> 'side', 'paper', (best ->> 'limit')::numeric, (best ->> 'stop')::numeric, (best ->> 'tp1')::numeric,
        (best ->> 'tp2')::numeric, (best ->> 'plan_r')::numeric, (best ->> 'level')::numeric, best ->> 'level_kind',
        case when (best ->> 'plan_r')::numeric >= 3 then 'A+' else 'A' end, 'limit_sweep', 'working', v_now + interval '24 hours', 'claude',
        format('%s %s limit %s, 0.5 x 1h ATR through the %s %s; stop %s (%s%%); TP1 %s (%sR)', a, best ->> 'side', best ->> 'limit',
          best ->> 'level_kind', best ->> 'level', best ->> 'stop', best ->> 'stop_pct', best ->> 'tp1', best ->> 'plan_r'))
      returning limit_id into v_id;
      best := best || jsonb_build_object('limit_id', v_id);
    end if;
    out := out || best;
  end loop;
  return out;
end $$;

-- ------------------------------------------------------------------ replay paper limits; mark real ones touched
create or replace function public.lev_limit_resolve()
returns jsonb language plpgsql as $$
declare
  L record; b record; out jsonb := '[]'::jsonb;
  sg integer; v_fill timestamptz; v_stop numeric; v_risk numeric; v_mfe numeric; v_prev_h numeric; v_prev_l numeric;
  v_status text; v_outcome text; v_r numeric; v_end timestamptz; v_exit numeric; v_fee_out numeric;
begin
  -- real limits: touched when price trades through them; expired after expires_at if never filled
  update public.limit_orders lo set status = 'touched', touched_at = q.ts
    from (select l2.limit_id, min(c.ts) ts from public.limit_orders l2 join public.candles c
            on c.asset = l2.symbol and c.tf = '1h' and c.ts >= date_trunc('hour', l2.created_at)
           where l2.origin <> 'paper' and l2.status = 'working'
             and ((l2.direction = 'long' and c.l <= l2.limit_price) or (l2.direction = 'short' and c.h >= l2.limit_price))
           group by l2.limit_id) q
   where lo.limit_id = q.limit_id;
  update public.limit_orders set status = 'expired', outcome = 'unfilled', resolved_at = now()
   where origin <> 'paper' and status in ('working', 'touched') and expires_at is not null and expires_at < now();

  for L in select * from public.limit_orders where origin = 'paper' and status in ('working', 'filled') order by created_at loop
    sg := case when L.direction = 'long' then 1 else -1 end;
    v_fill := null; v_stop := L.stop; v_risk := abs(L.limit_price - L.stop); v_mfe := 0;
    v_status := L.status; v_outcome := null; v_r := null; v_end := null; v_prev_h := null; v_prev_l := null;
    for b in select ts, h, l from public.candles where asset = L.symbol and tf = '1h'
               and ts >= date_trunc('hour', L.created_at) order by ts loop
      if v_fill is null then
        if L.expires_at is not null and b.ts >= L.expires_at then v_status := 'expired'; v_outcome := 'unfilled'; v_end := b.ts; exit; end if;
        if (sg = 1 and b.h >= L.tp1) or (sg = -1 and b.l <= L.tp1) then v_status := 'cancelled'; v_outcome := 'target_first'; v_end := b.ts; exit; end if;
        if (sg = 1 and b.l < L.limit_price) or (sg = -1 and b.h > L.limit_price) then
          v_fill := b.ts;
          if (sg = 1 and b.l <= v_stop) or (sg = -1 and b.h >= v_stop) then
            v_status := 'closed'; v_outcome := 'stop'; v_exit := v_stop; v_fee_out := 0.0008; v_end := b.ts; exit;
          end if;
          v_status := 'filled';
          v_prev_h := b.h; v_prev_l := b.l; continue;
        end if;
      else
        v_mfe := greatest(v_mfe, case when sg = 1 then (b.h - L.limit_price) else (L.limit_price - b.l) end / v_risk);
        -- break-even once the previous bar reached +1.5R (entry + fees)
        if v_stop = L.stop and ((sg = 1 and v_prev_h >= L.limit_price + 1.5 * v_risk) or (sg = -1 and v_prev_l <= L.limit_price - 1.5 * v_risk)) then
          v_stop := L.limit_price * (1 + sg * 0.002);
        end if;
        if (sg = 1 and b.l <= v_stop) or (sg = -1 and b.h >= v_stop) then
          v_status := 'closed'; v_outcome := case when v_stop = L.stop then 'stop' else 'be' end; v_exit := v_stop; v_fee_out := 0.0008; v_end := b.ts; exit;
        end if;
        if (sg = 1 and b.h >= L.tp1) or (sg = -1 and b.l <= L.tp1) then
          v_status := 'closed'; v_outcome := 'target'; v_exit := L.tp1; v_fee_out := 0.0002; v_end := b.ts; exit;
        end if;
        v_prev_h := b.h; v_prev_l := b.l;
      end if;
    end loop;
    if v_status = 'closed' then
      v_r := round((sg * (v_exit - L.limit_price) - L.limit_price * 0.0002 - v_exit * v_fee_out) / v_risk, 3);
    end if;
    if v_status is distinct from L.status or v_fill is distinct from L.filled_at or v_stop is distinct from L.current_stop then
      update public.limit_orders set status = v_status, filled_at = v_fill, fill_price = case when v_fill is not null then limit_price end,
             current_stop = v_stop, outcome = v_outcome, outcome_r = v_r, mfe_r = round(v_mfe, 2),
             resolved_at = case when v_status in ('closed', 'expired', 'cancelled') then coalesce(v_end, now()) end
       where limit_id = L.limit_id;
      out := out || jsonb_build_object('limit_id', L.limit_id, 'asset', L.symbol, 'status', v_status, 'outcome', v_outcome, 'r', v_r);
    end if;
  end loop;
  return out;
end $$;

-- ------------------------------------------------------------------ scoreboard for the weekly review and the dashboard
create or replace view public.v_limit_scoreboard as
select origin,
       count(*)                                                    as placed,
       count(*) filter (where filled_at is not null)               as filled,
       count(*) filter (where status = 'closed')                   as closed,
       count(*) filter (where outcome = 'target')                  as targets,
       count(*) filter (where outcome = 'be')                      as breakevens,
       count(*) filter (where outcome = 'stop')                    as stops,
       round(avg(outcome_r) filter (where status = 'closed'), 3)   as avg_r,
       round(sum(outcome_r) filter (where status = 'closed'), 2)   as total_r,
       round(100.0 * count(*) filter (where outcome = 'target') / nullif(count(*) filter (where status = 'closed'), 0), 1) as target_rate_pct
  from public.limit_orders
 group by origin;
