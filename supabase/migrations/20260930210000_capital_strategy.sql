-- =============================================================================
-- Moonbag — wire in "AI-Era Personal Capital Strategy" v1.0
--   • Two sleeves: Moonbag Investments (long-duration) vs Moonbag Trading (tactical)
--   • Investments need an explicit economic mechanism (investment_themes)
--   • Correlated positions are treated as correlated risk (max exposure per theme)
--   • Process and outcome are measured separately in trade reviews
--   • Monthly "what do we own now?" ledger
-- Safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------- investment themes
create table if not exists public.investment_themes (
  theme_id           text primary key check (theme_id ~ '^[a-z0-9_]+$'),
  name               text not null,
  -- How AI adoption translates into durable cash flow, asset appreciation or strategic scarcity.
  mechanism          text,
  scarcity           text,           -- what becomes scarce / who gains pricing power
  commoditization_risk text,         -- what AI makes abundant that could hurt this theme
  beneficiaries      jsonb not null default '[]'::jsonb,   -- tickers / ETFs
  what_would_break_it text,
  evidence_for       jsonb not null default '[]'::jsonb,
  evidence_against   jsonb not null default '[]'::jsonb,
  conviction         numeric check (conviction between 0 and 100),
  status             text not null default 'watch' check (status in ('watch','active','paused','retired')),
  last_reviewed_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint active_needs_mechanism check (
    status <> 'active' or (coalesce(length(mechanism),0) > 20 and coalesce(length(what_would_break_it),0) > 10))
);
alter table public.investment_themes enable row level security;
drop trigger if exists trg_theme_touch on public.investment_themes;
create trigger trg_theme_touch before update on public.investment_themes
  for each row execute function public.moonbag_touch_updated_at();
drop trigger if exists trg_theme_no_delete on public.investment_themes;
create trigger trg_theme_no_delete before delete on public.investment_themes
  for each row execute function public.moonbag_block_delete();

-- Seed the areas of interest from the strategy doc. All start as 'watch':
-- a theme can only go 'active' once its mechanism and "what would break it" are written.
insert into public.investment_themes (theme_id, name) values
  ('ai_infrastructure',     'AI infrastructure'),
  ('semiconductors',        'Semiconductors'),
  ('compute',               'Compute'),
  ('data_centers',          'Data centers'),
  ('energy',                'Energy'),
  ('power_infrastructure',  'Power infrastructure'),
  ('robotics_automation',   'Robotics & automation'),
  ('defense',               'Defense'),
  ('space',                 'Space'),
  ('critical_materials',    'Critical materials'),
  ('financial_infrastructure','Financial infrastructure'),
  ('proprietary_data',      'Proprietary-data businesses'),
  ('distribution_platforms','Distribution platforms'),
  ('ai_labor_replacement',  'Companies replacing labor with AI'),
  ('ai_buildout_indirect',  'Indirect beneficiaries of the AI buildout')
on conflict (theme_id) do nothing;

-- ---------------------------------------------------------------- sleeves & themes on trades/handoffs
alter table public.trades   add column if not exists sleeve text check (sleeve in ('trading','investments'));
alter table public.trades   add column if not exists theme  text;
alter table public.handoffs add column if not exists sleeve text check (sleeve in ('trading','investments'));
alter table public.handoffs add column if not exists theme  text;

-- Correlated-risk limit per theme.
alter table public.risk_config add column if not exists max_theme_exposure_pct numeric not null default 40;

-- ---------------------------------------------------------------- strategy gate (runs before the risk gate)
create or replace function public.moonbag_check_handoff_strategy()
returns trigger language plpgsql as $$
declare
  th public.investment_themes;
  cfg public.risk_config;
  eq numeric; theme_exposure numeric; v_entry numeric;
begin
  if new.action <> 'open' or new.broker <> 'robinhood' then
    return new;
  end if;
  -- Sleeve: long-duration = Investments, tactical = Trading.
  if new.sleeve is null then
    new.sleeve := case when new.horizon = 'position' then 'investments' else 'trading' end;
  end if;
  if new.sleeve = 'investments' then
    if new.theme is null then
      raise exception 'STRATEGY: Investments positions must name an investment theme (investment_themes.theme_id).';
    end if;
    select * into th from public.investment_themes where theme_id = new.theme;
    if not found or th.status <> 'active' then
      raise exception 'STRATEGY: theme "%" is not ACTIVE. Write its economic mechanism and what would break it, then activate it — "AI is growing, so buy AI stocks" is not a thesis.', new.theme;
    end if;
  end if;
  -- Correlated risk: cap exposure per theme.
  if new.theme is not null then
    select * into cfg from public.risk_config where venue = 'robinhood';
    select equity into eq from public.account_snapshots where venue = 'robinhood' order by reported_at desc limit 1;
    v_entry := coalesce(new.limit_price, new.reference_price);
    select coalesce(sum(coalesce(position_value, entry * quantity)), 0) into theme_exposure
      from public.trades where venue = 'robinhood' and status = 'open' and theme = new.theme;
    select theme_exposure + coalesce(sum(coalesce(limit_price, reference_price) * quantity), 0) into theme_exposure
      from public.handoffs where broker = 'robinhood' and action = 'open' and status in ('pending','acknowledged') and theme = new.theme;
    if eq is not null and v_entry is not null and new.quantity is not null
       and theme_exposure + v_entry * new.quantity > eq * cfg.max_theme_exposure_pct / 100 then
      raise exception 'RISK: theme "%" exposure would be $% (max % pct of equity) — correlated positions are correlated risk.',
        new.theme, round(theme_exposure + v_entry * new.quantity, 2), cfg.max_theme_exposure_pct;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_handoff_ra_strategy on public.handoffs;
create trigger trg_handoff_ra_strategy before insert on public.handoffs
  for each row execute function public.moonbag_check_handoff_strategy();

-- ---------------------------------------------------------------- process vs outcome
alter table public.trade_reviews add column if not exists process_score numeric check (process_score between 0 and 100);
alter table public.trade_reviews add column if not exists decision_quality text
  check (decision_quality in ('good_process','bad_process'));

drop view if exists public.v_trade_stats;
create view public.v_trade_stats with (security_invoker = true) as
select t.venue,
       coalesce(t.sleeve, 'trading')      as sleeve,
       coalesce(t.setup_type, 'untagged') as setup_type,
       coalesce(t.horizon, 'n/a')         as horizon,
       count(*)                                            as trades,
       count(*) filter (where t.realized_pnl > 0)          as wins,
       round(100.0 * count(*) filter (where t.realized_pnl > 0) / nullif(count(*),0), 1) as win_rate_pct,
       round(avg(t.r_multiple), 2)                         as avg_r,
       round(sum(t.realized_pnl), 2)                       as total_pnl,
       round(avg(t.r_multiple) filter (where t.realized_pnl > 0), 2) as avg_win_r,
       round(avg(t.r_multiple) filter (where t.realized_pnl <= 0), 2) as avg_loss_r,
       round(avg(r.process_score), 1)                      as avg_process_score,
       count(*) filter (where r.decision_quality = 'bad_process' and t.realized_pnl > 0) as lucky_wins,
       count(*) filter (where r.decision_quality = 'good_process' and t.realized_pnl <= 0) as good_losses
  from public.trades t
  left join public.trade_reviews r on r.trade_id = t.trade_id
 where t.status = 'closed'
 group by 1, 2, 3, 4;

-- ---------------------------------------------------------------- monthly ownership ledger
create table if not exists public.ownership_ledger (
  ledger_id     uuid primary key default gen_random_uuid(),
  period_month  date not null unique,          -- first day of the month reviewed
  robinhood_equity_start numeric,
  robinhood_equity_end   numeric,
  blofin_equity_end      numeric,
  assets_gained jsonb not null default '[]'::jsonb,  -- "what do we own now that we didn't 30 days ago?"
  track_record  jsonb not null default '{}'::jsonb,  -- forecasts graded, confidence, trade stats snapshot
  theme_changes jsonb not null default '[]'::jsonb,
  lessons       jsonb not null default '[]'::jsonb,
  activity_without_assets jsonb not null default '[]'::jsonb,
  markdown      text,
  created_at    timestamptz not null default now()
);
alter table public.ownership_ledger enable row level security;
drop trigger if exists trg_ledger_no_update on public.ownership_ledger;
create trigger trg_ledger_no_update before update on public.ownership_ledger
  for each row execute function public.moonbag_block_update();
drop trigger if exists trg_ledger_no_delete on public.ownership_ledger;
create trigger trg_ledger_no_delete before delete on public.ownership_ledger
  for each row execute function public.moonbag_block_delete();

-- ---------------------------------------------------------------- security
revoke all on public.investment_themes, public.ownership_ledger, public.v_trade_stats from anon, authenticated;
grant select, insert, update on public.investment_themes, public.ownership_ledger to service_role;
grant select on public.v_trade_stats to service_role;
