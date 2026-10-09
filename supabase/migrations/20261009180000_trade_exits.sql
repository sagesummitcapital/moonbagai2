-- Partial profit-taking and breakeven stops (Stavros, 2026-10-09: "a common thing I do is move stops to
-- break even and take a % profit"). trades.realized_pnl / exit_price / fees are write-once, so each partial
-- or final exit is its own immutable row here; the trade keeps a running open quantity and banked P&L.

alter table public.trades add column if not exists qty_open numeric;
alter table public.trades add column if not exists banked_pnl numeric not null default 0;
alter table public.trades add column if not exists banked_fees numeric not null default 0;

create table if not exists public.trade_exits (
  exit_id      text primary key,
  trade_id     text not null references public.trades(trade_id),
  kind         text not null default 'partial' check (kind in ('partial','final')),
  quantity     numeric not null check (quantity > 0),
  price        numeric not null check (price > 0),
  pnl          numeric,                -- BloFin realised PnL for this fill (USDT), as reported
  fee          numeric,
  pct_of_position numeric,             -- share of the ORIGINAL size closed by this fill, 0-100
  r_at_exit    numeric,                -- (price - entry) / (entry - original stop), signed for direction
  reason       text not null default 'manual'
               check (reason in ('tp1','tp2','tp3','manual','stop','breakeven_stop','trail','time')),
  exited_at    timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists trade_exits_trade_idx on public.trade_exits(trade_id, exited_at);

create or replace function public.moonbag_trade_exit_before_insert() returns trigger
language plpgsql as $$
declare
  t public.trades%rowtype;
  open_qty numeric;
  risk_per_unit numeric;
  sgn numeric;
begin
  select * into t from public.trades where trade_id = new.trade_id for update;
  if not found then raise exception 'EXIT: trade % not found.', new.trade_id; end if;
  if t.status <> 'open' then raise exception 'EXIT: trade % is %, not open.', new.trade_id, t.status; end if;
  open_qty := coalesce(t.qty_open, t.quantity);
  if open_qty is null then raise exception 'EXIT: trade % has no quantity recorded.', new.trade_id; end if;
  if new.quantity > open_qty * 1.0001 then
    raise exception 'EXIT: closing % but only % is still open on %.', new.quantity, open_qty, new.trade_id;
  end if;
  -- the last fill of the position is always the final one
  if new.quantity >= open_qty * 0.9999 then new.kind := 'final'; end if;
  if new.exit_id is null then
    new.exit_id := public.moonbag_next_id('MBX', public.moonbag_today(), t.symbol);
  end if;
  sgn := case when t.direction = 'short' then -1 else 1 end;
  risk_per_unit := abs(t.entry - t.stop);
  if t.quantity > 0 then new.pct_of_position := round(100 * new.quantity / t.quantity, 1); end if;
  if risk_per_unit > 0 then new.r_at_exit := round(sgn * (new.price - t.entry) / risk_per_unit, 2); end if;
  if new.pnl is null then new.pnl := round(sgn * (new.price - t.entry) * new.quantity, 2); end if;
  return new;
end $$;

create or replace function public.moonbag_trade_exit_after_insert() returns trigger
language plpgsql as $$
declare
  t public.trades%rowtype;
  tot_pnl numeric; tot_fee numeric; tot_qty numeric; avg_px numeric;
begin
  select * into t from public.trades where trade_id = new.trade_id;
  select sum(pnl), sum(coalesce(fee,0)), sum(quantity), sum(price * quantity) / nullif(sum(quantity),0)
    into tot_pnl, tot_fee, tot_qty, avg_px
    from public.trade_exits where trade_id = new.trade_id;

  if new.kind = 'partial' then
    update public.trades
       set qty_open = coalesce(t.qty_open, t.quantity) - new.quantity,
           banked_pnl = tot_pnl, banked_fees = tot_fee
     where trade_id = new.trade_id;
  else
    -- final fill: close the trade with the size-weighted exit and the summed P&L (all fills)
    update public.trades
       set qty_open = 0,
           banked_pnl = tot_pnl, banked_fees = tot_fee,
           exit_price = coalesce(t.exit_price, round(avg_px, 4)),
           realized_pnl = coalesce(t.realized_pnl, tot_pnl),
           fees = coalesce(t.fees, tot_fee),
           r_multiple = case when coalesce(t.risk_dollars,0) > 0 then round(tot_pnl / t.risk_dollars, 2) else t.r_multiple end,
           exit_reason = coalesce(t.exit_reason, case new.reason
                         when 'tp1' then 'target' when 'tp2' then 'target' when 'tp3' then 'target'
                         when 'breakeven_stop' then 'trailing_stop' when 'trail' then 'trailing_stop'
                         else new.reason end),
           closed_at = coalesce(t.closed_at, new.exited_at),
           status = 'closed'
     where trade_id = new.trade_id;
  end if;
  return new;
end $$;

create or replace function public.moonbag_trade_exit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Trade exits are immutable history. Record a correcting note on the trade instead.';
end $$;

drop trigger if exists trg_trade_exit_bi on public.trade_exits;
create trigger trg_trade_exit_bi before insert on public.trade_exits
  for each row execute function public.moonbag_trade_exit_before_insert();
drop trigger if exists trg_trade_exit_ai on public.trade_exits;
create trigger trg_trade_exit_ai after insert on public.trade_exits
  for each row execute function public.moonbag_trade_exit_after_insert();
drop trigger if exists trg_trade_exit_no_change on public.trade_exits;
create trigger trg_trade_exit_no_change before update or delete on public.trade_exits
  for each row execute function public.moonbag_trade_exit_immutable();

alter table public.trade_exits enable row level security;

-- Live position view: what is still on, what is banked, and whether the rest is risk-free.
create or replace view public.v_open_positions as
select t.trade_id, t.venue, t.symbol, t.direction, t.origin, t.entry, t.stop, t.current_stop,
       coalesce(t.current_tp1, t.tp1) as tp1, t.quantity,
       coalesce(t.qty_open, t.quantity) as qty_open,
       round(100 * coalesce(t.qty_open, t.quantity) / nullif(t.quantity,0), 1) as pct_open,
       t.banked_pnl, t.banked_fees, t.risk_dollars, t.leverage, t.opened_at,
       (case when t.direction = 'short' then t.current_stop <= t.entry else t.current_stop >= t.entry end) as risk_free,
       greatest(0, (case when t.direction = 'short' then t.current_stop - t.entry else t.entry - t.current_stop end))
         * coalesce(t.qty_open, t.quantity) as open_risk_dollars
  from public.trades t
 where t.status = 'open';

-- ---- 2026-10-09 (later): partial targets, voiding duplicates -------------------------------------
-- "50% TP at 83,780" = current_tp1 83780 + current_tp1_qty (coin units). null qty = full close.
alter table public.trades add column if not exists current_tp1_qty numeric,
  add column if not exists current_tp2_qty numeric, add column if not exists current_tp3_qty numeric;
alter table public.trade_exits add column if not exists voided_at timestamptz, add column if not exists void_reason text;
-- (applied live: moonbag_trade_recalc(), void-only update path in moonbag_trade_exit_immutable(),
--  trg_trade_exit_after_void, duplicate guard (same qty + price) in moonbag_trade_exit_before_insert(),
--  sums exclude voided fills, a filled tpN clears current_tpN_qty.)
-- FIX 2026-10-09: trades.r_multiple is a GENERATED column (from entry, stop, exit_price), so the final-fill branch of
-- moonbag_trade_exit_after_insert() no longer writes it. The size-weighted exit_price makes the generated R equal to
-- total price-P&L across all fills ÷ (original size × original risk per unit). Verified with a rolled-back test
-- (2 fills: +1R and +2R on half each → exit 115, R 1.50, status closed).
