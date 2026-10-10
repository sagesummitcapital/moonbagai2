-- Book 3: COINBASE (Stavros, 2026-10-10: "I just connected my Coinbase account to my Grokbot ... work the same as
-- Robinhood — you give Grokbot the trades, it all should be displayed and managed within Moonbag").
-- Spot only (the agent portfolio is spot-only), long or cash (USDC). Strategy: docs/strategy/COINBASE_STRATEGY.md
-- — regime-gated 55-day breakout on BTC/ETH/SOL, 3×ATR stop, half off at 3R, runner trails the 20-day low,
-- 5% risk per trade, 15% max open risk. Applied live 2026-10-10 as individual statements.

-- 1. venues / books
alter table public.trades drop constraint if exists trades_venue_check;
alter table public.trades add constraint trades_venue_check check (venue = any (array['robinhood','blofin','coinbase','other']));
alter table public.account_snapshots drop constraint if exists account_snapshots_venue_check;
alter table public.account_snapshots add constraint account_snapshots_venue_check check (venue = any (array['robinhood','blofin','coinbase']));
alter table public.backtests drop constraint if exists backtests_book_check;
alter table public.backtests add constraint backtests_book_check check (book = any (array['leverage','robinhood','coinbase']));
alter table public.paper_trades drop constraint if exists paper_trades_book_check;
alter table public.paper_trades add constraint paper_trades_book_check check (book = any (array['leverage','robinhood','coinbase']));
alter table public.journal drop constraint if exists journal_book_check;
alter table public.journal add constraint journal_book_check check (book = any (array['leverage','robinhood','coinbase']));

-- 2. Coinbase trades come from a rule-based system, not a daily thesis: thesis_id optional for this venue only.
alter table public.handoffs alter column thesis_id drop not null;
alter table public.handoffs add constraint handoffs_thesis_required check (thesis_id is not null or broker = 'coinbase');
alter table public.trades alter column thesis_id drop not null;
alter table public.trades add constraint trades_thesis_required check (thesis_id is not null or venue = 'coinbase');

-- 3. Universe + live regime state (written by the Coinbase desk every day after the 00:00 UTC close)
create table if not exists public.cb_universe (
  symbol       text primary key,                 -- BTC
  product_id   text not null,                    -- BTC-USD (what Grok trades on Coinbase)
  tv_symbol    text not null,                    -- COINBASE:BTCUSD (daily bars + backtests)
  status       text not null default 'active' check (status in ('active','paused','retired')),
  regime       text check (regime in ('bull','bear')),
  regime_since date,
  close        numeric,
  sma200       numeric,
  bear_line    numeric,                          -- 0.97 × 200D: a daily close below it = BEAR (exit, cash)
  bull_line    numeric,                          -- 1.02 × 200D: a daily close above it = BULL
  trigger_px   numeric,                          -- highest high of the prior 55 days: a daily close above = entry
  atr14        numeric,
  ll20         numeric,                          -- runner trail (lowest low of the prior 20 days)
  wk_ema20     numeric,                          -- information only (backtest: as a gate it cost return)
  as_of        date,
  notes        text,
  updated_at   timestamptz not null default now()
);
insert into public.cb_universe (symbol, product_id, tv_symbol, notes) values
 ('BTC','BTC-USD','COINBASE:BTCUSD','core; backtested 2016-2026'),
 ('ETH','ETH-USD','COINBASE:ETHUSD','backtested 2017-2026'),
 ('SOL','SOL-USD','COINBASE:SOLUSD','backtested 2021-2026')
on conflict (symbol) do nothing;
alter table public.cb_universe enable row level security;

-- 4. Every daily system decision, taken or not (the paper record the weekly review grades live trades against)
create table if not exists public.cb_signals (
  id          bigserial primary key,
  as_of       date not null,
  symbol      text not null references public.cb_universe(symbol),
  kind        text not null check (kind in ('entry','no_entry','exit_regime','regime_flip','stop','tp1','trail')),
  close       numeric, trigger_px numeric, stop numeric, tp1 numeric, atr14 numeric,
  regime      text,
  risk_pct    numeric, quantity numeric, notional numeric,
  handoff_id  text references public.handoffs(handoff_id),
  trade_id    text references public.trades(trade_id),
  blocked_by  text,                               -- why an entry was not handed off (open risk full, cash, …)
  outcome_r   numeric,                            -- filled in when the paper/live position resolves
  outcome     text,
  note        text,
  created_at  timestamptz not null default now(),
  unique (as_of, symbol, kind)
);
alter table public.cb_signals enable row level security;

-- 5. Risk config for the venue (Stavros sets these; scheduled tasks never change them)
insert into public.risk_config (venue, risk_per_trade_pct, max_position_pct, max_open_positions, max_open_risk_pct,
  max_gross_exposure_pct, max_theme_exposure_pct, daily_loss_stop_pct, drawdown_stop_pct, losing_streak_len,
  allowed_instruments, auto_execute, starting_equity, blocked_symbols, max_leverage)
values ('coinbase', 5, 100, 3, 15, 100, 100, 100, 20, 3,
  $m$Coinbase spot (agent portfolio): BTC-USD, ETH-USD, SOL-USD from cb_universe. Long or cash (USDC). One position per coin, 5% of equity risked per trade (halved after 3 straight losses), 15% max combined open risk, no leverage, no margin, no perps. New entries pause if equity is 20% below its 30-day peak.$m$,
  true, 100, '[]'::jsonb, 1)
on conflict (venue) do nothing;

-- 6. Handoff insert: Coinbase opens do not need a daily thesis (the system signal is the thesis); others unchanged.
create or replace function public.moonbag_handoff_before_insert() returns trigger language plpgsql as $$
declare
  t public.trades;
begin
  new.symbol := upper(new.symbol);
  if new.action <> 'open' then
    select * into t from public.trades where trade_id = new.trade_id;
    if not found or t.status <> 'open' then
      raise exception '% handoff needs trade_id of an OPEN trade.', new.action;
    end if;
    new.thesis_id := t.thesis_id;
    new.symbol := t.symbol;
  elsif new.broker = 'coinbase' then
    if new.thesis_id is not null and not exists (select 1 from public.daily_thesis where thesis_id = new.thesis_id and status = 'active') then
      raise exception 'thesis % is not active (Coinbase handoffs may omit thesis_id).', new.thesis_id;
    end if;
  elsif not exists (select 1 from public.daily_thesis where thesis_id = new.thesis_id and status = 'active') then
    raise exception 'Open handoffs can only be created for an ACTIVE thesis (%).', new.thesis_id;
  end if;
  if new.handoff_id is null then
    new.handoff_id := public.moonbag_next_id('MBH', public.moonbag_today(), new.symbol);
  end if;
  new.created_at := now();
  new.status := 'pending';
  return new;
end $$;

-- 7. Coinbase risk gate (the Robinhood/BloFin checks skip broker 'coinbase', so this is the only gate for it)
create or replace function public.moonbag_check_handoff_coinbase() returns trigger language plpgsql as $$
declare
  cfg public.risk_config; u public.cb_universe;
  eq numeric; snap_at timestamptz; peak numeric; v_entry numeric; risk numeric; value numeric; risk_limit numeric;
  streak integer; open_cnt integer; open_risk numeric; gross numeric;
begin
  if new.broker is distinct from 'coinbase' or new.action <> 'open' then return new; end if;
  select * into cfg from public.risk_config where venue = 'coinbase';
  if not cfg.auto_execute then raise exception 'COINBASE: auto-execution is paused (risk_config.auto_execute = false).'; end if;
  select * into u from public.cb_universe where symbol = upper(new.symbol);
  if not found or u.status <> 'active' then
    raise exception 'COINBASE: % is not an active coin in cb_universe (BTC/ETH/SOL; new coins need a backtest first).', upper(new.symbol);
  end if;
  if u.regime is distinct from 'bull' then
    raise exception 'COINBASE: % regime is % — no new longs until a daily close above 1.02 × 200D.', upper(new.symbol), coalesce(u.regime,'unknown');
  end if;
  if new.direction <> 'long' then raise exception 'COINBASE: spot account — long or cash only.'; end if;
  select equity, reported_at into eq, snap_at from public.account_snapshots where venue = 'coinbase' order by reported_at desc limit 1;
  if eq is null or snap_at < now() - interval '2 days' then
    raise exception 'COINBASE: no fresh Coinbase account snapshot (Grok must POST /accounts with venue "coinbase" first).';
  end if;
  v_entry := coalesce(new.limit_price, new.reference_price);
  if v_entry is null or new.stop_price is null or coalesce(new.quantity, 0) <= 0 then
    raise exception 'COINBASE: open handoff needs quantity, stop_price and reference_price (or limit_price).';
  end if;
  if new.stop_price >= v_entry then raise exception 'COINBASE: stop_price must be below entry.'; end if;
  if new.target_1 is null or new.target_1 <= v_entry then raise exception 'COINBASE: target_1 must be above entry.'; end if;
  risk  := (v_entry - new.stop_price) * new.quantity + v_entry * new.quantity * 0.012;   -- incl. ~1.2% round-trip taker fees
  value := v_entry * new.quantity;
  select count(*) into streak from (
    select realized_pnl from public.trades where venue = 'coinbase' and status = 'closed'
     order by closed_at desc limit cfg.losing_streak_len) x where x.realized_pnl < 0;
  risk_limit := eq * cfg.risk_per_trade_pct / 100 * case when streak >= cfg.losing_streak_len then 0.5 else 1 end;
  if risk > risk_limit * 1.03 then
    raise exception 'COINBASE: trade risk $% (incl. fees) exceeds $% (% pct of $%)%.', round(risk,2), round(risk_limit,2),
      cfg.risk_per_trade_pct, eq, case when streak >= cfg.losing_streak_len then ', halved after a losing streak' else '' end;
  end if;
  if exists (select 1 from public.trades where venue = 'coinbase' and status = 'open' and symbol = upper(new.symbol))
     or exists (select 1 from public.handoffs where broker = 'coinbase' and action = 'open' and status in ('pending','acknowledged') and symbol = upper(new.symbol)) then
    raise exception 'COINBASE: already holding or handing off % — one position per coin.', upper(new.symbol);
  end if;
  select count(*) into open_cnt from (
    select trade_id from public.trades where venue = 'coinbase' and status = 'open'
    union all select handoff_id from public.handoffs where broker = 'coinbase' and action = 'open' and status in ('pending','acknowledged')) x;
  if open_cnt >= cfg.max_open_positions then
    raise exception 'COINBASE: already % positions open or pending (max %).', open_cnt, cfg.max_open_positions;
  end if;
  select coalesce(sum(greatest(0, (entry - coalesce(current_stop, stop)) * coalesce(qty_open, quantity))), 0),
         coalesce(sum(entry * coalesce(qty_open, quantity)), 0)
    into open_risk, gross from public.trades where venue = 'coinbase' and status = 'open';
  select open_risk + coalesce(sum(risk_dollars), 0), gross + coalesce(sum(coalesce(limit_price, reference_price) * quantity), 0)
    into open_risk, gross from public.handoffs where broker = 'coinbase' and action = 'open' and status in ('pending','acknowledged');
  if open_risk + risk > eq * cfg.max_open_risk_pct / 100 * 1.03 then
    raise exception 'COINBASE: open risk would be $% (max % pct of $%).', round(open_risk + risk, 2), cfg.max_open_risk_pct, eq;
  end if;
  if gross + value > eq * cfg.max_gross_exposure_pct / 100 * 1.01 then
    raise exception 'COINBASE: exposure would be $% — more than the account ($%). Spot only, no margin.', round(gross + value, 2), eq;
  end if;
  select max(equity) into peak from public.account_snapshots where venue = 'coinbase' and reported_at > now() - interval '30 days';
  if eq <= peak * (1 - cfg.drawdown_stop_pct / 100) then
    raise exception 'COINBASE: drawdown pause — equity $% is % pct+ below the 30-day peak $%. Stavros reviews before new entries.', eq, cfg.drawdown_stop_pct, peak;
  end if;
  new.risk_dollars := round(risk, 2);
  new.account_equity_basis := eq;
  if new.order_type is null then new.order_type := case when new.limit_price is null then 'market' else 'limit' end; end if;
  if new.sleeve is null then new.sleeve := 'trading'; end if;
  return new;
end $$;
drop trigger if exists trg_handoff_rd_coinbase on public.handoffs;
create trigger trg_handoff_rd_coinbase before insert on public.handoffs
  for each row execute function public.moonbag_check_handoff_coinbase();

-- 8. Agent registry
insert into public.agents (agent_id) values ('coinbase_desk') on conflict do nothing;  -- (see live row for name/book/description)
