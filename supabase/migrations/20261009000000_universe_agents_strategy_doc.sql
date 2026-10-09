-- 2026-10-09 (Stavros): rotation coins, flexible leverage, one strategy file, agents tab.

-- 1) COIN UNIVERSE ----------------------------------------------------------------------------
-- core = BTC/ETH (always watched). rotation = the top 5 coins the market is rotating into, re-ranked
-- by the Scout every daily close (relative strength vs BTC over 1 month, confirmed over 3 months, liquid
-- perps on BloFin). bench = ranked but not in the top 5.
create table if not exists public.lev_universe (
  asset          text primary key,
  tier           text not null check (tier in ('core', 'rotation', 'bench')),
  tv_symbol      text not null,
  blofin_symbol  text not null,
  max_leverage   numeric not null check (max_leverage between 1 and 20),
  rank           int,
  rs_1m_vs_btc   numeric,
  rs_3m_vs_btc   numeric,
  in_play        boolean not null default false,  -- rotation coin currently strong enough to get level plays
  reason         text,
  updated_at     timestamptz not null default now()
);

create table if not exists public.rotation_scans (
  id            bigint generated always as identity primary key,
  scanned_at    timestamptz not null default now(),
  asset         text not null,
  close         numeric,
  perf_1m       numeric,
  perf_3m       numeric,
  rs_1m_vs_btc  numeric,
  rs_3m_vs_btc  numeric,
  rank          int,
  tier          text,
  in_play       boolean,
  note          text
);
create index if not exists rotation_scans_time on public.rotation_scans (scanned_at desc);

insert into public.lev_universe (asset, tier, tv_symbol, blofin_symbol, max_leverage, rank, rs_1m_vs_btc, rs_3m_vs_btc, reason) values
  ('BTC',  'core',     'BINANCE:BTCUSDT.P',  'BTC-USDT',  20, null, 0,      0,      'Core'),
  ('ETH',  'core',     'BINANCE:ETHUSDT.P',  'ETH-USDT',  20, null, -4.9,   10.0,   'Core'),
  ('NEAR', 'rotation', 'BINANCE:NEARUSDT.P', 'NEAR-USDT', 10, 1,    102.3,  125.9,  'Seed list 2026-10-09: +108% 1M vs BTC +5%'),
  ('ENA',  'rotation', 'BINANCE:ENAUSDT.P',  'ENA-USDT',  10, 2,    30.0,   137.3,  'Seed list 2026-10-09'),
  ('SUI',  'rotation', 'BINANCE:SUIUSDT.P',  'SUI-USDT',  10, 3,    25.3,   14.6,   'Seed list 2026-10-09'),
  ('AAVE', 'rotation', 'BINANCE:AAVEUSDT.P', 'AAVE-USDT', 10, 4,    24.4,   45.8,   'Seed list 2026-10-09'),
  ('AVAX', 'rotation', 'BINANCE:AVAXUSDT.P', 'AVAX-USDT', 10, 5,    24.0,   24.9,   'Seed list 2026-10-09'),
  ('LTC',  'bench',    'BINANCE:LTCUSDT.P',  'LTC-USDT',  10, 6,    12.2,   13.8,   'Seed list 2026-10-09'),
  ('SOL',  'bench',    'BINANCE:SOLUSDT.P',  'SOL-USDT',  10, 7,    1.2,    12.2,   'Seed list 2026-10-09')
on conflict (asset) do nothing;

-- Alerts for rotation coins have no daily thesis row.
alter table public.alerts alter column thesis_id drop not null;

-- 2) FLEXIBLE LEVERAGE -------------------------------------------------------------------------
-- Leverage is chosen per trade (grade, coin, volatility); the DB keeps only the hard ceilings:
-- risk_config.max_leverage (Stavros's 20x) and the coin's max_leverage in lev_universe.
create or replace function public.moonbag_lev_leverage_cap(p_asset text) returns numeric
language sql stable as $$
  select least(
    (select max_leverage from public.risk_config where venue = 'blofin'),
    coalesce((select max_leverage from public.lev_universe where asset = upper(p_asset)), 10)
  );
$$;

-- 3) STRATEGY FILE (source of truth) ----------------------------------------------------------
create table if not exists public.strategy_doc (
  version        int primary key,
  status         text not null default 'active' check (status in ('active', 'superseded')),
  markdown       text not null,
  change_reason  text,
  created_at     timestamptz not null default now()
);
create or replace function public.strategy_doc_supersede() returns trigger language plpgsql as $$
begin
  if new.status = 'active' then
    update public.strategy_doc set status = 'superseded' where status = 'active' and version <> new.version;
  end if;
  return new;
end $$;
create trigger strategy_doc_supersede after insert on public.strategy_doc for each row execute function public.strategy_doc_supersede();

-- 4) AGENTS -----------------------------------------------------------------------------------
create table if not exists public.agents (
  agent_id    text primary key,
  name        text not null,
  role        text not null,
  book        text not null check (book in ('leverage', 'robinhood', 'both')),
  cadence     text not null,
  runs_in     text not null,          -- which scheduled task / actor does the work
  inputs      text,
  outputs     text,
  sort        int not null default 0
);
insert into public.agents (agent_id, name, role, book, cadence, runs_in, inputs, outputs, sort) values
 ('strategist',   'Strategist',    'Writes the daily theses (master, BTC/ETH, equities), the morning brief and Robinhood handoffs', 'both', 'Daily 5:50 AM', 'Moonbag daily cycle', 'Markets, news, yesterday''s grades', 'daily_thesis, morning brief, handoffs', 1),
 ('scout',        'Scout',         'Ranks the rotation coins against BTC and picks the top 5', 'leverage', 'Daily close + every 4h close', 'Moonbag leverage desk (hourly)', 'TradingView prices for the coin list', 'lev_universe, rotation_scans', 2),
 ('cartographer', 'Cartographer',  'Maps 4h/daily levels and keeps 2 level plays per coin in TradingView', 'leverage', 'Every 1h close', 'Moonbag leverage desk (hourly)', 'Candles, levels', 'lev_hourly, level-play alerts', 3),
 ('gate',         'Gate',          'Scores each play (0–100) and runs the 8-point checklist after validation', 'leverage', 'Every 1h close', 'Moonbag leverage desk (hourly)', 'Validated plays, track record', 'lev_signals (DESK ALERT / NO TRADE)', 4),
 ('risk_officer', 'Risk Officer',  'Sizes the trade, picks leverage and writes the BloFin order card', 'leverage', 'When a play validates', 'Moonbag leverage desk (hourly)', 'Balance, risk tiers, coin caps', 'TAKE TRADE NOW order card', 5),
 ('exit_clerk',   'Exit Clerk',    'Manages open trades: stop/target alerts, TP1 → breakeven, trailing, 72h time stop', 'leverage', 'Every 1h close while a trade is open', 'Moonbag leverage desk (hourly)', 'Open trades, live stop/targets', 'Exit alerts, trade updates', 6),
 ('level_watch',  'Level Watch',   'Checks Robinhood setups against their levels during market hours', 'robinhood', 'Weekdays 6:45 / 9:45 / 1:45', 'Moonbag intraday level check', 'Equity theses, prices', 'Handoff updates', 7),
 ('executor',     'Executor (RockBot)', 'Places Robinhood orders inside the limits and records fills; relays the brief', 'robinhood', 'On handoff', 'Grok / RockBot', 'Handoffs', 'trades, account snapshots', 8),
 ('coach',        'Coach',         '24-hour lookback on every closed trade, Moonbag vs your calls', 'both', 'Every 3h', 'Moonbag 24h trade lookback', 'Closed trades, price after', 'trade_lookbacks, weekly coaching', 9),
 ('auditor',      'Auditor',       'Weekly review: backtests, calibration, R:R buckets, C setups, strategy changes', 'both', 'Saturday 6:29 + 6:59 AM', 'Moonbag weekly C-setup review + weekly strategy review', 'Signals, trades, backtests', 'Strategy versions, weekly report', 10),
 ('stavros',      'Stavros',       'Places every BloFin order; makes his own calls too', 'leverage', 'When he decides', 'You', 'Order cards, level plays', 'BloFin trades', 11)
on conflict (agent_id) do nothing;

-- What each agent did, from the records it writes. No extra logging needed.
create or replace view public.v_agent_activity as
select 'cartographer'::text as agent_id, ts as at, asset as subject, coalesce(note, '') as detail from public.lev_hourly
union all
select 'gate', created_at, asset, signal_id || ' · ' || direction || ' · ' || coalesce(confidence_score::text, '?') || '/100 · ' || status from public.lev_signals
union all
select 'risk_officer', coalesce(triggered_at, armed_at), asset, signal_id || ' · risk ' || coalesce(risk_percent::text, '?') || '% · ' || coalesce(leverage::text, '?') || 'x' from public.lev_signals where status in ('triggered', 'taken') and coalesce(triggered_at, armed_at) is not null
union all
select 'exit_clerk', created_at, asset, coalesce(action, '') || ' · ' || coalesce(trigger_price::text, '') from public.alerts where action = 'EXIT'
union all
select 'scout', scanned_at, asset, 'rank ' || coalesce(rank::text, '–') || ' · RS 1M ' || coalesce(round(rs_1m_vs_btc, 1)::text, '?') || '%' || case when in_play then ' · in play' else '' end from public.rotation_scans
union all
select 'coach', created_at, symbol, coalesce(verdict, '') || ' · ' || coalesce(r_realized::text, '?') || 'R' from public.trade_lookbacks
union all
select case when title ilike 'MOONBAG WEEKLY%' or title ilike '%C-SETUP%' or title ilike 'MOONBAG TRADE COACHING%' then 'auditor' else 'strategist' end,
       created_at, null::text, coalesce(title, '') from public.daily_reports
union all
select 'executor', created_at, symbol, trade_id || ' · ' || direction || ' · ' || status from public.trades where venue = 'robinhood'
union all
select 'stavros', created_at, symbol, trade_id || ' · ' || direction || ' · ' || coalesce(origin, 'untagged') || ' · ' || status from public.trades where venue = 'blofin';

-- Per-coin leverage ceiling in the signal check (applied 2026-10-09 by rewriting the function body):
--   if new.leverage > public.moonbag_lev_leverage_cap(new.asset) then raise exception ...
-- moonbag_lev_signal_check() now uses moonbag_lev_leverage_cap(asset) instead of risk_config.max_leverage.
