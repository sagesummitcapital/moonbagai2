-- Weekday open plan for the leverage desk + deposits for the $10M goal (Stavros, 2026-10-15). Applied live 2026-10-15.
create table if not exists public.lev_open_plan (
  plan_date date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  open_at timestamptz,
  red_day boolean not null default false,
  events text,
  market_bias text check (market_bias in ('long','short','neutral')),
  confidence integer check (confidence between 0 and 100),
  headline text,
  thesis text,
  coins jsonb not null default '[]'::jsonb,
  open_strategy text,
  playbook jsonb not null default '[]'::jsonb,
  no_trade_if text,
  drive jsonb,
  drive_checked_at timestamptz,
  result jsonb,
  bias_correct boolean,
  grade integer check (grade between 0 and 100),
  lesson text,
  graded_at timestamptz
);
alter table public.lev_open_plan enable row level security;

create table if not exists public.account_flows (
  flow_id bigint generated always as identity primary key,
  venue text not null check (venue in ('blofin','coinbase','robinhood')),
  amount numeric not null,
  flow_at timestamptz not null default now(),
  note text,
  reported_by text,
  created_at timestamptz not null default now()
);
alter table public.account_flows enable row level security;

create or replace view public.v_open_plan_record with (security_invoker = true) as
select count(*) filter (where graded_at is not null) as graded,
       round(100.0 * avg(case when bias_correct then 1 when bias_correct = false then 0 end) filter (where plan_date > current_date - 30), 0) as bias_hit_pct_30d,
       round(avg(grade) filter (where plan_date > current_date - 30), 0) as avg_grade_30d,
       round(avg(confidence) filter (where plan_date > current_date - 30), 0) as avg_confidence_30d,
       (select count(*) from public.lev_open_plan p, jsonb_array_elements(coalesce(p.result->'drive','[]'::jsonb)) d where d ? 'r') as drive_trades,
       (select round(avg((d->>'r')::numeric), 3) from public.lev_open_plan p, jsonb_array_elements(coalesce(p.result->'drive','[]'::jsonb)) d where d ? 'r') as drive_avg_r,
       (select round(sum((d->>'r')::numeric), 2) from public.lev_open_plan p, jsonb_array_elements(coalesce(p.result->'drive','[]'::jsonb)) d where d ? 'r') as drive_total_r
  from public.lev_open_plan;
