-- =============================================================================
-- Moonbag — Robinhood auto-trading via Grok, with database-enforced risk limits
-- and a win/loss learning loop.  (User decisions 2026-09-30: whole account,
-- 1% risk per trade, stocks/ETFs + 1x inverse ETFs, Grok auto-executes.)
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------- risk config
create table if not exists public.risk_config (
  venue                  text primary key,
  risk_per_trade_pct     numeric not null,   -- max loss if stop is hit, % of equity
  max_position_pct       numeric not null,   -- max position value, % of equity
  max_open_positions     integer not null,   -- open trades + pending open-handoffs
  max_open_risk_pct      numeric not null,   -- total open risk to stops, % of equity
  max_gross_exposure_pct numeric not null,   -- total invested, % of equity (no margin)
  daily_loss_stop_pct    numeric not null,   -- no new positions after this realized loss today
  drawdown_stop_pct      numeric not null,   -- no new positions if equity this far below 30-day peak
  losing_streak_len      integer not null,   -- after N straight losses, risk is halved
  auto_execute           boolean not null default true,
  allowed_instruments    text not null,
  updated_at             timestamptz not null default now()
);
insert into public.risk_config (venue, risk_per_trade_pct, max_position_pct, max_open_positions,
  max_open_risk_pct, max_gross_exposure_pct, daily_loss_stop_pct, drawdown_stop_pct, losing_streak_len,
  auto_execute, allowed_instruments)
values ('robinhood', 1, 20, 6, 5, 80, 3, 8, 3, true,
  'US stocks and ETFs (price >= $5, avg volume >= 1M) and 1x inverse ETFs (SH, PSQ, DOG, RWM) for bearish views. Long-only positions. No options, no margin, no leveraged ETFs.')
on conflict (venue) do nothing;
alter table public.risk_config enable row level security;

-- ---------------------------------------------------------------- account snapshots
create table if not exists public.account_snapshots (
  snapshot_id  uuid primary key default gen_random_uuid(),
  venue        text not null check (venue in ('robinhood','blofin')),
  equity       numeric not null check (equity > 0),
  cash         numeric,
  buying_power numeric,
  positions    jsonb not null default '[]'::jsonb,
  reported_by  text not null default 'grok',
  reported_at  timestamptz not null default now()
);
create index if not exists account_snapshots_venue_idx on public.account_snapshots (venue, reported_at desc);
alter table public.account_snapshots enable row level security;
drop trigger if exists trg_snapshot_no_update on public.account_snapshots;
create trigger trg_snapshot_no_update before update on public.account_snapshots
  for each row execute function public.moonbag_block_update();
drop trigger if exists trg_snapshot_no_delete on public.account_snapshots;
create trigger trg_snapshot_no_delete before delete on public.account_snapshots
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- trades: tags
alter table public.trades add column if not exists setup_type  text;
alter table public.trades add column if not exists horizon     text check (horizon in ('swing','position'));
alter table public.trades add column if not exists exit_reason text
  check (exit_reason in ('target','stop','trailing_stop','invalidation','time','thesis_change','manual','risk_limit'));

-- ---------------------------------------------------------------- handoffs: executable orders
alter table public.handoffs add column if not exists action text not null default 'open'
  check (action in ('open','close','trim','adjust_stop'));
alter table public.handoffs add column if not exists trade_id text references public.trades(trade_id);
alter table public.handoffs add column if not exists order_type text check (order_type in ('market','limit'));
alter table public.handoffs add column if not exists limit_price numeric;
alter table public.handoffs add column if not exists reference_price numeric;
alter table public.handoffs add column if not exists stop_price numeric;
alter table public.handoffs add column if not exists target_1 numeric;
alter table public.handoffs add column if not exists target_2 numeric;
alter table public.handoffs add column if not exists quantity numeric;
alter table public.handoffs add column if not exists risk_dollars numeric;
alter table public.handoffs add column if not exists account_equity_basis numeric;
alter table public.handoffs add column if not exists setup_type text;
alter table public.handoffs add column if not exists horizon text check (horizon in ('swing','position'));
alter table public.handoffs add column if not exists max_hold_days integer;

-- Open-handoffs need an ACTIVE thesis; close/trim/adjust handoffs need an OPEN trade.
create or replace function public.moonbag_handoff_before_insert()
returns trigger language plpgsql as $$
declare
  t public.trades;
begin
  new.symbol := upper(new.symbol);
  if new.action <> 'open' then
    select * into t from public.trades where trade_id = new.trade_id;
    if not found or t.status <> 'open' then
      raise exception '% handoff needs trade_id of an OPEN trade.', new.action;
    end if;
    new.thesis_id := t.thesis_id;
    new.symbol := t.symbol;
  elsif not exists (select 1 from public.daily_thesis where thesis_id = new.thesis_id and status = 'active') then
    raise exception 'Open handoffs can only be created for an ACTIVE thesis (%).', new.thesis_id;
  end if;
  if new.handoff_id is null then
    new.handoff_id := public.moonbag_next_id('MBH', public.moonbag_today(), new.symbol);
  end if;
  new.created_at := now();
  new.status := 'pending';
  return new;
end $$;

-- A superseded thesis cancels only its pending OPEN handoffs (never exits/stop moves).
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
     where thesis_id = new.thesis_id and status in ('pending','acknowledged') and action = 'open';
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------- risk gate
create or replace function public.moonbag_check_handoff_risk()
returns trigger language plpgsql as $$
declare
  cfg public.risk_config;
  eq numeric; snap_at timestamptz; peak numeric;
  v_entry numeric; risk numeric; value numeric; risk_limit numeric;
  open_cnt integer; open_risk numeric; gross numeric; day_pnl numeric; streak integer;
begin
  if new.action <> 'open' or new.broker <> 'robinhood' then
    return new;
  end if;
  select * into cfg from public.risk_config where venue = 'robinhood';
  select equity, reported_at into eq, snap_at
    from public.account_snapshots where venue = 'robinhood' order by reported_at desc limit 1;
  if eq is null or snap_at < now() - interval '3 days' then
    raise exception 'RISK: no fresh Robinhood account snapshot (Grok must POST /accounts first).';
  end if;
  if new.direction <> 'long' then
    raise exception 'RISK: Robinhood positions are long-only. Express bearish views with a 1x inverse ETF (direction long).';
  end if;
  v_entry := coalesce(new.limit_price, new.reference_price);
  if v_entry is null or new.stop_price is null or coalesce(new.quantity, 0) <= 0 then
    raise exception 'RISK: open handoff needs quantity, stop_price and limit_price or reference_price.';
  end if;
  if new.stop_price >= v_entry then
    raise exception 'RISK: stop_price must be below entry for a long position.';
  end if;
  if new.target_1 is null or new.target_1 <= v_entry then
    raise exception 'RISK: target_1 must be set above entry.';
  end if;

  risk  := (v_entry - new.stop_price) * new.quantity;
  value := v_entry * new.quantity;

  -- losing streak → half risk
  select count(*) into streak from (
    select realized_pnl from public.trades
     where venue = 'robinhood' and status = 'closed'
     order by closed_at desc limit cfg.losing_streak_len) x
   where x.realized_pnl < 0;
  risk_limit := eq * cfg.risk_per_trade_pct / 100
                * case when streak >= cfg.losing_streak_len then 0.5 else 1 end;
  if risk > risk_limit * 1.02 then
    raise exception 'RISK: trade risk $% exceeds limit $% (% pct of equity $%)%.', round(risk,2), round(risk_limit,2),
      cfg.risk_per_trade_pct, eq, case when streak >= cfg.losing_streak_len then ', halved after losing streak' else '' end;
  end if;
  if value > eq * cfg.max_position_pct / 100 then
    raise exception 'RISK: position value $% exceeds % %% of equity.', round(value,2), cfg.max_position_pct;
  end if;

  select count(*) into open_cnt from (
    select trade_id from public.trades where venue = 'robinhood' and status in ('open','pending')
    union all
    select handoff_id from public.handoffs where broker = 'robinhood' and action = 'open' and status in ('pending','acknowledged')) x;
  if open_cnt >= cfg.max_open_positions then
    raise exception 'RISK: already % open/pending positions (max %).', open_cnt, cfg.max_open_positions;
  end if;

  select coalesce(sum(greatest(0, (entry - coalesce(current_stop, stop)) * quantity)), 0),
         coalesce(sum(coalesce(position_value, entry * quantity)), 0)
    into open_risk, gross
    from public.trades where venue = 'robinhood' and status = 'open';
  select open_risk + coalesce(sum(risk_dollars), 0),
         gross + coalesce(sum(coalesce(limit_price, reference_price) * quantity), 0)
    into open_risk, gross
    from public.handoffs where broker = 'robinhood' and action = 'open' and status in ('pending','acknowledged');
  if open_risk + risk > eq * cfg.max_open_risk_pct / 100 then
    raise exception 'RISK: total open risk would be $% (max % %% of equity).', round(open_risk + risk, 2), cfg.max_open_risk_pct;
  end if;
  if gross + value > eq * cfg.max_gross_exposure_pct / 100 then
    raise exception 'RISK: total exposure would be $% (max % %% of equity).', round(gross + value, 2), cfg.max_gross_exposure_pct;
  end if;

  select coalesce(sum(realized_pnl), 0) into day_pnl from public.trades
   where venue = 'robinhood' and status = 'closed'
     and (closed_at at time zone 'America/Phoenix')::date = public.moonbag_today();
  if day_pnl <= -(eq * cfg.daily_loss_stop_pct / 100) then
    raise exception 'RISK: daily loss stop hit ($%). No new positions today.', round(day_pnl, 2);
  end if;
  select max(equity) into peak from public.account_snapshots
   where venue = 'robinhood' and reported_at > now() - interval '30 days';
  if eq <= peak * (1 - cfg.drawdown_stop_pct / 100) then
    raise exception 'RISK: drawdown circuit breaker — equity $% is % %% or more below the 30-day peak $%. No new positions until reviewed.',
      eq, cfg.drawdown_stop_pct, peak;
  end if;

  new.risk_dollars := round(risk, 2);
  new.account_equity_basis := eq;
  if new.order_type is null then new.order_type := case when new.limit_price is null then 'market' else 'limit' end; end if;
  return new;
end $$;

drop trigger if exists trg_handoff_risk on public.handoffs;
create trigger trg_handoff_risk before insert on public.handoffs
  for each row execute function public.moonbag_check_handoff_risk();

-- ---------------------------------------------------------------- learning: trade reviews
create table if not exists public.trade_reviews (
  review_id      uuid primary key default gen_random_uuid(),
  trade_id       text not null unique references public.trades(trade_id),
  outcome        text not null check (outcome in ('win','loss','breakeven')),
  r_multiple     numeric,
  followed_plan  boolean not null,
  rules_broken   jsonb not null default '[]'::jsonb,
  what_worked    jsonb not null default '[]'::jsonb,
  what_failed    jsonb not null default '[]'::jsonb,
  error_type     text check (error_type in ('none','thesis','entry','sizing','stop_placement','exit','timing','regime','execution','other')),
  lesson         text,
  reviewed_at    timestamptz not null default now()
);
alter table public.trade_reviews enable row level security;
drop trigger if exists trg_review_no_update on public.trade_reviews;
create trigger trg_review_no_update before update on public.trade_reviews
  for each row execute function public.moonbag_block_update();
drop trigger if exists trg_review_no_delete on public.trade_reviews;
create trigger trg_review_no_delete before delete on public.trade_reviews
  for each row execute function public.moonbag_block_delete();

create or replace view public.v_unreviewed_trades with (security_invoker = true) as
select t.* from public.trades t
 where t.status = 'closed'
   and not exists (select 1 from public.trade_reviews r where r.trade_id = t.trade_id);

-- Expectancy by venue / setup / horizon — the learning loop reads this before new trades.
create or replace view public.v_trade_stats with (security_invoker = true) as
select t.venue,
       coalesce(t.setup_type, 'untagged') as setup_type,
       coalesce(t.horizon, 'n/a')         as horizon,
       count(*)                                            as trades,
       count(*) filter (where t.realized_pnl > 0)          as wins,
       round(100.0 * count(*) filter (where t.realized_pnl > 0) / nullif(count(*),0), 1) as win_rate_pct,
       round(avg(t.r_multiple), 2)                         as avg_r,
       round(sum(t.realized_pnl), 2)                       as total_pnl,
       round(avg(t.r_multiple) filter (where t.realized_pnl > 0), 2) as avg_win_r,
       round(avg(t.r_multiple) filter (where t.realized_pnl <= 0), 2) as avg_loss_r
  from public.trades t
 where t.status = 'closed'
 group by 1, 2, 3;

-- ---------------------------------------------------------------- security
revoke all on public.risk_config, public.account_snapshots, public.trade_reviews,
              public.v_unreviewed_trades, public.v_trade_stats from anon, authenticated;
grant select, insert, update on public.risk_config, public.account_snapshots, public.trade_reviews to service_role;
grant select on public.v_unreviewed_trades, public.v_trade_stats to service_role;
