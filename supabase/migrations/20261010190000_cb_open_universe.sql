-- Coinbase book v2: open universe, earned live status (2026-10-10).
-- Stavros: "i dont want coinbase to be limited to just 3 coins - open it up to the entire system - goal is increasing r:r".
-- Research (research/coinbase/uni.py, 36 Coinbase USD pairs, fees + slippage, 2021-2026):
--   * Same rules on every coin at full risk LOWERS R:R: avg R 1.15 -> 0.3-0.8, worst drawdown -19% -> -48..-75%.
--     Most alts don't trend cleanly enough for a 55-day breakout (alt avg ~0.3R vs BTC/ETH/SOL ~1.1R).
--   * What kept R:R: scan everything, paper-trade everything, and let an alt trade live only after its own paper
--     record shows 4+ trades averaging +0.5R or better, at half risk, only while BTC is bull, core coins first.
--     2021-26: avg R 1.10 vs 1.15, CAGR 29.9 vs 29.8, DD -20.4 vs -18.9. 2023-26: CAGR 37.8 vs 32.6, MAR 1.98 vs 1.72.
--     Mid-2024-26: avg R 0.63 vs 0.36, CAGR 21.7 vs 14.5. Alt trades that got through: +0.37..+0.64R in every window.
-- Applied live via execute_sql (no DROP/DELETE).

-- 1. Universe: tier, live flag, risk multiplier, relative strength, paper record
alter table public.cb_universe add column if not exists tier text not null default 'alt', add column if not exists live boolean not null default false,
 add column if not exists risk_mult numeric not null default 0.5, add column if not exists rs90 numeric, add column if not exists paper_n integer not null default 0,
 add column if not exists paper_avg_r numeric, add column if not exists paper_last4 numeric, add column if not exists live_reason text;
update public.cb_universe set tier = 'core', live = true, risk_mult = 1, live_reason = 'core coin' where symbol in ('BTC','ETH','SOL');
-- 33 alts (product XXX-USD, chart COINBASE:XXXUSD): XRP DOGE ADA AVAX LINK DOT LTC BCH NEAR UNI AAVE ATOM SUI APT ARB INJ SEI ENA
-- HBAR XLM FIL ICP OP RENDER ONDO SHIB ETC ALGO MANA SAND AXS CRV GRT  (inserted with tier 'alt', live false, risk_mult 0.5)

-- 2. Paper book: one paper position per coin, same rules as live, no portfolio limits. Seeded with the backtest
--    record (source 'backtest', 311 rows through 2026-10-09); cb_run() continues it daily (source 'paper').
create table if not exists public.cb_paper (
  id bigserial primary key, symbol text not null, source text not null default 'paper' check (source in ('backtest','paper')),
  status text not null default 'open' check (status in ('open','closed')),
  opened_on date not null, entry numeric not null, stop0 numeric not null, tp1 numeric not null, cur_stop numeric not null,
  tp1_done boolean not null default false, closed_on date, exit_px numeric, r numeric, why text, last_bar date,
  created_at timestamptz not null default now(), unique (symbol, opened_on));
create index if not exists cb_paper_symbol on public.cb_paper (symbol, status);
alter table public.cb_paper enable row level security;
-- paper R (net of fees): ((tp1_done ? 0.5*tp1*0.996 + 0.5*exit*0.994 : exit*0.994) - entry*1.006) / ((entry - stop0) + 0.012*entry)

-- 3. Risk gate (moonbag_check_handoff_coinbase, patched in place):
--    * coin must be live (else: "paper-only - goes live after 4+ paper trades averaging +0.5R")
--    * alts only while BTC regime is bull
--    * risk limit = risk_per_trade_pct x cb_universe.risk_mult (core 1.0 = 5%, alt 0.5 = 2.5%), halved after 3 losses
--    Unchanged: 15% open risk, max 3 positions, one per coin, no margin, drawdown pause, fresh snapshot.

-- 4. cb_run v2
create or replace function public.cb_run(p_quotes jsonb default '[]'::jsonb, p_daily boolean default false)
returns jsonb language plpgsql as $$
declare
  cfg public.risk_config; u record; t record; r record; p record; v_ho public.handoffs;
  eq numeric; cash_amt numeric; snap_at timestamptz; exposure numeric; open_risk numeric; streak integer; risk_pct numeric; peak numeric;
  v_asof date; v_close numeric; v_bo numeric; v_bh numeric; v_bl numeric; v_sma numeric; v_n integer; v_atr numeric; v_hh numeric; v_ll20 numeric; v_ll10 numeric; v_wk numeric;
  v_reg text; st boolean; v_c90 numeric; v_ret90 numeric; v_btc90 numeric; v_btc_bull boolean;
  v_ref numeric; v_gate numeric; v_stop numeric; v_tp1 numeric; per_unit numeric; v_qty numeric; v_notional numeric; v_cap numeric; rk numeric;
  v_block text; v_price numeric; v_high numeric; v_low numeric; v_new numeric; v_tp1_done boolean; v_kind text;
  v_px numeric; v_why text; v_pn integer; v_pavg numeric; v_p4 numeric; v_live boolean; v_held boolean;
  v_exp timestamptz := (date_trunc('day', now() at time zone 'UTC') + interval '1 day' - interval '5 minutes') at time zone 'UTC';
  v_today date := (now() at time zone 'UTC')::date;
  actions jsonb := '[]'::jsonb;
  paper_moves jsonb := '[]'::jsonb;
begin
  select * into cfg from public.risk_config where venue = 'coinbase';
  select equity, cash, reported_at into eq, cash_amt, snap_at
    from public.account_snapshots where venue = 'coinbase' order by reported_at desc limit 1;
  select max(equity) into peak from public.account_snapshots where venue = 'coinbase' and reported_at > now() - interval '30 days';

  if p_daily then
    select c into v_close from public.candles where asset = 'BTC' and tf = '1d' order by ts desc limit 1;
    select c into v_c90 from public.candles where asset = 'BTC' and tf = '1d' order by ts desc offset 90 limit 1;
    v_btc90 := case when v_c90 > 0 then v_close / v_c90 - 1 end;

    ------------------------------------------------------------------ pass 1: every coin - indicators, regime, paper book, open-trade management
    for u in select * from public.cb_universe order by (tier = 'core') desc, symbol loop
      select count(*) into v_n from public.candles where asset = u.symbol and tf = '1d';
      if v_n < 200 then
        actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'data', 'detail', format('only %s daily candles stored - need 200+', v_n));
        continue;
      end if;
      st := false;
      for r in select c, avg(c) over w as m, count(*) over w as n
                 from public.candles where asset = u.symbol and tf = '1d'
               window w as (order by ts rows between 199 preceding and current row) order by ts loop
        if r.n < 200 then st := false;
        elsif not st and r.c > r.m * 1.02 then st := true;
        elsif st and r.c < r.m * 0.97 then st := false; end if;
      end loop;
      v_reg := case when st then 'bull' else 'bear' end;
      select ts::date, o, h, l, c into v_asof, v_bo, v_bh, v_bl, v_close from public.candles where asset = u.symbol and tf = '1d' order by ts desc limit 1;
      select avg(c) into v_sma from (select c from public.candles where asset = u.symbol and tf = '1d' order by ts desc limit 200) x;
      select avg(tr) into v_atr from (
        select greatest(h - l, coalesce(abs(h - pc), 0), coalesce(abs(l - pc), 0)) as tr
          from (select ts, h, l, lag(c) over (order by ts) as pc from public.candles where asset = u.symbol and tf = '1d') y
         order by ts desc limit 14) x;
      select max(h) into v_hh from (select h from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 55) x;
      select min(l) into v_ll20 from (select l from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 20) x;
      select min(l) into v_ll10 from (select l from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 10) x;
      select c into v_c90 from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 90 limit 1;
      v_ret90 := case when v_c90 > 0 then v_close / v_c90 - 1 end;
      v_wk := null;
      for r in select c from (select distinct on (date_trunc('week', ts)) ts, c from public.candles
                               where asset = u.symbol and tf = '1d' order by date_trunc('week', ts), ts desc) w order by ts loop
        v_wk := case when v_wk is null then r.c else v_wk + (2.0 / 21) * (r.c - v_wk) end;
      end loop;

      -- paper book: manage the open paper position on the newest closed bar, then open one on a fresh breakout
      for p in select * from public.cb_paper where symbol = u.symbol and status = 'open' and coalesce(last_bar, opened_on) < v_asof loop
        v_px := null; v_why := null; v_tp1_done := p.tp1_done; v_new := p.cur_stop;
        if v_bl <= v_new then v_px := least(v_bo, v_new); v_why := 'stop';
        else
          if not v_tp1_done and v_bh >= p.tp1 then v_tp1_done := true; v_new := greatest(v_new, p.entry * 1.012); end if;
          if v_tp1_done and v_ll20 is not null then v_new := greatest(v_new, v_ll20); end if;
          if v_reg = 'bear' then v_px := v_close; v_why := 'regime'; end if;
        end if;
        if v_px is not null then
          update public.cb_paper set status = 'closed', closed_on = v_asof, exit_px = v_px, why = v_why, tp1_done = v_tp1_done, cur_stop = v_new, last_bar = v_asof,
                 r = round(((case when v_tp1_done then 0.5 * p.tp1 * 0.996 + 0.5 * v_px * 0.994 else v_px * 0.994 end) - p.entry * 1.006)
                           / ((p.entry - p.stop0) + 0.012 * p.entry), 3)
           where id = p.id;
          paper_moves := paper_moves || jsonb_build_object('symbol', u.symbol, 'paper', 'closed', 'why', v_why);
        else
          update public.cb_paper set tp1_done = v_tp1_done, cur_stop = v_new, last_bar = v_asof where id = p.id;
        end if;
      end loop;
      if v_reg = 'bull' and v_hh is not null and v_close > v_hh and v_atr > 0 and v_close - 3 * v_atr > 0
         and not exists (select 1 from public.cb_paper where symbol = u.symbol and status = 'open') then
        insert into public.cb_paper (symbol, source, opened_on, entry, stop0, tp1, cur_stop, last_bar)
        values (u.symbol, 'paper', v_asof, v_close, v_close - 3 * v_atr, v_close + 9 * v_atr, v_close - 3 * v_atr, v_asof)
        on conflict (symbol, opened_on) do nothing;
        paper_moves := paper_moves || jsonb_build_object('symbol', u.symbol, 'paper', 'opened');
      end if;
      select count(*), avg(cp.r) into v_pn, v_pavg from public.cb_paper cp where cp.symbol = u.symbol and cp.status = 'closed';
      select avg(z.pr) into v_p4 from (select cp.r as pr from public.cb_paper cp where cp.symbol = u.symbol and cp.status = 'closed' order by cp.closed_on desc limit 4) z;
      v_live := u.tier = 'core' or (v_pn >= 4 and v_pavg >= 0.5);
      v_held := exists (select 1 from public.trades where venue = 'coinbase' and status = 'open' and symbol = u.symbol);

      update public.cb_universe set regime = v_reg,
             regime_since = case when regime is distinct from v_reg then v_asof else coalesce(regime_since, v_asof) end,
             close = v_close, sma200 = round(v_sma, 8), bear_line = round(v_sma * 0.97, 8), bull_line = round(v_sma * 1.02, 8),
             trigger_px = v_hh, atr14 = round(v_atr, 8), ll20 = v_ll20, wk_ema20 = round(v_wk, 8), as_of = v_asof,
             rs90 = case when u.symbol = 'BTC' then 0 else round((v_ret90 - v_btc90) * 100, 2) end,
             paper_n = v_pn, paper_avg_r = round(v_pavg, 3), paper_last4 = round(v_p4, 3), live = v_live,
             live_reason = case when u.tier = 'core' then 'core coin'
                                when v_live then format('earned: %s paper trades, avg %sR', v_pn, round(v_pavg, 2))
                                else format('paper only: %s paper trades, avg %sR (needs 4+ and +0.5R)', v_pn, coalesce(round(v_pavg, 2)::text, 'n/a')) end,
             updated_at = now()
       where symbol = u.symbol;
      if u.live is distinct from v_live and u.as_of is not null then
        actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', case when v_live then 'promoted' else 'demoted' end,
                                                 'detail', format('%s paper trades, avg %sR', v_pn, round(v_pavg, 2)));
      end if;
      if u.regime is not null and u.regime is distinct from v_reg then
        insert into public.cb_signals (as_of, symbol, kind, close, regime, note)
        values (v_asof, u.symbol, 'regime_flip', v_close, v_reg, format('%s -> %s (200D %s, bear line %s, bull line %s)', u.regime, v_reg, round(v_sma, 6), round(v_sma * 0.97, 6), round(v_sma * 1.02, 6)))
        on conflict (as_of, symbol, kind) do nothing;
        if v_live or v_held then
          actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'regime_flip', 'detail', format('%s -> %s at %s', u.regime, v_reg, v_close));
        end if;
      end if;

      select * into t from public.trades where venue = 'coinbase' and status = 'open' and symbol = u.symbol limit 1;
      if found then
        if v_reg = 'bear' then
          if not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'close' and status in ('pending','acknowledged')) then
            begin
              insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, reference_price, expires_at,
                position_guidance, setup_type, horizon)
              values ('coinbase', 'grok', 'close', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), v_close, v_exp + interval '2 days',
                format('REGIME EXIT: %s closed %s, below the bear line %s (0.97 x 200D). Sell everything still held at market, cancel its open orders, record the fill with reason "manual" and notes "regime flip".', t.symbol, v_close, round(v_sma * 0.97, 6)),
                'cb_breakout55', 'swing') returning * into v_ho;
              insert into public.cb_signals (as_of, symbol, kind, close, regime, handoff_id, trade_id, note)
              values (v_asof, t.symbol, 'exit_regime', v_close, v_reg, v_ho.handoff_id, t.trade_id, 'close below 0.97 x 200D') on conflict (as_of, symbol, kind) do nothing;
              actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'exit_regime', 'handoff_id', v_ho.handoff_id);
            exception when others then
              actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'exit_regime', 'error', sqlerrm);
            end;
          end if;
        else
          v_tp1_done := exists (select 1 from public.trade_exits x where x.trade_id = t.trade_id and x.reason = 'tp1' and x.voided_at is null);
          if v_tp1_done then
            v_new := greatest(coalesce(t.current_stop, t.stop), t.entry * 1.012,
                              case when t.symbol = 'BTC' and v_close > 100000 then v_ll10 else v_ll20 end);
            if v_new > coalesce(t.current_stop, t.stop) * 1.0025 and v_new < v_close
               and not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'adjust_stop' and status in ('pending','acknowledged')) then
              begin
                insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, stop_price, reference_price, expires_at,
                  position_guidance, setup_type, horizon)
                values ('coinbase', 'grok', 'adjust_stop', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), v_new, v_close, v_exp + interval '1 day',
                  format('TRAIL: raise the stop on the %s still held from %s to %s (%s). Replace the stop order (or keep it as the soft stop) and PATCH current_stop.',
                    t.symbol, coalesce(t.current_stop, t.stop), v_new,
                    case when t.symbol = 'BTC' and v_close > 100000 then 'prior 10-day low - BTC above 100k overlay' else 'prior 20-day low' end),
                  'cb_breakout55', 'swing') returning * into v_ho;
                insert into public.cb_signals (as_of, symbol, kind, close, stop, handoff_id, trade_id, note)
                values (v_asof, t.symbol, 'trail', v_close, v_new, v_ho.handoff_id, t.trade_id,
                  case when t.symbol = 'BTC' and v_close > 100000 then 'overlay 100-105k: 10-day low' else '20-day low' end)
                on conflict (as_of, symbol, kind) do nothing;
                actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'trail', 'handoff_id', v_ho.handoff_id, 'stop', v_new);
              exception when others then
                actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'trail', 'error', sqlerrm);
              end;
            end if;
          end if;
        end if;
      end if;
    end loop;

    ------------------------------------------------------------------ pass 2: entries - core coins first, then alts by 90-day strength vs BTC
    v_btc_bull := (select regime from public.cb_universe where symbol = 'BTC') = 'bull';
    for u in select * from public.cb_universe
              where regime = 'bull' and trigger_px is not null and close > trigger_px and as_of = v_today - 1
                and not exists (select 1 from public.trades x where x.venue = 'coinbase' and x.status = 'open' and x.symbol = cb_universe.symbol)
                and not exists (select 1 from public.handoffs x where x.broker = 'coinbase' and x.action = 'open' and x.symbol = cb_universe.symbol and x.status in ('pending','acknowledged'))
              order by (tier = 'core') desc, rs90 desc nulls last, symbol loop
      v_price := (select (q ->> 'price')::numeric from jsonb_array_elements(p_quotes) q where upper(q ->> 'symbol') = u.symbol limit 1);
      v_ref := coalesce(v_price, u.close);
      v_gate := round(v_ref * 1.01, 8);
      v_stop := round(v_ref - 3 * u.atr14, 8);
      v_tp1 := round(v_ref + 3 * (v_ref - v_stop), 8);
      v_block := null; v_qty := null; v_notional := null;
      select count(*) into streak from (select realized_pnl from public.trades where venue = 'coinbase' and status = 'closed'
                                         order by closed_at desc limit cfg.losing_streak_len) z where z.realized_pnl < 0;
      risk_pct := cfg.risk_per_trade_pct * u.risk_mult * case when streak >= cfg.losing_streak_len then 0.5 else 1 end;
      if u.status <> 'active' then v_block := 'paused by the Strategist: ' || coalesce(u.notes, 'no reason given');
      elsif not u.live then v_block := u.live_reason;
      elsif u.tier <> 'core' and not v_btc_bull then v_block := 'alt breakout while BTC is not bull - alts only trade in a BTC bull regime';
      elsif v_stop <= 0 then v_block := 'stop would be below zero';
      elsif not cfg.auto_execute then v_block := 'auto-execution paused';
      elsif eq is null or snap_at < now() - interval '2 days' then v_block := 'no fresh Coinbase account snapshot from Grok';
      elsif peak is not null and eq <= peak * (1 - cfg.drawdown_stop_pct / 100) then v_block := format('drawdown pause (equity %s vs 30-day peak %s)', eq, peak);
      else
        select coalesce(sum(greatest(0, (entry - coalesce(current_stop, stop)) * coalesce(qty_open, quantity))), 0),
               coalesce(sum(entry * coalesce(qty_open, quantity)), 0)
          into open_risk, exposure from public.trades where venue = 'coinbase' and status = 'open';
        select open_risk + coalesce(sum(risk_dollars), 0), exposure + coalesce(sum(coalesce(limit_price, reference_price) * quantity), 0)
          into open_risk, exposure from public.handoffs where broker = 'coinbase' and action = 'open' and status in ('pending','acknowledged');
        rk := least(risk_pct / 100, cfg.max_open_risk_pct / 100 - open_risk / eq);
        if rk < 0.01 then v_block := format('open-risk budget full (%s pct of %s pct used)', round(100 * open_risk / eq, 1), cfg.max_open_risk_pct);
        else
          per_unit := (v_gate - v_stop) + v_gate * 0.012;
          v_qty := eq * rk / per_unit;
          v_cap := least(coalesce(cash_amt, eq) * 0.995, eq - exposure);
          if v_qty * v_gate > v_cap then v_qty := v_cap / v_gate; end if;
          v_qty := case when v_gate < 1 then trunc(v_qty, 0) else trunc(v_qty, 6) end;
          v_notional := round(v_qty * v_gate, 2);
          if v_notional < greatest(2, eq * 0.05) then v_block := format('position too small ($%s) - cash or budget used up', v_notional); end if;
        end if;
      end if;
      if v_block is null then
        begin
          insert into public.handoffs (broker, destination, action, symbol, direction, order_type, reference_price, limit_price, stop_price,
            target_1, quantity, setup_type, horizon, sleeve, expires_at, entry_condition, invalidation, target_framework, position_guidance)
          values ('coinbase', 'grok', 'open', u.symbol, 'long', 'market', v_ref, v_gate, v_stop, v_tp1, v_qty, 'cb_breakout55', 'swing', 'trading', v_exp,
            format('Market buy about $%s of %s (%s %s) now. Gate: never pay more than %s. Daily close %s broke the 55-day high %s; regime BULL%s.',
              round(v_qty * v_ref, 2), u.product_id, v_qty, u.symbol, v_gate, u.close, u.trigger_px,
              case when u.tier = 'core' then '' else format('; alt live on its record (%s)', u.live_reason) end),
            format('Stop %s (3 x ATR14 %s below). A daily close below the bear line %s exits everything.', v_stop, round(u.atr14, 8), u.bear_line),
            format('TP1 %s = 3R: GTC limit sell for HALF. Then stop on the rest to entry +1.2%%, trail the prior 20-day low.', v_tp1),
            format('Risk %s pct of $%s equity incl. fees (%s). Place the stop (stop-limit or bracket) if your connector allows it, else soft stop.',
              round(100 * rk, 2), eq, case when u.tier = 'core' then 'core coin, full risk' else 'alt, half risk' end))
          returning * into v_ho;
          insert into public.cb_signals (as_of, symbol, kind, close, trigger_px, stop, tp1, atr14, regime, risk_pct, quantity, notional, handoff_id, note)
          values (u.as_of, u.symbol, 'entry', u.close, u.trigger_px, v_stop, v_tp1, u.atr14, u.regime, round(100 * rk, 2), v_qty, v_notional, v_ho.handoff_id,
                  format('%s, rs90 %s, ref %s gate %s', u.tier, u.rs90, v_ref, v_gate))
          on conflict (as_of, symbol, kind) do nothing;
          actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'entry', 'tier', u.tier, 'handoff_id', v_ho.handoff_id, 'quantity', v_qty,
            'notional', v_notional, 'ref', v_ref, 'gate', v_gate, 'stop', v_stop, 'tp1', v_tp1, 'risk_pct', round(100 * rk, 2));
        exception when others then
          v_block := sqlerrm;
        end;
      end if;
      if v_block is not null then
        insert into public.cb_signals (as_of, symbol, kind, close, trigger_px, stop, tp1, atr14, regime, risk_pct, quantity, notional, blocked_by)
        values (u.as_of, u.symbol, 'no_entry', u.close, u.trigger_px, v_stop, v_tp1, u.atr14, u.regime, risk_pct, v_qty, v_notional, v_block)
        on conflict (as_of, symbol, kind) do nothing;
        -- paper-only coins are logged quietly; only live coins blocked by risk rules are reported
        if u.live and u.status = 'active' then
          actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'entry_blocked', 'blocked_by', v_block, 'stop', v_stop, 'tp1', v_tp1);
        end if;
      end if;
    end loop;
  end if;

  -------------------------------------------------------------------------- every run: stop / TP1 / breakeven on live trades
  for t in select * from public.trades where venue = 'coinbase' and status = 'open' loop
    select (q ->> 'price')::numeric, (q ->> 'high')::numeric, (q ->> 'low')::numeric into v_price, v_high, v_low
      from jsonb_array_elements(p_quotes) q where upper(q ->> 'symbol') = t.symbol limit 1;
    if v_price is null then continue; end if;
    v_low := coalesce(v_low, v_price); v_high := coalesce(v_high, v_price);
    if exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'adjust_stop' and status = 'executed'
               and coalesce(responded_at, updated_at) > date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then
      v_low := v_price;
    end if;
    v_tp1_done := exists (select 1 from public.trade_exits x where x.trade_id = t.trade_id and x.reason = 'tp1' and x.voided_at is null);
    if v_low <= coalesce(t.current_stop, t.stop) then
      if not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'close' and status in ('pending','acknowledged')) then
        v_kind := case when coalesce(t.current_stop, t.stop) > t.stop then 'trail' else 'stop' end;
        begin
          insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, stop_price, reference_price, expires_at, position_guidance, setup_type, horizon)
          values ('coinbase', 'grok', 'close', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), coalesce(t.current_stop, t.stop), v_price, now() + interval '2 days',
            format('STOP HIT: %s traded %s, at or below the stop %s. If your exchange stop already filled, just record it (POST /exits reason "%s"). Otherwise market-sell everything still held now and record it.',
              t.symbol, v_low, coalesce(t.current_stop, t.stop), v_kind), 'cb_breakout55', 'swing') returning * into v_ho;
          insert into public.cb_signals (as_of, symbol, kind, close, stop, handoff_id, trade_id, note)
          values (v_today, t.symbol, 'stop', v_price, coalesce(t.current_stop, t.stop), v_ho.handoff_id, t.trade_id, v_kind) on conflict (as_of, symbol, kind) do nothing;
          actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'stop', 'handoff_id', v_ho.handoff_id, 'low', v_low);
        exception when others then
          actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'stop', 'error', sqlerrm);
        end;
      end if;
    elsif not v_tp1_done and v_high >= coalesce(t.current_tp1, t.tp1) then
      if not exists (select 1 from public.handoffs where trade_id = t.trade_id and action in ('trim','close') and status in ('pending','acknowledged')) then
        begin
          insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, reference_price, target_1, expires_at, position_guidance, setup_type, horizon)
          values ('coinbase', 'grok', 'trim', t.trade_id, t.symbol, 'long', 'limit', trunc(t.quantity / 2, 8), coalesce(t.current_tp1, t.tp1), coalesce(t.current_tp1, t.tp1), now() + interval '2 days',
            format('TP1 %s reached (high %s). Your GTC limit for half should have filled: if it did, record it (POST /exits reason "tp1") and mark this executed. If no TP1 order was working, sell HALF the original size (%s) now.',
              coalesce(t.current_tp1, t.tp1), v_high, trunc(t.quantity / 2, 8)), 'cb_breakout55', 'swing') returning * into v_ho;
          insert into public.cb_signals (as_of, symbol, kind, close, tp1, handoff_id, trade_id, note)
          values (v_today, t.symbol, 'tp1', v_price, coalesce(t.current_tp1, t.tp1), v_ho.handoff_id, t.trade_id, 'TP1 touched') on conflict (as_of, symbol, kind) do nothing;
          actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'tp1', 'handoff_id', v_ho.handoff_id, 'high', v_high);
        exception when others then
          actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'tp1', 'error', sqlerrm);
        end;
      end if;
    elsif v_tp1_done and coalesce(t.current_stop, t.stop) < t.entry * 1.012
          and not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'adjust_stop' and status in ('pending','acknowledged')) then
      begin
        insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, stop_price, reference_price, expires_at, position_guidance, setup_type, horizon)
        values ('coinbase', 'grok', 'adjust_stop', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), round(t.entry * 1.012, 8), v_price, now() + interval '2 days',
          format('TP1 is banked: move the stop on the rest to %s (entry +1.2%%, covers fees) so the runner cannot lose.', round(t.entry * 1.012, 8)), 'cb_breakout55', 'swing') returning * into v_ho;
        actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'breakeven', 'handoff_id', v_ho.handoff_id);
      exception when others then
        actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'breakeven', 'error', sqlerrm);
      end;
    end if;
  end loop;

  return jsonb_build_object('ran_at', now(), 'daily', p_daily, 'equity', eq, 'snapshot_at', snap_at, 'actions', actions,
    'paper_moves', jsonb_array_length(paper_moves),
    'live_coins', (select jsonb_agg(jsonb_build_object('symbol', symbol, 'tier', tier, 'regime', regime, 'close', close, 'trigger', trigger_px,
       'rs90', rs90, 'paper', format('%s @ %sR', paper_n, round(paper_avg_r, 2))) order by (tier = 'core') desc, rs90 desc nulls last)
       from public.cb_universe where live and status = 'active'),
    'counts', (select jsonb_build_object('coins', count(*), 'live', count(*) filter (where live), 'bull', count(*) filter (where regime = 'bull')) from public.cb_universe),
    'open', (select coalesce(jsonb_agg(jsonb_build_object('trade_id', trade_id, 'symbol', symbol, 'entry', entry, 'stop', coalesce(current_stop, stop),
       'tp1', coalesce(current_tp1, tp1), 'qty_open', coalesce(qty_open, quantity))), '[]'::jsonb) from public.trades where venue = 'coinbase' and status = 'open'));
end $$;

-- 5. Later 2026-10-10 - Stavros: "im not too keen on alts myself for the agentic trading". Alts off for live trading,
--    paper tracking continues. Applied live:
alter table public.risk_config add column if not exists alts_live boolean not null default false;
--    cb_run(): v_live := u.tier = 'core' or (coalesce(cfg.alts_live, false) and v_pn >= 4 and v_pavg >= 0.5);
--    live_reason for a qualifying alt: 'paper only - alts are off for live trading; record would qualify: ...'
update public.cb_universe set live = false where tier = 'alt';

-- 6. 2026-10-11 - Leverage desk (Stavros): 2R minimum, 4% max risk, silent range lines, no-chase cooling.
--    Applied live:
--    risk_config blofin: risk_per_trade_pct 4, risk_tiers [{"risk_pct":4}], allowed_instruments text updated.
--    moonbag_lev_signal_check(): 'if new.rr_tp1 < 1.5' -> 'if new.rr_tp1 < 1.995' (minimum 2R).
--    lev_strategy v13 (rules: min_rr_tp1 2, risk_pct_by_grade core {3:2,4:4,5:4}, rotation {3:1,4:2,5:4},
--    cooling, alerts_policy silent lines, input_recipe). strategy_doc v11.
update public.risk_config set risk_per_trade_pct = 4, risk_tiers = '[{"risk_pct":4}]'::jsonb where venue = 'blofin';
