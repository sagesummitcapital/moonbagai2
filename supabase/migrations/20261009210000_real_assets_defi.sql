-- Real estate ledger, DeFi scan log, FX and whole-balance-sheet view (Stavros 2026-10-09). Applied live; this file is the record.
create table if not exists public.real_assets (
  asset_id text primary key default ('RA-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,4)),
  label text not null, address text not null, country text not null,
  kind text not null check (kind in ('rental','personal','mixed','land','other')),
  currency text not null default 'USD' check (currency in ('USD','EUR')),
  ownership_pct numeric not null default 100 check (ownership_pct > 0 and ownership_pct <= 100),
  purchase_price numeric, purchase_date date, est_value numeric, value_source text, value_as_of date,
  mortgage_balance numeric not null default 0, mortgage_rate_pct numeric, mortgage_payment_monthly numeric,
  monthly_rent numeric not null default 0, monthly_costs numeric not null default 0,
  status text not null default 'owned' check (status in ('owned','sold')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.real_assets enable row level security;
create table if not exists public.defi_scans (
  id bigserial primary key, scan_date date not null default current_date,
  protocol text not null, chain text, asset text not null,
  tier text not null check (tier in ('cash_like','real_yield','structured','speculative')),
  apy numeric, apy_base numeric, apy_reward numeric, tvl_usd numeric,
  verdict text not null check (verdict in ('candidate','watch','reject')),
  risk_notes text, source text, created_at timestamptz not null default now());
alter table public.defi_scans enable row level security;
create table if not exists public.fx_rates (currency text primary key, usd_per_unit numeric not null, as_of timestamptz not null default now());
alter table public.fx_rates enable row level security;
-- views (see live definitions): v_real_estate (equity/value/debt in USD, LTV, net yield + cash flow for rentals only,
-- value_stale > 180 days) and v_balance_sheet (rentals equity, personal equity, long-term sleeve, Robinhood, BloFin; pays_you flag).
