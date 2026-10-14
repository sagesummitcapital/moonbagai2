-- Strategy lab (Stavros, 2026-10-14): every strategy idea he sends is logged, tested part by part against what runs live,
-- and every change to strategy is logged with its reason and evidence. Page: /dashboard/lab.
create table if not exists public.strategy_ideas (
  idea_id      text primary key,
  received_at  timestamptz not null default now(),
  source       text,
  title        text not null,
  raw_text     text,
  summary      text,
  elements     jsonb not null default '[]'::jsonb,   -- [{element, n, avg_r, note, verdict}]
  verdict      text,
  status       text not null default 'testing' check (status in ('received','testing','tested','partly_adopted','adopted','rejected')),
  next_test    text,
  updated_at   timestamptz not null default now()
);
alter table public.strategy_ideas enable row level security;

create table if not exists public.strategy_changes (
  change_id    bigserial primary key,
  created_at   timestamptz not null default now(),
  book         text not null default 'leverage',
  change       text not null,
  reason       text,
  evidence     text,
  idea_id      text references public.strategy_ideas(idea_id),
  applied_to   text not null default 'live' check (applied_to in ('live','paper','process','none')),
  status       text not null default 'adopted' check (status in ('proposed','adopted','rejected','reverted')),
  strategy_doc_version integer
);
alter table public.strategy_changes enable row level security;
create index if not exists strategy_changes_created on public.strategy_changes (created_at desc);
