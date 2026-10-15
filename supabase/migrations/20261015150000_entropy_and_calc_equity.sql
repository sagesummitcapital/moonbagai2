-- Entropy Trap weekly map + calculated balances (Stavros, 2026-10-15). Applied live 2026-10-15.
create table if not exists public.entropy_readings (
  week date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ssi numeric, ssi_zone text check (ssi_zone in ('green','orange','red')),
  ssi_v numeric, ssi_a numeric, ssi_j numeric,
  components jsonb not null default '{}'::jsonb,
  pti_state text check (pti_state in ('equilibrium','disequilibrium','phase_transition')),
  pti_weeks_up integer, bowl text check (bowl in ('deep','shallow','flat')),
  sri text check (sri in ('inflationary','inflationary_flip_risk','deflationary')),
  sei_stage numeric check (sei_stage between 1 and 5.99),
  sam_active text, sam jsonb not null default '{}'::jsonb,
  rqi text check (rqi in ('trap','real','no_rally')),
  state text check (state in ('waiting','trapdoor','deployment')),
  signs jsonb not null default '[]'::jsonb,
  falsifiers jsonb not null default '[]'::jsonb,
  monitors jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  verdict text, moonbag text, changed text
);
alter table public.entropy_readings enable row level security;

-- Balance = last confirmed snapshot + realised P&L recorded since + deposits/withdrawals since; confirm weekly.
create or replace function public.moonbag_calc_equity(p_venue text) returns jsonb language sql stable set search_path = public as $f$
  with s as (select equity, reported_at from account_snapshots where venue = p_venue order by reported_at desc limit 1),
  ex as (select coalesce(sum(e.pnl - coalesce(e.fee, 0)), 0) v from trade_exits e join trades t on t.trade_id = e.trade_id, s
          where t.venue = p_venue and e.voided_at is null and coalesce(e.exited_at, e.created_at) > s.reported_at),
  tr as (select coalesce(sum(t.realized_pnl - coalesce(t.fees, 0)), 0) v from trades t, s
          where t.venue = p_venue and t.status = 'closed' and t.closed_at > s.reported_at
            and not exists (select 1 from trade_exits e where e.trade_id = t.trade_id and e.voided_at is null)),
  fl as (select coalesce(sum(f.amount), 0) v from account_flows f, s where f.venue = p_venue and f.flow_at > s.reported_at)
  select jsonb_build_object(
    'venue', p_venue,
    'confirmed', s.equity, 'confirmed_at', s.reported_at,
    'realized_since', round(ex.v + tr.v, 2), 'deposits_since', round(fl.v, 2),
    'equity', round(s.equity + ex.v + tr.v + fl.v, 2),
    'days_since_confirmed', round(extract(epoch from now() - s.reported_at) / 86400, 1),
    'needs_check', now() - s.reported_at > interval '7 days')
  from s, ex, tr, fl
$f$;
