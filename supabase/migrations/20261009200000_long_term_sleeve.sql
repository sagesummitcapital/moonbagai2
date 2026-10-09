-- Long-term DCA sleeve ("Moonbag Holdings", Stavros 2026-10-09). Applied live via execute_sql; this file is the record.
alter table public.risk_config add column if not exists lt_sleeve_pct numeric, add column if not exists lt_max_name_pct numeric,
  add column if not exists lt_musk_pair_pct numeric, add column if not exists lt_dca_weeks integer, add column if not exists lt_dca_start date;
update public.risk_config set lt_sleeve_pct=25, lt_max_name_pct=30, lt_musk_pair_pct=45, lt_dca_weeks=8, lt_dca_start='2026-10-09' where venue='robinhood';
alter table public.handoffs add column if not exists dca boolean not null default false;

create table if not exists public.lt_universe (
  symbol text primary key, name text not null,
  theme_id text references public.investment_themes(theme_id),
  role text not null check (role in ('core','watch','avoid')),
  target_weight_pct numeric check (target_weight_pct is null or (target_weight_pct >= 0 and target_weight_pct <= 100)),
  fud_boost boolean not null default false, thesis text not null, add_rule text, break_rule text not null,
  status text not null default 'active' check (status in ('active','paused','removed')), notes text,
  added_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.lt_universe enable row level security;

-- v_lt_sleeve: target $ / bought $ / pending $ / gap per core name (see live definition).
-- moonbag_check_handoff_ceilings: DCA (sleeve 'investments' + dca) skips A-setup, fills/week, one-symbol/day and the $12 box;
--   trading counts exclude investments lots and dca handoffs. Blocked list + $90 soft halt still apply.
-- moonbag_check_handoff_risk: DCA branch — needs an active CORE lt_universe name; caps sleeve ≤ lt_sleeve_pct of equity,
--   name ≤ lt_max_name_pct of the sleeve, SPCX+TSLA ≤ lt_musk_pair_pct; 80% gross exposure; risk_dollars = 0 (no stop).
-- Seed: themes musk_stack, hard_money, sovereign_industrial, ai_infrastructure_core (active), entropy_losers (watch);
--   lt_universe 9 core / 12 watch / 10 avoid; 10 entropy_short paper trades; thesis MB-2026-10-09-HOLDINGS-001;
--   week-1 DCA handoffs SPCX, TSLA, GLD.
