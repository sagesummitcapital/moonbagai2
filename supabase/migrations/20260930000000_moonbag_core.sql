-- =============================================================================
-- Moonbag.ai — core trading-intelligence schema  (Master Spec v1.1)
--
-- HOW TO RUN (one time):
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--   It is safe to run again; it will not delete data.
--
-- Design rules enforced by the database itself (not just by the app):
--   • Published theses are immutable. Only their status can change.
--   • Corrections create a NEW version that "supersedes" the old one.
--   • Evaluations (grades) can never be edited or deleted.
--   • Trade plan fields (entry, original stop, targets, risk) are write-once.
--   • Nothing can be deleted from the history tables.
--   • Row Level Security is ON with no public policies: only the server
--     (service-role key) can read or write. The browser never talks to the DB.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Existing waitlist table (kept from the original schema.sql)
-- -----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);
alter table public.waitlist enable row level security;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Moonbag's "today" (user's local market day: America/Phoenix, no DST).
create or replace function public.moonbag_today()
returns date language sql stable as $$
  select (now() at time zone 'America/Phoenix')::date
$$;

-- Atomic, human-readable ID generator:  MB-2026-09-30-BTC-001
create table if not exists public.moonbag_id_counters (
  prefix     text not null,
  id_date    date not null,
  asset      text not null,
  last_value integer not null,
  primary key (prefix, id_date, asset)
);
alter table public.moonbag_id_counters enable row level security;

create or replace function public.moonbag_next_id(p_prefix text, p_date date, p_asset text)
returns text language plpgsql as $$
declare
  v integer;
  a text := upper(regexp_replace(coalesce(p_asset, 'GEN'), '[^A-Za-z0-9._]', '', 'g'));
begin
  insert into public.moonbag_id_counters as c (prefix, id_date, asset, last_value)
  values (p_prefix, p_date, a, 1)
  on conflict (prefix, id_date, asset) do update set last_value = c.last_value + 1
  returning last_value into v;
  return p_prefix || '-' || to_char(p_date, 'YYYY-MM-DD') || '-' || a || '-' || lpad(v::text, 3, '0');
end $$;

create or replace function public.moonbag_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.moonbag_block_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Moonbag history is immutable: deleting from % is not allowed. Change the status instead.', tg_table_name;
end $$;

create or replace function public.moonbag_block_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Moonbag history is immutable: rows in % cannot be edited.', tg_table_name;
end $$;

-- =============================================================================
-- 1. DAILY THESIS  (+ versioning via "supersedes")
-- =============================================================================
create table if not exists public.daily_thesis (
  thesis_id            text primary key,
  thesis_date          date not null default public.moonbag_today(),
  created_at           timestamptz not null default now(),
  asset                text not null,                       -- BTC, ETH, SPY, TSLA, MASTER, EQUITY …
  market               text not null check (market in ('crypto','equity','macro','commodity','fx','index')),
  time_horizon         text,
  bias                 text not null check (bias in ('bullish','bearish','neutral','mixed')),
  thesis_confidence    numeric check (thesis_confidence between 0 and 100),
  system_confidence    numeric check (system_confidence between 0 and 100),
  setup_score          numeric check (setup_score between 0 and 10),
  setup_grade          text generated always as (
                         case
                           when setup_score is null then null
                           when setup_score >= 9   then 'A+'
                           when setup_score >= 8   then 'A'
                           when setup_score >= 6.5 then 'B'
                           else 'C'
                         end) stored,
  market_regime        text,
  risk_environment     text,
  levels               jsonb not null default '{"support":[],"resistance":[],"breakout":null,"invalidation":null}'::jsonb,
  trade_plan           jsonb not null default '{}'::jsonb,   -- direction, entry_zone, stop, tp1..tp3
  primary_scenario     text,
  alternative_scenario text,
  what_changes_our_mind text,
  catalysts            jsonb not null default '[]'::jsonb,
  conditions_for_entry jsonb not null default '[]'::jsonb,
  conditions_to_cancel jsonb not null default '[]'::jsonb,
  reasoning            text,
  decision             text not null default 'watch' check (decision in ('trade','no_trade','watch')),
  supersedes           text references public.daily_thesis(thesis_id),
  change_reason        text,
  status               text not null default 'active'
                         check (status in ('active','superseded','expired','invalidated','cancelled')),
  status_changed_at    timestamptz,
  source               text not null default 'claude',
  constraint thesis_id_format check (thesis_id ~ '^MB-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$'),
  constraint supersede_needs_reason check (supersedes is null or coalesce(length(change_reason),0) > 0)
);

create index if not exists daily_thesis_date_idx   on public.daily_thesis (thesis_date desc);
create index if not exists daily_thesis_asset_idx  on public.daily_thesis (asset, thesis_date desc);
create index if not exists daily_thesis_status_idx on public.daily_thesis (status);
-- Safeguard against duplicates: only ONE active thesis per asset per day.
create unique index if not exists daily_thesis_one_active_per_asset_day
  on public.daily_thesis (thesis_date, asset) where status = 'active';

create or replace function public.moonbag_thesis_before_insert()
returns trigger language plpgsql as $$
declare
  old_row public.daily_thesis;
begin
  new.asset := upper(new.asset);
  if new.thesis_id is null then
    new.thesis_id := public.moonbag_next_id('MB', new.thesis_date, new.asset);
  end if;
  new.created_at := now();                 -- timestamps cannot be back-dated
  new.status := 'active';
  new.status_changed_at := null;

  if new.supersedes is not null then
    select * into old_row from public.daily_thesis where thesis_id = new.supersedes for update;
    if not found then
      raise exception 'supersedes: thesis % does not exist', new.supersedes;
    end if;
    if old_row.asset <> new.asset then
      raise exception 'supersedes: new version must be for the same asset (% vs %)', old_row.asset, new.asset;
    end if;
    if old_row.status <> 'active' then
      raise exception 'supersedes: thesis % is already %', old_row.thesis_id, old_row.status;
    end if;
    update public.daily_thesis
       set status = 'superseded', status_changed_at = now()
     where thesis_id = new.supersedes;
  end if;
  return new;
end $$;

create or replace function public.moonbag_thesis_before_update()
returns trigger language plpgsql as $$
begin
  -- (setup_grade is a generated column and is not yet computed inside BEFORE triggers)
  if (to_jsonb(new) - 'status' - 'status_changed_at' - 'setup_grade')
       is distinct from (to_jsonb(old) - 'status' - 'status_changed_at' - 'setup_grade') then
    raise exception 'Thesis % is published and immutable. Create a new version with "supersedes" instead.', old.thesis_id;
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'active' then
      raise exception 'Thesis % is already % and cannot change status again.', old.thesis_id, old.status;
    end if;
    new.status_changed_at := now();
  end if;
  return new;
end $$;

-- When a thesis stops being active, its live alerts become stale and its
-- pending Grok handoffs are cancelled.
create or replace function public.moonbag_thesis_after_status()
returns trigger language plpgsql as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    update public.alerts
       set status = 'stale',
           status_reason = 'Thesis ' || new.thesis_id || ' is now ' || new.status || ' — cancel in TradingView.'
     where thesis_id = new.thesis_id and status = 'active';
    update public.handoffs
       set status = 'cancelled',
           status_reason = 'Thesis ' || new.thesis_id || ' is now ' || new.status
     where thesis_id = new.thesis_id and status in ('pending','acknowledged');
  end if;
  return null;
end $$;

-- =============================================================================
-- 2. EVALUATIONS (forecast grading) — fully immutable
-- =============================================================================
create table if not exists public.thesis_evaluations (
  evaluation_id        text primary key,
  thesis_id            text not null unique references public.daily_thesis(thesis_id),
  evaluation_date      date not null default public.moonbag_today(),
  -- Component scores are 0–100. Leave one NULL if it truly does not apply
  -- (e.g. no targets were set); the total re-weights the remaining ones.
  direction_score      numeric check (direction_score    between 0 and 100),
  levels_score         numeric check (levels_score       between 0 and 100),
  setup_score          numeric check (setup_score        between 0 and 100),
  invalidation_score   numeric check (invalidation_score between 0 and 100),
  target_score         numeric check (target_score       between 0 and 100),
  total_score          numeric generated always as (
    case when
      (case when direction_score    is null then 0 else 0.30 end) +
      (case when levels_score       is null then 0 else 0.25 end) +
      (case when setup_score        is null then 0 else 0.20 end) +
      (case when invalidation_score is null then 0 else 0.15 end) +
      (case when target_score       is null then 0 else 0.10 end) = 0
    then null
    else round((
      coalesce(direction_score,0)*0.30 + coalesce(levels_score,0)*0.25 + coalesce(setup_score,0)*0.20 +
      coalesce(invalidation_score,0)*0.15 + coalesce(target_score,0)*0.10
    ) / (
      (case when direction_score    is null then 0 else 0.30 end) +
      (case when levels_score       is null then 0 else 0.25 end) +
      (case when setup_score        is null then 0 else 0.20 end) +
      (case when invalidation_score is null then 0 else 0.15 end) +
      (case when target_score       is null then 0 else 0.10 end)
    ), 2) end
  ) stored,
  setup_triggered      boolean,
  actual_result        jsonb not null default '{}'::jsonb,  -- OHLC, high/low, close, what price did
  what_worked          jsonb not null default '[]'::jsonb,
  what_failed          jsonb not null default '[]'::jsonb,
  error_type           text check (error_type in ('none','direction','timing','level','regime','execution','catalyst','other')),
  missed_information   text,
  overweighted_information text,
  lesson               text,
  methodology_change_warranted boolean not null default false,
  evaluated_at         timestamptz not null default now(),
  constraint evaluation_id_format check (evaluation_id ~ '^MBE-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
create index if not exists thesis_evaluations_date_idx on public.thesis_evaluations (evaluation_date desc);

create or replace function public.moonbag_evaluation_before_insert()
returns trigger language plpgsql as $$
declare
  t public.daily_thesis;
begin
  select * into t from public.daily_thesis where thesis_id = new.thesis_id;
  if not found then
    raise exception 'Evaluation references unknown thesis %', new.thesis_id;
  end if;
  new.evaluated_at := now();
  if new.evaluation_id is null then
    new.evaluation_id := public.moonbag_next_id('MBE', new.evaluation_date, t.asset);
  end if;
  return new;
end $$;

-- =============================================================================
-- 3. TRADINGVIEW ALERTS
-- =============================================================================
create table if not exists public.alerts (
  alert_id       text primary key,
  thesis_id      text not null references public.daily_thesis(thesis_id),
  tv_alert_id    bigint unique,                  -- TradingView's own numeric alert id
  asset          text not null,
  tv_symbol      text,                           -- e.g. BINANCE:BTCUSDT.P
  condition      text not null,                  -- e.g. price_reclaims_level, cross_up, cross_down
  trigger_price  numeric,
  direction      text check (direction in ('long','short','neutral')),
  action         text not null default 'REEVALUATE'
                   check (action in ('REEVALUATE','NOTIFY','ENTER','EXIT','CANCEL')),
  message        text,
  status         text not null default 'active'
                   check (status in ('active','triggered','stale','cancelled','expired')),
  status_reason  text,
  triggered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint alert_id_format check (alert_id ~ '^MBA-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
create index if not exists alerts_thesis_idx on public.alerts (thesis_id);
create index if not exists alerts_status_idx on public.alerts (status);

create or replace function public.moonbag_alert_before_insert()
returns trigger language plpgsql as $$
begin
  new.asset := upper(new.asset);
  if new.alert_id is null then
    new.alert_id := public.moonbag_next_id('MBA', public.moonbag_today(), new.asset);
  end if;
  if not exists (select 1 from public.daily_thesis where thesis_id = new.thesis_id and status = 'active') then
    raise exception 'Alerts can only be created for an ACTIVE thesis (%).', new.thesis_id;
  end if;
  new.created_at := now();
  return new;
end $$;

create or replace function public.moonbag_alert_before_update()
returns trigger language plpgsql as $$
begin
  if new.alert_id <> old.alert_id or new.thesis_id <> old.thesis_id or new.asset <> old.asset
     or new.condition <> old.condition or new.trigger_price is distinct from old.trigger_price
     or new.direction is distinct from old.direction or new.action <> old.action
     or new.created_at <> old.created_at then
    raise exception 'Alert % definition is immutable. Cancel it and create a new alert.', old.alert_id;
  end if;
  if old.tv_alert_id is not null and new.tv_alert_id is distinct from old.tv_alert_id then
    raise exception 'Alert % is already linked to TradingView alert %.', old.alert_id, old.tv_alert_id;
  end if;
  if new.status = 'triggered' and old.status <> 'triggered' and new.triggered_at is null then
    new.triggered_at := now();
  end if;
  return new;
end $$;

-- =============================================================================
-- 4. GROK HANDOFFS (Robinhood)
-- =============================================================================
create table if not exists public.handoffs (
  handoff_id           text primary key,
  thesis_id            text not null references public.daily_thesis(thesis_id),
  destination          text not null default 'grokbot',
  broker               text not null default 'robinhood',
  symbol               text not null,
  direction            text not null check (direction in ('long','short')),
  entry_condition      text,
  invalidation         text,
  target_framework     text,
  time_horizon         text,
  setup_score          numeric check (setup_score between 0 and 10),
  system_confidence    numeric check (system_confidence between 0 and 100),
  position_guidance    text,
  conditions_to_cancel jsonb not null default '[]'::jsonb,
  expires_at           timestamptz,
  status               text not null default 'pending'
                         check (status in ('pending','acknowledged','executed','rejected','cancelled','expired')),
  status_reason        text,
  grok_response        jsonb,                 -- anything Grok wants to say back (conflicts, notes)
  responded_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint handoff_id_format check (handoff_id ~ '^MBH-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
create index if not exists handoffs_status_idx on public.handoffs (status, created_at desc);
create index if not exists handoffs_thesis_idx on public.handoffs (thesis_id);

create or replace function public.moonbag_handoff_before_insert()
returns trigger language plpgsql as $$
begin
  new.symbol := upper(new.symbol);
  if new.handoff_id is null then
    new.handoff_id := public.moonbag_next_id('MBH', public.moonbag_today(), new.symbol);
  end if;
  if not exists (select 1 from public.daily_thesis where thesis_id = new.thesis_id and status = 'active') then
    raise exception 'Handoffs can only be created for an ACTIVE thesis (%).', new.thesis_id;
  end if;
  new.created_at := now();
  new.status := 'pending';
  return new;
end $$;

create or replace function public.moonbag_handoff_before_update()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'status' - 'status_reason' - 'grok_response' - 'responded_at' - 'updated_at')
       is distinct from
     (to_jsonb(old) - 'status' - 'status_reason' - 'grok_response' - 'responded_at' - 'updated_at') then
    raise exception 'Handoff % is immutable except for status/response. Create a new handoff instead.', old.handoff_id;
  end if;
  if old.status in ('executed','rejected','cancelled','expired') and new.status is distinct from old.status then
    raise exception 'Handoff % is already % (final).', old.handoff_id, old.status;
  end if;
  if new.status is distinct from old.status and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end $$;

-- =============================================================================
-- 5. TRADES / EXECUTION RECORDS  (Robinhood via Grok, BloFin manual)
-- =============================================================================
create table if not exists public.trades (
  trade_id          text primary key,
  thesis_id         text not null references public.daily_thesis(thesis_id),
  handoff_id        text references public.handoffs(handoff_id),
  venue             text not null check (venue in ('robinhood','blofin','other')),
  execution         text not null default 'manual' check (execution in ('manual','grokbot','other')),
  symbol            text not null,
  direction         text not null check (direction in ('long','short')),
  -- plan / sizing (write-once)
  account_equity    numeric,
  entry             numeric,
  stop              numeric,           -- ORIGINAL stop — used for R multiple, never moved
  current_stop      numeric,           -- trailing / managed stop (may change)
  tp1               numeric,
  tp2               numeric,
  tp3               numeric,
  target            numeric,
  quantity          numeric,
  position_value    numeric,
  portfolio_percent numeric,
  risk_dollars      numeric,
  risk_percent      numeric check (risk_percent is null or risk_percent <= 5),  -- hard 5% ceiling
  position_notional numeric,
  margin            numeric,
  leverage          numeric,
  estimated_costs   numeric,
  setup_score       numeric check (setup_score between 0 and 10),
  system_confidence numeric check (system_confidence between 0 and 100),
  opened_at         timestamptz,
  -- result (write-once)
  exit_price        numeric,
  closed_at         timestamptz,
  realized_pnl      numeric,
  fees              numeric,
  return_percent    numeric,
  holding_period    text,
  r_multiple        numeric generated always as (
                      case
                        when entry is null or stop is null or exit_price is null or entry = stop then null
                        when direction = 'long'  then round((exit_price - entry) / (entry - stop), 2)
                        else round((entry - exit_price) / (stop - entry), 2)
                      end) stored,
  -- execution quality (separate from forecast quality)
  execution_score   numeric check (execution_score between 0 and 100),
  execution_notes   text,
  status            text not null default 'pending' check (status in ('pending','open','closed','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint trade_id_format check (trade_id ~ '^MBT-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9._]+-[0-9]{3}$')
);
create index if not exists trades_status_idx on public.trades (status, created_at desc);
create index if not exists trades_thesis_idx on public.trades (thesis_id);
create index if not exists trades_venue_idx  on public.trades (venue);

create or replace function public.moonbag_trade_before_insert()
returns trigger language plpgsql as $$
begin
  new.symbol := upper(new.symbol);
  if new.trade_id is null then
    new.trade_id := public.moonbag_next_id('MBT', public.moonbag_today(), new.symbol);
  end if;
  if new.current_stop is null then new.current_stop := new.stop; end if;
  new.created_at := now();
  return new;
end $$;

create or replace function public.moonbag_trade_before_update()
returns trigger language plpgsql as $$
declare
  f text;
  write_once text[] := array['entry','stop','tp1','tp2','tp3','target','quantity','position_value',
    'portfolio_percent','risk_dollars','risk_percent','position_notional','margin','leverage',
    'account_equity','estimated_costs','setup_score','system_confidence','opened_at',
    'exit_price','closed_at','realized_pnl','fees','return_percent','holding_period'];
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  if new.trade_id <> old.trade_id or new.thesis_id <> old.thesis_id
     or new.handoff_id is distinct from old.handoff_id or new.venue <> old.venue
     or new.symbol <> old.symbol or new.direction <> old.direction or new.created_at <> old.created_at then
    raise exception 'Trade % identity fields are immutable.', old.trade_id;
  end if;
  foreach f in array write_once loop
    if (o -> f) is not null and (o -> f) <> 'null'::jsonb and (n -> f) is distinct from (o -> f) then
      raise exception 'Trade %: field "%" was already recorded and cannot be changed (anti-hindsight).', old.trade_id, f;
    end if;
  end loop;
  if old.status in ('closed','cancelled') and new.status is distinct from old.status then
    raise exception 'Trade % is already % (final).', old.trade_id, old.status;
  end if;
  if new.status = 'open'   and new.opened_at is null then new.opened_at := now(); end if;
  if new.status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;
  return new;
end $$;

-- =============================================================================
-- 6. SYSTEM STATE (rolling 30-day System Confidence)
-- =============================================================================
create table if not exists public.system_state (
  state_date            date primary key,
  system_confidence     numeric not null default 0,
  rolling_window_days   integer not null default 30,
  forecasts_graded      integer not null default 0,
  avg_total_score       numeric,
  direction_accuracy    numeric,
  level_accuracy        numeric,
  setup_accuracy        numeric,
  invalidation_accuracy numeric,
  target_accuracy       numeric,
  current_regime        text,
  risk_environment      text,
  computed_at           timestamptz not null default now()
);

-- System Confidence = average graded score over the last 30 days,
-- scaled by sample size so it only reaches full weight at 20 graded forecasts.
--   confidence = avg_total_score × min(1, forecasts_graded / 20)
-- With no graded history it is 0 (spec §6).
create or replace function public.moonbag_refresh_system_state(
  p_date date default null,
  p_regime text default null,
  p_risk_environment text default null
) returns public.system_state language plpgsql as $$
declare
  d date := coalesce(p_date, public.moonbag_today());
  r public.system_state;
  n integer; avg_t numeric; a_dir numeric; a_lvl numeric; a_set numeric; a_inv numeric; a_tgt numeric;
begin
  select count(e.total_score), avg(e.total_score), avg(e.direction_score), avg(e.levels_score),
         avg(e.setup_score), avg(e.invalidation_score), avg(e.target_score)
    into n, avg_t, a_dir, a_lvl, a_set, a_inv, a_tgt
    from public.thesis_evaluations e
    join public.daily_thesis t on t.thesis_id = e.thesis_id
   where t.thesis_date > d - 30 and t.thesis_date <= d
     and e.total_score is not null;

  insert into public.system_state as s (state_date, system_confidence, rolling_window_days, forecasts_graded,
      avg_total_score, direction_accuracy, level_accuracy, setup_accuracy, invalidation_accuracy,
      target_accuracy, current_regime, risk_environment, computed_at)
  values (d,
      case when n = 0 then 0 else round(avg_t * least(1.0, n / 20.0)) end,
      30, n, round(avg_t, 2), round(a_dir, 2), round(a_lvl, 2), round(a_set, 2), round(a_inv, 2), round(a_tgt, 2),
      p_regime, p_risk_environment, now())
  on conflict (state_date) do update set
      system_confidence     = excluded.system_confidence,
      forecasts_graded      = excluded.forecasts_graded,
      avg_total_score       = excluded.avg_total_score,
      direction_accuracy    = excluded.direction_accuracy,
      level_accuracy        = excluded.level_accuracy,
      setup_accuracy        = excluded.setup_accuracy,
      invalidation_accuracy = excluded.invalidation_accuracy,
      target_accuracy       = excluded.target_accuracy,
      current_regime        = coalesce(excluded.current_regime, s.current_regime),
      risk_environment      = coalesce(excluded.risk_environment, s.risk_environment),
      computed_at           = now()
  returning * into r;
  return r;
end $$;

create or replace function public.moonbag_evaluation_after_insert()
returns trigger language plpgsql as $$
begin
  perform public.moonbag_refresh_system_state(public.moonbag_today());
  return null;
end $$;

-- =============================================================================
-- 7. DAILY REPORTS (the "MOONBAG DAILY" markdown) — immutable
-- =============================================================================
create table if not exists public.daily_reports (
  report_id    uuid primary key default gen_random_uuid(),
  report_date  date not null default public.moonbag_today(),
  title        text,
  markdown     text not null,
  created_at   timestamptz not null default now()
);
create index if not exists daily_reports_date_idx on public.daily_reports (report_date desc, created_at desc);

-- =============================================================================
-- Triggers (drop + create so re-running this file is safe)
-- =============================================================================
drop trigger if exists trg_thesis_before_insert on public.daily_thesis;
create trigger trg_thesis_before_insert before insert on public.daily_thesis
  for each row execute function public.moonbag_thesis_before_insert();
drop trigger if exists trg_thesis_before_update on public.daily_thesis;
create trigger trg_thesis_before_update before update on public.daily_thesis
  for each row execute function public.moonbag_thesis_before_update();
drop trigger if exists trg_thesis_after_status on public.daily_thesis;
create trigger trg_thesis_after_status after update of status on public.daily_thesis
  for each row execute function public.moonbag_thesis_after_status();
drop trigger if exists trg_thesis_no_delete on public.daily_thesis;
create trigger trg_thesis_no_delete before delete on public.daily_thesis
  for each row execute function public.moonbag_block_delete();

drop trigger if exists trg_eval_before_insert on public.thesis_evaluations;
create trigger trg_eval_before_insert before insert on public.thesis_evaluations
  for each row execute function public.moonbag_evaluation_before_insert();
drop trigger if exists trg_eval_after_insert on public.thesis_evaluations;
create trigger trg_eval_after_insert after insert on public.thesis_evaluations
  for each statement execute function public.moonbag_evaluation_after_insert();
drop trigger if exists trg_eval_no_update on public.thesis_evaluations;
create trigger trg_eval_no_update before update on public.thesis_evaluations
  for each row execute function public.moonbag_block_update();
drop trigger if exists trg_eval_no_delete on public.thesis_evaluations;
create trigger trg_eval_no_delete before delete on public.thesis_evaluations
  for each row execute function public.moonbag_block_delete();

drop trigger if exists trg_alert_before_insert on public.alerts;
create trigger trg_alert_before_insert before insert on public.alerts
  for each row execute function public.moonbag_alert_before_insert();
drop trigger if exists trg_alert_before_update on public.alerts;
create trigger trg_alert_before_update before update on public.alerts
  for each row execute function public.moonbag_alert_before_update();
drop trigger if exists trg_alert_touch on public.alerts;
create trigger trg_alert_touch before update on public.alerts
  for each row execute function public.moonbag_touch_updated_at();
drop trigger if exists trg_alert_no_delete on public.alerts;
create trigger trg_alert_no_delete before delete on public.alerts
  for each row execute function public.moonbag_block_delete();

drop trigger if exists trg_handoff_before_insert on public.handoffs;
create trigger trg_handoff_before_insert before insert on public.handoffs
  for each row execute function public.moonbag_handoff_before_insert();
drop trigger if exists trg_handoff_before_update on public.handoffs;
create trigger trg_handoff_before_update before update on public.handoffs
  for each row execute function public.moonbag_handoff_before_update();
drop trigger if exists trg_handoff_touch on public.handoffs;
create trigger trg_handoff_touch before update on public.handoffs
  for each row execute function public.moonbag_touch_updated_at();
drop trigger if exists trg_handoff_no_delete on public.handoffs;
create trigger trg_handoff_no_delete before delete on public.handoffs
  for each row execute function public.moonbag_block_delete();

drop trigger if exists trg_trade_before_insert on public.trades;
create trigger trg_trade_before_insert before insert on public.trades
  for each row execute function public.moonbag_trade_before_insert();
drop trigger if exists trg_trade_before_update on public.trades;
create trigger trg_trade_before_update before update on public.trades
  for each row execute function public.moonbag_trade_before_update();
drop trigger if exists trg_trade_touch on public.trades;
create trigger trg_trade_touch before update on public.trades
  for each row execute function public.moonbag_touch_updated_at();
drop trigger if exists trg_trade_no_delete on public.trades;
create trigger trg_trade_no_delete before delete on public.trades
  for each row execute function public.moonbag_block_delete();

drop trigger if exists trg_report_no_update on public.daily_reports;
create trigger trg_report_no_update before update on public.daily_reports
  for each row execute function public.moonbag_block_update();
drop trigger if exists trg_report_no_delete on public.daily_reports;
create trigger trg_report_no_delete before delete on public.daily_reports
  for each row execute function public.moonbag_block_delete();

-- =============================================================================
-- Views (security_invoker so they respect RLS)
-- =============================================================================
create or replace view public.v_evaluation_detail with (security_invoker = true) as
select e.*,
       t.thesis_date, t.asset, t.market, t.bias, t.market_regime, t.setup_grade,
       t.setup_score as thesis_setup_score, t.thesis_confidence, t.decision,
       t.trade_plan ->> 'direction' as planned_direction
  from public.thesis_evaluations e
  join public.daily_thesis t on t.thesis_id = e.thesis_id;

-- Theses from before today that still need a grade (anti-cherry-picking).
create or replace view public.v_ungraded_theses with (security_invoker = true) as
select t.*
  from public.daily_thesis t
 where t.thesis_date < public.moonbag_today()
   and t.status <> 'cancelled'
   and not exists (select 1 from public.thesis_evaluations e where e.thesis_id = t.thesis_id);

-- =============================================================================
-- Security: RLS on, no public policies, no anon/authenticated access.
-- The Next.js server uses the service-role key (bypasses RLS) AFTER checking
-- Clerk login or an API key.
-- =============================================================================
alter table public.daily_thesis       enable row level security;
alter table public.thesis_evaluations enable row level security;
alter table public.alerts             enable row level security;
alter table public.handoffs           enable row level security;
alter table public.trades             enable row level security;
alter table public.system_state       enable row level security;
alter table public.daily_reports      enable row level security;

revoke all on public.daily_thesis, public.thesis_evaluations, public.alerts, public.handoffs,
              public.trades, public.system_state, public.daily_reports, public.moonbag_id_counters,
              public.v_evaluation_detail, public.v_ungraded_theses, public.waitlist
  from anon, authenticated;

grant select, insert, update on public.daily_thesis, public.thesis_evaluations, public.alerts,
      public.handoffs, public.trades, public.system_state, public.daily_reports,
      public.moonbag_id_counters, public.waitlist
  to service_role;
grant select on public.v_evaluation_detail, public.v_ungraded_theses to service_role;

revoke execute on function public.moonbag_next_id(text, date, text) from public, anon, authenticated;
revoke execute on function public.moonbag_refresh_system_state(date, text, text) from public, anon, authenticated;
grant  execute on function public.moonbag_next_id(text, date, text) to service_role;
grant  execute on function public.moonbag_refresh_system_state(date, text, text) to service_role;

-- Seed today's system state (0 / 100 — no verified history yet).
select public.moonbag_refresh_system_state();
