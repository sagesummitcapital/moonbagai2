-- Red-folder days (Stavros, 2026-10-14: "A+ setups only on CPI/FOMC/jobs-report days. or half risk").
-- The daily task writes one row per Phoenix date; the Desk Lead and GET /levels read it.
-- On red days: A+ full risk, every other grade half risk, no new entry within 2h of the release.
create table if not exists public.econ_days (
  day date primary key,
  events text,
  red boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.econ_days enable row level security;
