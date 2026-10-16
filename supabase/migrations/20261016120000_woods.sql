-- Woods framework (Stavros's mentor) = main leverage strategy from 2026-10-16. Applied live 2026-10-16.
create table if not exists public.woods_levels (
  level_id bigint generated always as identity primary key,
  coin text not null,
  kind text not null check (kind in ('line_in_sand','flip','demand','supply','order_block','liquidity','range_high','range_low','target','note')),
  low numeric, high numeric,
  timeframe text,
  note text,
  source text not null default 'woods',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.woods_levels enable row level security;
alter table public.lev_open_plan add column if not exists woods jsonb;
