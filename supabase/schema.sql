-- NOTE: The full Moonbag schema now lives in supabase/migrations/.
-- Run supabase/migrations/20260930000000_moonbag_core.sql (it includes this waitlist table).

-- Moonbag.ai — Supabase schema
-- Run in the Supabase SQL editor.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  created_at timestamptz not null default now()
);

-- Index for simple admin queries.
create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

-- Row Level Security: keep the table locked down.
-- The API route uses the service-role key, which bypasses RLS.
alter table public.waitlist enable row level security;

-- No public policies. Only the service role can read/write.
-- (If you ever want to expose reads to the anon key, add a policy here.)
