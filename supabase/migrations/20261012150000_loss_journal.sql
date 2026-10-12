-- Loss journal (Stavros, 2026-10-12): every losing trade, and every mistake that didn't cost anything yet,
-- is written down with why it happened and the rule that would have prevented it. Grok writes entries
-- when Stavros journals with it; Claude's Coach adds any losing BloFin trade that is missing. Grok, the
-- Desk Lead and the Coach read it before giving trade inputs or scoring a setup.

create table if not exists public.loss_journal (
  entry_id      bigserial primary key,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  kind          text not null default 'loss' check (kind in ('loss', 'near_miss')),
  trade_id      text,                         -- trades.trade_id when there is one
  trade_date    date,
  venue         text not null default 'blofin',
  symbol        text,
  direction     text check (direction in ('long', 'short') or direction is null),
  pnl           numeric,                      -- $ (negative for a loss)
  r_multiple    numeric,
  what_happened text not null,                -- plain account of the trade
  why_lost      text,                         -- the cause, in one or two sentences
  mistake_tags  text[] not null default '{}', -- e.g. stop_too_tight, late_entry, oversized, liq_beyond_stop, wrong_input, revenge_trade, no_review
  lesson        text,                         -- what to do differently
  check_rule    text,                         -- the pre-trade check that would have caught it
  source        text not null default 'grok' check (source in ('grok', 'claude', 'stavros')),
  status        text not null default 'open' check (status in ('open', 'reviewed', 'resolved'))
);

create unique index if not exists loss_journal_trade_kind on public.loss_journal (trade_id, kind) where trade_id is not null;
create index if not exists loss_journal_created on public.loss_journal (created_at desc);
create index if not exists loss_journal_tags on public.loss_journal using gin (mistake_tags);

alter table public.loss_journal enable row level security;

-- Pattern view: how often each mistake shows up and what it cost.
create or replace view public.v_loss_patterns as
select tag,
       count(*)                                        as times,
       count(*) filter (where kind = 'loss')           as losses,
       round(coalesce(sum(pnl) filter (where kind = 'loss'), 0), 2) as cost_usd,
       max(coalesce(trade_date, created_at::date))     as last_seen,
       (array_agg(check_rule order by created_at desc) filter (where check_rule is not null))[1] as latest_check
from public.loss_journal, unnest(mistake_tags) as tag
group by tag
order by times desc, cost_usd asc;
