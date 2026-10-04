-- =============================================================================
-- Moonbag — Leverage desk (BloFin, BTC/ETH), backtest engine, paper trades,
-- journal ("feedback line"), and the Robinhood test ceilings from
-- "Operating direction 2026-10-03".
-- Purely additive: creates new tables/functions/triggers, drops nothing.
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------- price history
create table if not exists public.candles (
  asset text not null,
  tf    text not null default '1h',
  ts    timestamptz not null,           -- bar open time (UTC)
  o numeric not null, h numeric not null, l numeric not null, c numeric not null,
  v numeric,
  primary key (asset, tf, ts)
);
alter table public.candles enable row level security;

-- ---------------------------------------------------------------- strategy (versioned, immutable)
create table if not exists public.lev_strategy (
  version          integer primary key,
  title            text not null,
  summary          text,
  markdown         text not null,
  rules            jsonb not null default '{}'::jsonb,
  confidence_model jsonb not null default '{}'::jsonb,
  change_reason    text,
  status           text not null default 'active' check (status in ('active','superseded')),
  created_at       timestamptz not null default now()
);
alter table public.lev_strategy enable row level security;

create or replace function public.moonbag_lev_strategy_before_insert()
returns trigger language plpgsql as $$
begin
  if new.version is null then
    select coalesce(max(version), 0) + 1 into new.version from public.lev_strategy;
  end if;
  new.status := 'active';
  new.created_at := now();
  update public.lev_strategy set status = 'superseded' where status = 'active';
  return new;
end $$;
create or replace function public.moonbag_lev_strategy_before_update()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Strategy versions are immutable. Insert a new version instead.';
  end if;
  return new;
end $$;
create or replace trigger trg_lev_strategy_bi before insert on public.lev_strategy
  for each row execute function public.moonbag_lev_strategy_before_insert();
create or replace trigger trg_lev_strategy_bu before update on public.lev_strategy
  for each row execute function public.moonbag_lev_strategy_before_update();
create or replace trigger trg_lev_strategy_nd before delete on public.lev_strategy
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- playbook of setups
create table if not exists public.lev_playbook (
  setup_id       text primary key check (setup_id ~ '^[a-z0-9_]+$'),
  name           text not null,
  description    text,
  entry_rule     text,
  stop_rule      text,
  target_rule    text,
  best_regime    text,
  engine_code    text check (engine_code in ('breakout','sweep_reclaim','trend_pullback')),
  default_params jsonb not null default '{}'::jsonb,
  source         text,
  status         text not null default 'paper' check (status in ('live','paper','testing','retired')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.lev_playbook enable row level security;
create or replace trigger trg_lev_playbook_touch before update on public.lev_playbook
  for each row execute function public.moonbag_touch_updated_at();
create or replace trigger trg_lev_playbook_nd before delete on public.lev_playbook
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- hourly market log (immutable)
create table if not exists public.lev_hourly (
  id             uuid primary key default gen_random_uuid(),
  ts             timestamptz not null default now(),
  asset          text not null,
  price          numeric not null,
  bias           text check (bias in ('bullish','bearish','neutral','mixed')),
  htf_bias       text check (htf_bias in ('bullish','bearish','neutral','mixed')),
  regime         text,
  levels         jsonb not null default '{}'::jsonb,     -- support[], resistance[], breakout, invalidation, pdh, pdl, range
  indicators     jsonb not null default '{}'::jsonb,     -- atr, ema20/50, rsi, volume vs avg, funding…
  setups_forming jsonb not null default '[]'::jsonb,
  session        text check (session in ('core','off_hours')),
  note           text,
  thesis_id      text
);
create index if not exists lev_hourly_asset_ts_idx on public.lev_hourly (asset, ts desc);
alter table public.lev_hourly enable row level security;
create or replace trigger trg_lev_hourly_nu before update on public.lev_hourly
  for each row execute function public.moonbag_block_update();
create or replace trigger trg_lev_hourly_nd before delete on public.lev_hourly
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- risk config: leverage + test ceilings
alter table public.risk_config add column if not exists max_leverage numeric;
alter table public.risk_config add column if not exists max_margin_dollars numeric;
alter table public.risk_config add column if not exists min_confidence_grade integer;
alter table public.risk_config add column if not exists max_hold_days integer;
alter table public.risk_config add column if not exists max_fills_per_week integer;
alter table public.risk_config add column if not exists combined_max_loss_dollars numeric;
alter table public.risk_config add column if not exists soft_halt_equity numeric;
alter table public.risk_config add column if not exists one_symbol_per_day boolean not null default false;
alter table public.risk_config add column if not exists blocked_symbols jsonb not null default '[]'::jsonb;
alter table public.risk_config add column if not exists min_setup_score numeric;
alter table public.risk_config add column if not exists starting_equity numeric;

insert into public.risk_config (venue, risk_per_trade_pct, max_position_pct, max_open_positions,
  max_open_risk_pct, max_gross_exposure_pct, daily_loss_stop_pct, drawdown_stop_pct, losing_streak_len,
  auto_execute, allowed_instruments, max_leverage, max_margin_dollars, min_confidence_grade, max_hold_days, starting_equity)
values ('blofin', 2, 100, 1, 2, 100, 4, 15, 2, false,
  'BTC and ETH perpetuals only. One coin at a time. Stavros places every order manually. Alts only after the BTC/ETH track record proves out.',
  20, 50, 4, 3, 240)
on conflict (venue) do nothing;

-- ---------------------------------------------------------------- signals (every setup Moonbag calls, taken or not)
create table if not exists public.lev_signals (
  signal_id        text primary key,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  asset            text not null,
  direction        text not null check (direction in ('long','short')),
  setup_id         text not null references public.lev_playbook(setup_id),
  timeframe        text,
  thesis_id        text references public.daily_thesis(thesis_id),
  trigger_condition text,
  trigger_price    numeric,
  entry            numeric not null,
  stop             numeric not null,
  tp1              numeric not null,
  tp2              numeric,
  tp3              numeric,
  account_equity   numeric,
  risk_percent     numeric,
  risk_dollars     numeric,
  quantity         numeric,
  notional         numeric,
  leverage         numeric,
  margin           numeric,
  rr_tp1           numeric,
  confidence_score numeric not null check (confidence_score between 0 and 100),
  confidence_grade integer generated always as (
    case when confidence_score >= 85 then 5 when confidence_score >= 70 then 4
         when confidence_score >= 55 then 3 when confidence_score >= 40 then 2 else 1 end) stored,
  confidence_components jsonb not null default '{}'::jsonb,
  strategy_version integer,
  reasoning        text,
  evidence_against text,
  status           text not null default 'watching'
                     check (status in ('watching','armed','triggered','taken','skipped','expired','invalidated')),
  status_reason    text,
  armed_at         timestamptz,
  triggered_at     timestamptz,
  expires_at       timestamptz,
  alert_ids        jsonb not null default '[]'::jsonb,
  trade_id         text references public.trades(trade_id),
  -- what actually happened after the trigger, whether or not Stavros took it (paper result)
  outcome          text check (outcome in ('tp1','stop','timeout','not_triggered')),
  outcome_r        numeric,
  mfe_r            numeric,
  mae_r            numeric,
  resolved_at      timestamptz,
  lesson           text,
  constraint signal_id_format check (signal_id ~ '^MBS-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
create index if not exists lev_signals_status_idx on public.lev_signals (status, created_at desc);
create index if not exists lev_signals_asset_idx on public.lev_signals (asset, created_at desc);
alter table public.lev_signals enable row level security;

create or replace function public.moonbag_lev_signal_check()
returns trigger language plpgsql as $$
declare
  cfg public.risk_config;
  dist numeric;
  f text;
  frozen text[] := array['asset','direction','setup_id','entry','stop','tp1','tp2','tp3','quantity',
    'notional','leverage','margin','risk_dollars','risk_percent','confidence_score','confidence_components',
    'trigger_condition','trigger_price','account_equity','strategy_version'];
  once text[] := array['outcome','outcome_r','mfe_r','mae_r','resolved_at','armed_at','triggered_at','trade_id'];
  o jsonb; n jsonb;
begin
  new.asset := upper(new.asset);
  if tg_op = 'INSERT' then
    if new.signal_id is null then
      new.signal_id := public.moonbag_next_id('MBS', public.moonbag_today(), new.asset);
    end if;
    new.created_at := now();
  else
    o := to_jsonb(old); n := to_jsonb(new);
    if new.signal_id <> old.signal_id or new.created_at <> old.created_at then
      raise exception 'Signal identity is immutable.';
    end if;
    -- anti-hindsight: once a signal has left "watching", its plan and confidence are frozen
    if old.status <> 'watching' then
      foreach f in array frozen loop
        if (n -> f) is distinct from (o -> f) then
          raise exception 'Signal %: "%" is frozen once the signal is armed. Create a new signal instead.', old.signal_id, f;
        end if;
      end loop;
    end if;
    foreach f in array once loop
      if (o -> f) is not null and (o -> f) <> 'null'::jsonb and (n -> f) is distinct from (o -> f) then
        raise exception 'Signal %: "%" was already recorded and cannot be changed.', old.signal_id, f;
      end if;
    end loop;
    if old.status in ('skipped','expired','invalidated') and new.status is distinct from old.status then
      raise exception 'Signal % is already % (final).', old.signal_id, old.status;
    end if;
    new.updated_at := now();
  end if;

  -- geometry
  if new.direction = 'long' and not (new.stop < new.entry and new.tp1 > new.entry) then
    raise exception 'Long signal needs stop < entry < tp1.';
  end if;
  if new.direction = 'short' and not (new.stop > new.entry and new.tp1 < new.entry) then
    raise exception 'Short signal needs tp1 < entry < stop.';
  end if;
  dist := abs(new.entry - new.stop);
  new.rr_tp1 := round(abs(new.tp1 - new.entry) / dist, 2);

  -- BloFin risk box (only enforced once the signal is actionable)
  if new.status in ('armed','triggered','taken') then
    select * into cfg from public.risk_config where venue = 'blofin';
    if new.quantity is null or new.leverage is null or new.margin is null or new.account_equity is null then
      raise exception 'RISK: an armed signal needs account_equity, quantity, leverage and margin.';
    end if;
    new.risk_dollars := round(dist * new.quantity, 2);
    new.notional := round(new.entry * new.quantity, 2);
    new.risk_percent := round(100 * new.risk_dollars / new.account_equity, 2);
    if new.risk_percent > cfg.risk_per_trade_pct * 1.02 then
      raise exception 'RISK: signal risks % pct of the BloFin account (max %).', new.risk_percent, cfg.risk_per_trade_pct;
    end if;
    if new.leverage > cfg.max_leverage then
      raise exception 'RISK: leverage %x is above the %x cap. NO TRADE.', new.leverage, cfg.max_leverage;
    end if;
    if new.margin > cfg.max_margin_dollars * 1.02 then
      raise exception 'RISK: margin $% is above the $% cap.', new.margin, cfg.max_margin_dollars;
    end if;
    if new.rr_tp1 < 1.5 then
      raise exception 'RISK: reward to TP1 is only %R (minimum 1.5R).', new.rr_tp1;
    end if;
    if dist / new.entry >= (1 / new.leverage) * 0.8 then
      raise exception 'RISK: stop is too close to estimated liquidation at %x.', new.leverage;
    end if;
    if new.armed_at is null then new.armed_at := now(); end if;
  end if;
  if new.status = 'triggered' and new.triggered_at is null then new.triggered_at := now(); end if;
  if new.status = 'taken' and new.trade_id is null then
    raise exception 'A "taken" signal must link the trade_id.';
  end if;
  if new.outcome is not null and new.resolved_at is null then new.resolved_at := now(); end if;
  return new;
end $$;
create or replace trigger trg_lev_signal_check before insert or update on public.lev_signals
  for each row execute function public.moonbag_lev_signal_check();
create or replace trigger trg_lev_signal_nd before delete on public.lev_signals
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- backtests (immutable results)
create table if not exists public.backtests (
  backtest_id    uuid primary key default gen_random_uuid(),
  book           text not null check (book in ('leverage','robinhood')),
  setup_id       text,
  engine_code    text,
  asset          text not null,
  timeframe      text not null,
  period_start   timestamptz,
  period_end     timestamptz,
  params         jsonb not null default '{}'::jsonb,
  n_trades       integer not null default 0,
  wins           integer not null default 0,
  win_rate       numeric,
  avg_r          numeric,           -- expectancy per trade in R, after fees
  total_r        numeric,
  profit_factor  numeric,
  max_drawdown_r numeric,
  avg_bars_held  numeric,
  long_n integer, long_avg_r numeric, short_n integer, short_avg_r numeric,
  notes          text,
  run_by         text not null default 'claude',
  created_at     timestamptz not null default now()
);
create index if not exists backtests_setup_idx on public.backtests (setup_id, created_at desc);
alter table public.backtests enable row level security;
create or replace trigger trg_backtests_nu before update on public.backtests
  for each row execute function public.moonbag_block_update();
create or replace trigger trg_backtests_nd before delete on public.backtests
  for each row execute function public.moonbag_block_delete();

-- Rule-based backtest engine over stored 1h candles (aggregated to p_tf_hours).
-- Engines: breakout | sweep_reclaim | trend_pullback.
-- Params (all optional): lookback (20), atr_mult (1.5), rr (2), max_bars (72),
--   ema_fast (20), ema_slow (50), regime ('any'|'trend'|'range'), side ('both'|'long'|'short'),
--   with_trend (false), fee_rate (0.0006 per side), src_tf ('1h'; use '1d' for daily bars, e.g. equities —
--   then p_tf_hours counts days).
-- Conservative fills: entry at next bar open; if stop and target are both inside one bar, the stop is assumed first.
create or replace function public.lev_backtest(
  p_asset text, p_engine text, p_tf_hours integer default 1, p_params jsonb default '{}'::jsonb,
  p_from timestamptz default null, p_to timestamptz default null,
  p_save boolean default true, p_setup_id text default null, p_book text default 'leverage', p_notes text default null
) returns jsonb language plpgsql as $$
declare
  ts_a timestamptz[]; o_a numeric[]; h_a numeric[]; l_a numeric[]; c_a numeric[];
  n integer; i integer; k integer;
  lookback integer := coalesce((p_params->>'lookback')::int, 20);
  atr_mult numeric := coalesce((p_params->>'atr_mult')::numeric, 1.5);
  rr numeric := coalesce((p_params->>'rr')::numeric, 2);
  max_bars integer := coalesce((p_params->>'max_bars')::int, 72);
  ema_fast_n integer := coalesce((p_params->>'ema_fast')::int, 20);
  ema_slow_n integer := coalesce((p_params->>'ema_slow')::int, 50);
  regime text := coalesce(p_params->>'regime', 'any');
  side text := coalesce(p_params->>'side', 'both');
  with_trend boolean := coalesce((p_params->>'with_trend')::boolean, false);
  fee_rate numeric := coalesce((p_params->>'fee_rate')::numeric, 0.0006);
  src_tf text := coalesce(p_params->>'src_tf', '1h');
  unit integer := case when coalesce(p_params->>'src_tf', '1h') = '1d' then 86400 else 3600 end;
  tf_label text;
  ema_f numeric; ema_s numeric; atr numeric; tr numeric; kf numeric; ks numeric;
  hh numeric; ll numeric; is_trend boolean;
  sig text; entry numeric; stop numeric; tp numeric; dist numeric; r numeric; bars integer;
  busy_until integer := 0;
  n_tr integer := 0; n_win integer := 0; sum_r numeric := 0; gross_w numeric := 0; gross_l numeric := 0;
  eq numeric := 0; peak numeric := 0; maxdd numeric := 0; sum_bars integer := 0;
  ln integer := 0; lsum numeric := 0; sn integer := 0; ssum numeric := 0;
  res jsonb;
begin
  if p_engine not in ('breakout','sweep_reclaim','trend_pullback') then
    raise exception 'Unknown engine %', p_engine;
  end if;
  select array_agg(b.ts order by b.ts), array_agg(b.o order by b.ts), array_agg(b.h order by b.ts),
         array_agg(b.l order by b.ts), array_agg(b.c order by b.ts)
    into ts_a, o_a, h_a, l_a, c_a
    from (
      select to_timestamp(floor(extract(epoch from ts) / (unit * p_tf_hours)) * unit * p_tf_hours) as ts,
             (array_agg(o order by ts))[1] as o, max(h) as h, min(l) as l,
             (array_agg(c order by ts desc))[1] as c
        from public.candles
       where asset = upper(p_asset) and tf = src_tf
         and (p_from is null or ts >= p_from) and (p_to is null or ts <= p_to)
       group by 1
    ) b;
  tf_label := p_tf_hours || case when src_tf = '1d' then 'd' else 'h' end;
  n := coalesce(array_length(ts_a, 1), 0);
  if n < greatest(lookback, ema_slow_n) + 30 then
    return jsonb_build_object('error', 'not enough candles', 'bars', n);
  end if;

  kf := 2.0 / (ema_fast_n + 1); ks := 2.0 / (ema_slow_n + 1);
  ema_f := c_a[1]; ema_s := c_a[1]; atr := h_a[1] - l_a[1];

  for i in 2 .. n - 1 loop
    tr := greatest(h_a[i] - l_a[i], abs(h_a[i] - c_a[i-1]), abs(l_a[i] - c_a[i-1]));
    atr := atr + (tr - atr) / 14.0;
    ema_f := ema_f + kf * (c_a[i] - ema_f);
    ema_s := ema_s + ks * (c_a[i] - ema_s);
    if i <= greatest(lookback, ema_slow_n) or i <= busy_until or atr <= 0 then continue; end if;

    select max(x), min(y) into hh, ll
      from unnest(h_a[i - lookback : i - 1], l_a[i - lookback : i - 1]) as u(x, y);
    is_trend := abs(ema_f - ema_s) > 0.5 * atr;
    if regime = 'trend' and not is_trend then continue; end if;
    if regime = 'range' and is_trend then continue; end if;

    sig := null;
    if p_engine = 'breakout' then
      if c_a[i] > hh and c_a[i-1] <= hh then sig := 'long'; stop := c_a[i] - atr_mult * atr;
      elsif c_a[i] < ll and c_a[i-1] >= ll then sig := 'short'; stop := c_a[i] + atr_mult * atr; end if;
    elsif p_engine = 'sweep_reclaim' then
      if l_a[i] < ll and c_a[i] > ll then sig := 'long'; stop := l_a[i] - 0.25 * atr;
      elsif h_a[i] > hh and c_a[i] < hh then sig := 'short'; stop := h_a[i] + 0.25 * atr; end if;
    else -- trend_pullback
      if ema_f > ema_s and c_a[i] > ema_s and l_a[i] <= ema_f and c_a[i] > ema_f and c_a[i] > o_a[i] then
        sig := 'long'; stop := l_a[i] - 0.5 * atr;
      elsif ema_f < ema_s and c_a[i] < ema_s and h_a[i] >= ema_f and c_a[i] < ema_f and c_a[i] < o_a[i] then
        sig := 'short'; stop := h_a[i] + 0.5 * atr; end if;
    end if;
    if sig is null then continue; end if;
    if side <> 'both' and sig <> side then continue; end if;
    if with_trend and ((sig = 'long' and c_a[i] < ema_s) or (sig = 'short' and c_a[i] > ema_s)) then continue; end if;

    entry := o_a[i + 1];
    if sig = 'long' then
      if stop >= entry then continue; end if;
      dist := entry - stop; tp := entry + rr * dist;
    else
      if stop <= entry then continue; end if;
      dist := stop - entry; tp := entry - rr * dist;
    end if;
    if dist / entry < 0.001 then continue; end if;   -- stop unrealistically tight

    r := null; bars := 0;
    for k in i + 1 .. least(n, i + max_bars) loop
      bars := bars + 1;
      if sig = 'long' then
        if l_a[k] <= stop then r := -1; exit; elsif h_a[k] >= tp then r := rr; exit; end if;
      else
        if h_a[k] >= stop then r := -1; exit; elsif l_a[k] <= tp then r := rr; exit; end if;
      end if;
    end loop;
    if r is null then
      k := least(n, i + max_bars);
      r := case when sig = 'long' then (c_a[k] - entry) / dist else (entry - c_a[k]) / dist end;
    end if;
    r := r - (2 * fee_rate * entry) / dist;      -- fees in R
    busy_until := i + bars;                       -- one position at a time

    n_tr := n_tr + 1; sum_r := sum_r + r; sum_bars := sum_bars + bars;
    if r > 0 then n_win := n_win + 1; gross_w := gross_w + r; else gross_l := gross_l - r; end if;
    if sig = 'long' then ln := ln + 1; lsum := lsum + r; else sn := sn + 1; ssum := ssum + r; end if;
    eq := eq + r; if eq > peak then peak := eq; end if;
    if peak - eq > maxdd then maxdd := peak - eq; end if;
  end loop;

  res := jsonb_build_object(
    'asset', upper(p_asset), 'engine', p_engine, 'timeframe', tf_label, 'bars', n,
    'period_start', ts_a[1], 'period_end', ts_a[n], 'params', p_params,
    'n_trades', n_tr, 'wins', n_win,
    'win_rate', case when n_tr > 0 then round(100.0 * n_win / n_tr, 1) end,
    'avg_r', case when n_tr > 0 then round(sum_r / n_tr, 3) end,
    'total_r', round(sum_r, 2),
    'profit_factor', case when gross_l > 0 then round(gross_w / gross_l, 2) end,
    'max_drawdown_r', round(maxdd, 2),
    'avg_bars_held', case when n_tr > 0 then round(sum_bars::numeric / n_tr, 1) end,
    'long_n', ln, 'long_avg_r', case when ln > 0 then round(lsum / ln, 3) end,
    'short_n', sn, 'short_avg_r', case when sn > 0 then round(ssum / sn, 3) end);

  if p_save then
    insert into public.backtests (book, setup_id, engine_code, asset, timeframe, period_start, period_end, params,
      n_trades, wins, win_rate, avg_r, total_r, profit_factor, max_drawdown_r, avg_bars_held,
      long_n, long_avg_r, short_n, short_avg_r, notes)
    values (p_book, p_setup_id, p_engine, upper(p_asset), tf_label, ts_a[1], ts_a[n], p_params,
      n_tr, n_win, (res->>'win_rate')::numeric, (res->>'avg_r')::numeric, (res->>'total_r')::numeric,
      (res->>'profit_factor')::numeric, (res->>'max_drawdown_r')::numeric, (res->>'avg_bars_held')::numeric,
      ln, (res->>'long_avg_r')::numeric, sn, (res->>'short_avg_r')::numeric, p_notes);
  end if;
  return res;
end $$;

-- ---------------------------------------------------------------- paper trades (never a real order)
create table if not exists public.paper_trades (
  paper_id    text primary key,
  book        text not null check (book in ('leverage','robinhood')),
  symbol      text not null,
  direction   text not null check (direction in ('long','short')),
  setup_type  text,
  thesis      text,
  entry       numeric not null,
  stop        numeric not null,
  target      numeric,
  opened_at   timestamptz not null default now(),
  exit_price  numeric,
  closed_at   timestamptz,
  exit_reason text,
  r_multiple  numeric generated always as (
                case when exit_price is null or entry = stop then null
                     when direction = 'long' then round((exit_price - entry) / (entry - stop), 2)
                     else round((entry - exit_price) / (stop - entry), 2) end) stored,
  status      text not null default 'open' check (status in ('open','closed','cancelled')),
  notes       text,
  constraint paper_id_format check (paper_id ~ '^MBP-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
alter table public.paper_trades enable row level security;
create or replace function public.moonbag_paper_trade_check()
returns trigger language plpgsql as $$
begin
  new.symbol := upper(new.symbol);
  if tg_op = 'INSERT' then
    if new.paper_id is null then
      new.paper_id := public.moonbag_next_id('MBP', public.moonbag_today(), new.symbol);
    end if;
  else
    if new.paper_id <> old.paper_id or new.book <> old.book or new.symbol <> old.symbol or new.direction <> old.direction
       or new.entry <> old.entry or new.stop <> old.stop or new.target is distinct from old.target
       or new.opened_at <> old.opened_at then
      raise exception 'Paper trade % plan is immutable.', old.paper_id;
    end if;
    if old.status <> 'open' then
      raise exception 'Paper trade % is already % (final).', old.paper_id, old.status;
    end if;
    if new.status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;
  end if;
  return new;
end $$;
create or replace trigger trg_paper_trade_check before insert or update on public.paper_trades
  for each row execute function public.moonbag_paper_trade_check();
create or replace trigger trg_paper_trade_nd before delete on public.paper_trades
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- journal: one feedback line per close (immutable)
create table if not exists public.journal (
  id          uuid primary key default gen_random_uuid(),
  book        text not null check (book in ('leverage','robinhood')),
  kind        text not null check (kind in ('live','paper','signal','backtest','weekly')),
  ref         text,                 -- trade_id / paper_id / signal_id / backtest_id
  thesis      text not null,
  result      text not null,
  mistake     text,
  rule_change text,
  created_at  timestamptz not null default now()
);
create index if not exists journal_book_idx on public.journal (book, created_at desc);
alter table public.journal enable row level security;
create or replace trigger trg_journal_nu before update on public.journal
  for each row execute function public.moonbag_block_update();
create or replace trigger trg_journal_nd before delete on public.journal
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- Robinhood test ceilings (Operating direction 2026-10-03)
-- Runs in addition to the existing strategy + risk gates (name sorts between them).
create or replace function public.moonbag_check_handoff_ceilings()
returns trigger language plpgsql as $$
declare
  cfg public.risk_config;
  eq numeric; v_entry numeric; risk numeric; used numeric; fills integer; wk_start timestamptz; today_cnt integer;
begin
  if new.action <> 'open' or new.broker <> 'robinhood' then return new; end if;
  select * into cfg from public.risk_config where venue = 'robinhood';
  if cfg.blocked_symbols ? upper(new.symbol) then
    raise exception 'CEILING: % is on the never-trade list.', upper(new.symbol);
  end if;
  if cfg.min_setup_score is not null and coalesce(new.setup_score, 0) < cfg.min_setup_score then
    raise exception 'CEILING: live fills need an A setup (setup_score >= %). No B trades.', cfg.min_setup_score;
  end if;
  select equity into eq from public.account_snapshots where venue = 'robinhood' order by reported_at desc limit 1;
  if cfg.soft_halt_equity is not null and eq is not null and eq <= cfg.soft_halt_equity then
    raise exception 'CEILING: account equity $% is at or below the $% soft halt. No new positions.', eq, cfg.soft_halt_equity;
  end if;
  wk_start := date_trunc('week', now() at time zone 'America/Phoenix') at time zone 'America/Phoenix';
  if cfg.max_fills_per_week is not null then
    select count(*) into fills from (
      select trade_id from public.trades where venue = 'robinhood' and created_at >= wk_start and status <> 'cancelled'
      union all
      select handoff_id from public.handoffs where broker = 'robinhood' and action = 'open'
         and status in ('pending','acknowledged') and created_at >= wk_start) x;
    if fills >= cfg.max_fills_per_week then
      raise exception 'CEILING: already % fills/handoffs this week (max %).', fills, cfg.max_fills_per_week;
    end if;
  end if;
  if cfg.one_symbol_per_day then
    select count(*) into today_cnt from (
      select trade_id from public.trades where venue = 'robinhood' and status <> 'cancelled'
         and (created_at at time zone 'America/Phoenix')::date = public.moonbag_today()
      union all
      select handoff_id from public.handoffs where broker = 'robinhood' and action = 'open'
         and status in ('pending','acknowledged','executed')
         and (created_at at time zone 'America/Phoenix')::date = public.moonbag_today()) x;
    if today_cnt >= 1 then
      raise exception 'CEILING: one symbol a day — a position was already opened or handed off today.';
    end if;
  end if;
  if cfg.combined_max_loss_dollars is not null then
    v_entry := coalesce(new.limit_price, new.reference_price);
    risk := coalesce((v_entry - new.stop_price) * new.quantity, 0);
    select greatest(0, -coalesce(sum(realized_pnl), 0)) into used
      from public.trades where venue = 'robinhood' and status = 'closed';
    select used + coalesce(sum(greatest(0, (entry - coalesce(current_stop, stop)) * quantity)), 0) into used
      from public.trades where venue = 'robinhood' and status = 'open';
    select used + coalesce(sum(risk_dollars), 0) into used
      from public.handoffs where broker = 'robinhood' and action = 'open' and status in ('pending','acknowledged');
    if used + risk > cfg.combined_max_loss_dollars then
      raise exception 'CEILING: this stop does not fit the loss box — $% already used or at risk, this trade risks $%, box is $%.',
        round(used, 2), round(risk, 2), cfg.combined_max_loss_dollars;
    end if;
  end if;
  return new;
end $$;
create or replace trigger trg_handoff_rb_ceilings before insert on public.handoffs
  for each row execute function public.moonbag_check_handoff_ceilings();

-- ---------------------------------------------------------------- views
-- Is the confidence score honest? Realised results per confidence grade.
create or replace view public.v_lev_calibration with (security_invoker = true) as
select confidence_grade,
       count(*) filter (where outcome in ('tp1','stop','timeout'))          as resolved,
       count(*) filter (where outcome = 'tp1')                               as wins,
       round(100.0 * count(*) filter (where outcome = 'tp1')
             / nullif(count(*) filter (where outcome in ('tp1','stop','timeout')), 0), 1) as win_rate_pct,
       round(avg(outcome_r) filter (where outcome in ('tp1','stop','timeout')), 2) as avg_r,
       count(*) filter (where status = 'taken')                              as taken,
       count(*) filter (where outcome = 'not_triggered')                     as never_triggered,
       count(*)                                                              as signals
  from public.lev_signals
 group by confidence_grade;

-- Per-setup scoreboard: latest backtest + paper/live signal results.
create or replace view public.v_lev_setup_stats with (security_invoker = true) as
select p.setup_id, p.name, p.status, p.best_regime, p.engine_code,
       s.resolved, s.wins, s.win_rate_pct, s.avg_r as signal_avg_r, s.taken,
       b.n_trades as bt_trades, b.win_rate as bt_win_rate, b.avg_r as bt_avg_r,
       b.profit_factor as bt_profit_factor, b.max_drawdown_r as bt_max_dd_r,
       b.asset as bt_asset, b.timeframe as bt_timeframe, b.created_at as bt_run_at
  from public.lev_playbook p
  left join lateral (
    select count(*) filter (where outcome in ('tp1','stop','timeout')) as resolved,
           count(*) filter (where outcome = 'tp1') as wins,
           round(100.0 * count(*) filter (where outcome = 'tp1')
                 / nullif(count(*) filter (where outcome in ('tp1','stop','timeout')), 0), 1) as win_rate_pct,
           round(avg(outcome_r) filter (where outcome in ('tp1','stop','timeout')), 2) as avg_r,
           count(*) filter (where status = 'taken') as taken
      from public.lev_signals g where g.setup_id = p.setup_id) s on true
  left join lateral (
    select * from public.backtests bt where bt.setup_id = p.setup_id and bt.book = 'leverage'
     order by bt.n_trades desc, bt.created_at desc limit 1) b on true;

-- ---------------------------------------------------------------- security
revoke all on public.candles, public.lev_strategy, public.lev_playbook, public.lev_hourly, public.lev_signals,
              public.backtests, public.paper_trades, public.journal,
              public.v_lev_calibration, public.v_lev_setup_stats from anon, authenticated;
grant select, insert, update on public.candles, public.lev_strategy, public.lev_playbook, public.lev_hourly,
      public.lev_signals, public.backtests, public.paper_trades, public.journal to service_role;
grant select on public.v_lev_calibration, public.v_lev_setup_stats to service_role;
revoke execute on function public.lev_backtest(text, text, integer, jsonb, timestamptz, timestamptz, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.lev_backtest(text, text, integer, jsonb, timestamptz, timestamptz, boolean, text, text, text)
  to service_role;

-- ---------------------------------------------------------------- Robinhood test ceilings (values)
update public.risk_config set max_fills_per_week = 2, combined_max_loss_dollars = 12, soft_halt_equity = 90,
  one_symbol_per_day = true, blocked_symbols = '["VRF"]'::jsonb, min_setup_score = 8
 where venue = 'robinhood';
