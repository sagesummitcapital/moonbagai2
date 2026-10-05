-- Moonbag — 24-hour trade lookbacks (Stavros, 2026-10-05): one coaching record per closed trade,
-- written about 24h after the close by the "Moonbag 24h trade lookback" task. Immutable.
create table if not exists public.trade_lookbacks (
  trade_id          text primary key references public.trades(trade_id),
  created_at        timestamptz not null default now(),
  week_start        date not null,
  venue             text not null,
  symbol            text not null,
  window_hours      integer not null default 24,
  r_realized        numeric,
  mfe_r             numeric,
  mae_r             numeric,
  r_if_held_to_plan numeric,
  r_best_in_window  numeric,
  price_after       jsonb not null default '{}'::jsonb,
  verdict           text not null check (verdict in ('well_managed','exited_early','exited_late','stop_too_tight','stop_too_wide','entry_poor','should_have_skipped','lucky')),
  rules_broken      jsonb not null default '[]'::jsonb,
  what_went_well    text,
  could_do_better   text not null,
  dollars_left_on_table numeric,
  dollars_saved     numeric,
  suggestion        text not null,
  lesson            text
);
alter table public.trade_lookbacks enable row level security;
create index if not exists trade_lookbacks_week_idx on public.trade_lookbacks (week_start desc);
create or replace trigger trg_lookback_nu before update on public.trade_lookbacks
  for each row execute function public.moonbag_block_update();
create or replace trigger trg_lookback_nd before delete on public.trade_lookbacks
  for each row execute function public.moonbag_block_delete();
revoke all on public.trade_lookbacks from anon, authenticated;
grant select, insert on public.trade_lookbacks to service_role;
