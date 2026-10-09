-- 2026-10-09 (Stavros): org chart for agents, run log (token-saving quiet runs), X posts for Grok,
-- and multiple positions (one per coin, max 2 open, 15% combined open risk).

-- 1) MULTI-POSITION RISK ------------------------------------------------------------------------
update public.risk_config
   set max_open_positions = 2,
       max_open_risk_pct  = 15,
       allowed_instruments = 'BTC and ETH perpetuals (core) plus the in-play rotation coins in lev_universe. One trade per coin, at most 2 open at once, combined open risk to the stops at most 15% of the account. Isolated margin. Stavros places every order manually.',
       updated_at = now()
 where venue = 'blofin';

-- 2) AGENT ORG CHART ------------------------------------------------------------------------------
alter table public.agents add column if not exists parent_id text;
alter table public.agents add column if not exists tasks jsonb not null default '[]'::jsonb;
alter table public.agents add column if not exists scheduled_task text;

-- Every scheduled run writes ONE row here (per agent that ran), so the dashboard can show who worked,
-- who skipped because nothing needed doing (quiet = tokens saved), and what each handed off to whom.
create table if not exists public.agent_runs (
  id          bigint generated always as identity primary key,
  agent_id    text not null,
  started_at  timestamptz not null default now(),
  mode        text not null check (mode in ('quiet', 'work', 'error')),
  coins       text[],
  summary     text,
  handed_to   text[]
);
create index if not exists agent_runs_time on public.agent_runs (started_at desc);
create index if not exists agent_runs_agent on public.agent_runs (agent_id, started_at desc);

-- 3) X POSTS FOR GROK ---------------------------------------------------------------------------
-- Templates are filled by the website (lib/moonbag/xposts.ts), never free-written by a model.
create table if not exists public.x_posts (
  post_id     text primary key,
  kind        text not null check (kind in ('morning_brief', 'trade_open', 'trade_update', 'trade_close')),
  ref         text,                     -- trade_id or brief date
  text        text not null,
  status      text not null default 'pending' check (status in ('pending', 'posted', 'skipped')),
  post_url    text,
  created_at  timestamptz not null default now(),
  posted_at   timestamptz
);
create unique index if not exists x_posts_once on public.x_posts (kind, ref);
create index if not exists x_posts_pending on public.x_posts (status, created_at);

-- 4) THE ROSTER: heads → agents → tasks ---------------------------------------------------------
insert into public.agents (agent_id, name, role, book, cadence, runs_in, inputs, outputs, sort, parent_id, tasks, scheduled_task) values
 ('desk_lead', 'Desk Lead', 'Head of the leverage desk. Runs a cheap check every hour and only wakes the agents a coin actually needs.', 'leverage', 'Every 1h close (:25)', 'Moonbag Desk Lead (hourly)', 'Prices, fired alerts, open trades', 'agent_runs, hand-offs', 0, null,
  '[{"task":"Sentinel check: anything to do for any coin?","when":"every hour"},{"task":"Hand each coin that needs work to the right agent","when":"when something changed"},{"task":"Log the run as quiet or work","when":"every hour"}]', 'Moonbag Desk Lead (hourly)')
on conflict (agent_id) do nothing;
insert into public.agents (agent_id, name, role, book, cadence, runs_in, inputs, outputs, sort) values
 ('publisher', 'Publisher', 'Fills the X post templates (morning brief, trade opened/closed) for Grok to post', 'both', 'Morning brief + every trade', 'Website templates → Grok', 'Brief, trades', 'x_posts', 12)
on conflict (agent_id) do nothing;

update public.agents a set parent_id = v.parent, tasks = v.tasks::jsonb, scheduled_task = v.st, sort = v.sort, cadence = v.cad, runs_in = v.runs from (values
 ('strategist',   null,         1,  'Daily 5:50 AM', 'Moonbag daily cycle', 'Moonbag daily cycle',
  '[{"task":"Grade yesterday''s theses and trades","when":"daily"},{"task":"Write today''s theses and the morning brief","when":"daily"},{"task":"Issue Robinhood handoffs (A/B setups only)","when":"weekdays"}]'),
 ('desk_lead',    null,         2,  'Every 1h close (:25)', 'Moonbag Desk Lead (hourly)', 'Moonbag Desk Lead (hourly)',
  '[{"task":"Sentinel check: anything to do for any coin?","when":"every hour"},{"task":"Hand each coin that needs work to the right agent","when":"when something changed"},{"task":"Log the run as quiet or work","when":"every hour"}]'),
 ('auditor',      null,         3,  'Saturday 6:29 + 6:59 AM', 'Moonbag weekly C-setup review + weekly strategy review', 'Moonbag weekly strategy review',
  '[{"task":"C-setup review","when":"Saturday"},{"task":"Backtests, calibration, R:R buckets, leverage, rotation","when":"Saturday"},{"task":"Publish strategy changes to MOONBAG_STRATEGY.md","when":"on evidence"}]'),
 ('scout',        'desk_lead',  10, 'Every 4h close (:12)', 'Moonbag Scout (4h)', 'Moonbag Scout (4h)',
  '[{"task":"Rank ~25 coins vs BTC (1M, confirmed by 3M)","when":"every 4h"},{"task":"Re-pick the top 5 rotation coins","when":"daily close"},{"task":"Pick up to 2 coins in play","when":"every 4h"}]'),
 ('cartographer', 'desk_lead',  11, 'Every 4h close + when price nears a line', 'Moonbag Desk Lead (hourly)', null,
  '[{"task":"Set each coin''s range: range high + range low (2 lines)","when":"every 4h close or after a break"},{"task":"Keep one TradingView alert per line, with the play in the message","when":"always"}]'),
 ('gate',         'desk_lead',  12, 'When a line is hit', 'Moonbag Desk Lead (hourly)', null,
  '[{"task":"Check validation on closed 1h candles","when":"after a line is hit"},{"task":"Score 0–100 + 8-point checklist","when":"after validation"},{"task":"Hand a DESK ALERT to the Risk Officer, or send NO TRADE","when":"after scoring"}]'),
 ('risk_officer', 'desk_lead',  13, 'When the Gate passes a play', 'Moonbag Desk Lead (hourly)', null,
  '[{"task":"Size to the risk tier and the open-risk budget (max 2 trades, 15%)","when":"per trade"},{"task":"Pick leverage inside the ceiling","when":"per trade"},{"task":"Send the BloFin order card","when":"per trade"}]'),
 ('exit_clerk',   'desk_lead',  14, 'While a trade is open', 'Moonbag Desk Lead (hourly)', null,
  '[{"task":"Swap that coin''s 2 lines/alerts to stop + next target","when":"trade opened"},{"task":"TP1 → stop to entry, trail the runner","when":"while open"},{"task":"72h time stop; restore the range lines after close","when":"while open / closed"}]'),
 ('publisher',    'strategist', 15, 'Morning brief + every trade', 'Website templates → Grok', null,
  '[{"task":"Morning brief X post","when":"daily, after 6 AM"},{"task":"Trade opened / closed X posts","when":"when Grok records a BloFin trade"}]'),
 ('level_watch',  'strategist', 20, 'Weekdays 6:45 / 9:45 / 1:45', 'Moonbag intraday level check', 'Moonbag intraday level check',
  '[{"task":"Check Robinhood setups against their levels","when":"market hours"}]'),
 ('executor',     'strategist', 21, 'On a handoff', 'Grok / RockBot', null,
  '[{"task":"Place Robinhood orders inside the limits","when":"on handoff"},{"task":"Record fills and BloFin trades you report","when":"on trade"},{"task":"Post the X posts","when":"when pending"}]'),
 ('coach',        'auditor',    30, 'Every 3h (only when a trade is 24h old)', 'Moonbag 24h trade lookback', 'Moonbag 24h trade lookback',
  '[{"task":"24-hour lookback on each closed trade","when":"24h after close"},{"task":"Score your own calls with the rubric","when":"after close"}]'),
 ('stavros',      null,         40, 'When he decides', 'You', null,
  '[{"task":"Place every BloFin order","when":"on an order card or own read"},{"task":"Tell Grok what you took (Moonbag alert or own call)","when":"after entry"}]')
) v(id, parent, sort, cad, runs, st, tasks) where a.agent_id = v.id;

-- Run log joins the activity feed.
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
select 'stavros', created_at, symbol, trade_id || ' · ' || direction || ' · ' || coalesce(origin, 'untagged') || ' · ' || status from public.trades where venue = 'blofin'
union all
select 'publisher', created_at, ref, kind || ' · ' || status from public.x_posts
union all
select agent_id, started_at, array_to_string(coins, ','), mode || coalesce(' · ' || summary, '') || coalesce(' → ' || array_to_string(handed_to, ', '), '') from public.agent_runs;
