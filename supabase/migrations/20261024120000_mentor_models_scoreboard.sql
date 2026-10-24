-- CR-10 mentor profiles + CR-11 Moonbag vs mentors (Stavros approved 2026-10-23 "Yes all those sound good"; applied live 2026-10-24).
create table if not exists public.mentor_profile (
  id bigserial primary key, mentor text not null, section text not null check (section in ('looks_at','changes_view','judges')),
  version int not null default 1, profile text not null, what_changed text, post_ids bigint[], principle_ids text[],
  is_current boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists mentor_profile_current on public.mentor_profile (mentor, section) where is_current;
create table if not exists public.mentor_profile_tests (
  id bigserial primary key, mentor text not null, week date not null, post_id bigint, inputs text, predicted text, actual text,
  match text check (match in ('match','partial','miss')), note text, profile_versions jsonb, created_at timestamptz not null default now()
);
create table if not exists public.moonbag_calls (
  id bigserial primary key, logged_at timestamptz not null default now(), call_window text not null check (call_window in ('day','week')),
  window_start date not null, asset text not null, bias text not null check (bias in ('long','short','neutral')),
  levels jsonb, trigger text, target numeric, invalidation numeric not null, invalidation_text text, horizon_days int not null default 1,
  entry numeric, stop numeric, source text default 'daily_cycle', mentor_call_ids bigint[],
  status text not null default 'open' check (status in ('open','graded','void')), direction_hit boolean, level_hit boolean, r numeric, graded_at timestamptz, grade_note text,
  unique (call_window, window_start, asset)
);
alter table public.mentor_profile enable row level security;
alter table public.mentor_profile_tests enable row level security;
alter table public.moonbag_calls enable row level security;

create or replace view public.v_moonbag_vs_mentors as
with pairs as (
  select mc.call_id, mc.mentor, mc.asset, mc.made_at, mc.status as mentor_status,
         m.id as moonbag_id, m.logged_at, m.status as moonbag_status, m.direction_hit, m.level_hit, m.r,
         (m.logged_at < mc.made_at) as fair
  from public.mentor_calls mc
  join public.moonbag_calls m on m.asset = mc.asset and m.status <> 'void'
   and mc.made_at::date between m.window_start and m.window_start + (m.horizon_days - 1)
)
select date_trunc('week', made_at)::date as week, mentor,
  count(*) filter (where fair) as fair_pairs,
  count(*) filter (where not fair) as unfair_pairs_excluded,
  count(*) filter (where fair and moonbag_status = 'graded' and mentor_status in ('right','wrong')) as graded_pairs,
  round(100.0 * avg(case when fair and moonbag_status = 'graded' then direction_hit::int end), 0) as moonbag_hit_pct,
  round(100.0 * avg(case when fair and moonbag_status = 'graded' then level_hit::int end), 0) as moonbag_level_hit_pct,
  round(avg(case when fair and moonbag_status = 'graded' then r end), 2) as moonbag_avg_r,
  round(100.0 * avg(case when fair and mentor_status in ('right','wrong') then (mentor_status = 'right')::int end), 0) as mentor_hit_pct
from pairs group by 1, 2 order by 1 desc, 2;

-- v1 profiles were seeded from mentor_principles (looks_at = macro/levels/structure/timing, changes_view = invalidation, judges = the rest).
-- CR-9: woods_scan no longer sets blocked = 'BTC anchor: no alt longs below the line' (warning only), patched live 2026-10-24.
