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

-- Ideas Grok submits (POST /ideas): id generated, status 'received' until tested.
alter table public.strategy_ideas alter column status set default 'received';
alter table public.strategy_ideas add column if not exists submitted_by text, add column if not exists note text;
create or replace function public.moonbag_idea_before() returns trigger language plpgsql as $$
begin
  if new.idea_id is null then new.idea_id := public.moonbag_next_id('IDEA', public.moonbag_today(), 'X'); end if;
  if tg_op = 'INSERT' and new.status is null then new.status := 'received'; end if;
  new.updated_at := now();
  return new;
end $$;
create or replace trigger strategy_ideas_before before insert or update on public.strategy_ideas for each row execute function public.moonbag_idea_before();
