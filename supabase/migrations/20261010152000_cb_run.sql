-- Coinbase desk engine (Book 3). The scheduled "Moonbag Coinbase desk (hourly)" task only stores closed daily
-- candles, fetches quotes and calls this; every decision (regime, entries, sizing, stops, TP1, trail, regime
-- exits) is made here in SQL so it matches cb_backtest() and docs/strategy/COINBASE_STRATEGY.md exactly.
--   select public.cb_run('[{"symbol":"BTC","price":82750,"high":83100,"low":82100}]'::jsonb, true);
-- p_daily = true once per UTC day after the 00:00 UTC close: refresh regime/triggers, entries, trail, regime exits.
-- Every run: stop / TP1 / breakeven checks on open Coinbase trades from the quotes (day high/low).
-- Handoffs are inserted here (broker 'coinbase'); the database risk gate (moonbag_check_handoff_coinbase) still
-- checks each one, and a rejection is recorded in cb_signals.blocked_by instead of failing the run.
create or replace function public.cb_run(p_quotes jsonb default '[]'::jsonb, p_daily boolean default false)
returns jsonb language plpgsql as $$
declare
  cfg public.risk_config; u record; t record; r record; v_ho public.handoffs;
  eq numeric; cash_amt numeric; snap_at timestamptz; exposure numeric; open_risk numeric; streak integer; risk_pct numeric; peak numeric;
  v_asof date; v_close numeric; v_sma numeric; v_n integer; v_atr numeric; v_hh numeric; v_ll20 numeric; v_ll10 numeric; v_wk numeric;
  v_reg text; st boolean;
  v_ref numeric; v_gate numeric; v_stop numeric; v_tp1 numeric; per_unit numeric; v_qty numeric; v_notional numeric; v_cap numeric; rk numeric;
  v_block text; v_price numeric; v_high numeric; v_low numeric; v_new numeric; v_tp1_done boolean; v_kind text;
  v_exp timestamptz := (date_trunc('day', now() at time zone 'UTC') + interval '1 day' - interval '5 minutes') at time zone 'UTC';
  v_today date := (now() at time zone 'UTC')::date;
  actions jsonb := '[]'::jsonb;
begin
  select * into cfg from public.risk_config where venue = 'coinbase';
  select equity, cash, reported_at into eq, cash_amt, snap_at
    from public.account_snapshots where venue = 'coinbase' order by reported_at desc limit 1;
  select max(equity) into peak from public.account_snapshots where venue = 'coinbase' and reported_at > now() - interval '30 days';

  -------------------------------------------------------------------------- daily: regime, triggers, entries
  if p_daily then
    for u in select * from public.cb_universe where status = 'active' order by symbol loop
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
      select ts::date, c into v_asof, v_close from public.candles where asset = u.symbol and tf = '1d' order by ts desc limit 1;
      select avg(c) into v_sma from (select c from public.candles where asset = u.symbol and tf = '1d' order by ts desc limit 200) x;
      select avg(tr) into v_atr from (
        select greatest(h - l, coalesce(abs(h - pc), 0), coalesce(abs(l - pc), 0)) as tr
          from (select ts, h, l, lag(c) over (order by ts) as pc from public.candles where asset = u.symbol and tf = '1d') y
         order by ts desc limit 14) x;
      select max(h) into v_hh from (select h from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 55) x;
      select min(l) into v_ll20 from (select l from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 20) x;
      select min(l) into v_ll10 from (select l from public.candles where asset = u.symbol and tf = '1d' order by ts desc offset 1 limit 10) x;
      v_wk := null;
      for r in select c from (select distinct on (date_trunc('week', ts)) ts, c from public.candles
                               where asset = u.symbol and tf = '1d' order by date_trunc('week', ts), ts desc) w order by ts loop
        v_wk := case when v_wk is null then r.c else v_wk + (2.0 / 21) * (r.c - v_wk) end;
      end loop;
      update public.cb_universe set regime = v_reg,
             regime_since = case when regime is distinct from v_reg then v_asof else coalesce(regime_since, v_asof) end,
             close = v_close, sma200 = round(v_sma, 4), bear_line = round(v_sma * 0.97, 4), bull_line = round(v_sma * 1.02, 4),
             trigger_px = v_hh, atr14 = round(v_atr, 4), ll20 = v_ll20, wk_ema20 = round(v_wk, 4), as_of = v_asof, updated_at = now()
       where symbol = u.symbol;
      if u.regime is not null and u.regime is distinct from v_reg then
        insert into public.cb_signals (as_of, symbol, kind, close, regime, note)
        values (v_asof, u.symbol, 'regime_flip', v_close, v_reg, format('%s -> %s (200D %s, bear line %s, bull line %s)', u.regime, v_reg, round(v_sma), round(v_sma * 0.97), round(v_sma * 1.02)))
        on conflict (as_of, symbol, kind) do nothing;
        actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'regime_flip', 'detail', format('%s -> %s at %s', u.regime, v_reg, v_close));
      end if;

      select * into t from public.trades where venue = 'coinbase' and status = 'open' and symbol = u.symbol limit 1;
      if found then
        -- regime exit
        if v_reg = 'bear' then
          if not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'close' and status in ('pending','acknowledged')) then
            begin
              insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, reference_price, expires_at,
                position_guidance, setup_type, horizon)
              values ('coinbase', 'grok', 'close', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), v_close, v_exp + interval '2 days',
                format('REGIME EXIT: %s closed %s, below the bear line %s (0.97 x 200D). Sell everything still held at market, cancel its open orders, record the fill with reason "manual" and notes "regime flip".', t.symbol, v_close, round(v_sma * 0.97, 2)),
                'cb_breakout55', 'swing') returning * into v_ho;
              insert into public.cb_signals (as_of, symbol, kind, close, regime, handoff_id, trade_id, note)
              values (v_asof, t.symbol, 'exit_regime', v_close, v_reg, v_ho.handoff_id, t.trade_id, 'close below 0.97 x 200D') on conflict (as_of, symbol, kind) do nothing;
              actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'exit_regime', 'handoff_id', v_ho.handoff_id);
            exception when others then
              actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'exit_regime', 'error', sqlerrm);
            end;
          end if;
        else
          -- trail the runner after TP1: prior 20-day low (10-day low for BTC above 100k), never below entry +1.2%
          v_tp1_done := exists (select 1 from public.trade_exits x where x.trade_id = t.trade_id and x.reason = 'tp1' and x.voided_at is null);
          if v_tp1_done then
            v_new := greatest(coalesce(t.current_stop, t.stop), t.entry * 1.012,
                              case when t.symbol = 'BTC' and v_close > 100000 then v_ll10 else v_ll20 end);
            if v_new > coalesce(t.current_stop, t.stop) * 1.0025 and v_new < v_close
               and not exists (select 1 from public.handoffs where trade_id = t.trade_id and action = 'adjust_stop' and status in ('pending','acknowledged')) then
              begin
                insert into public.handoffs (broker, destination, action, trade_id, symbol, direction, order_type, quantity, stop_price, reference_price, expires_at,
                  position_guidance, setup_type, horizon)
                values ('coinbase', 'grok', 'adjust_stop', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), round(v_new, 2), v_close, v_exp + interval '1 day',
                  format('TRAIL: raise the stop on the %s still held from %s to %s (%s). Replace the stop order (or keep it as the soft stop) and PATCH current_stop.',
                    t.symbol, coalesce(t.current_stop, t.stop), round(v_new, 2),
                    case when t.symbol = 'BTC' and v_close > 100000 then 'prior 10-day low - BTC above 100k overlay' else 'prior 20-day low' end),
                  'cb_breakout55', 'swing') returning * into v_ho;
                insert into public.cb_signals (as_of, symbol, kind, close, stop, handoff_id, trade_id, note)
                values (v_asof, t.symbol, 'trail', v_close, round(v_new, 2), v_ho.handoff_id, t.trade_id,
                  case when t.symbol = 'BTC' and v_close > 100000 then 'overlay 100-105k: 10-day low' else '20-day low' end)
                on conflict (as_of, symbol, kind) do nothing;
                actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'trail', 'handoff_id', v_ho.handoff_id, 'stop', round(v_new, 2));
              exception when others then
                actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'trail', 'error', sqlerrm);
              end;
            end if;
          end if;
        end if;
        continue;
      end if;

      -- entry signal
      if v_reg = 'bull' and v_hh is not null and v_close > v_hh
         and not exists (select 1 from public.handoffs where broker = 'coinbase' and action = 'open' and symbol = u.symbol and status in ('pending','acknowledged')) then
        v_price := (select (q ->> 'price')::numeric from jsonb_array_elements(p_quotes) q where upper(q ->> 'symbol') = u.symbol limit 1);
        v_ref := coalesce(v_price, v_close);
        v_gate := round(v_ref * 1.01, 2);
        v_stop := round(v_ref - 3 * v_atr, 2);
        v_tp1 := round(v_ref + 3 * (v_ref - v_stop), 2);
        v_block := null; v_qty := null; v_notional := null;
        select count(*) into streak from (select realized_pnl from public.trades where venue = 'coinbase' and status = 'closed'
                                           order by closed_at desc limit cfg.losing_streak_len) z where z.realized_pnl < 0;
        risk_pct := cfg.risk_per_trade_pct * case when streak >= cfg.losing_streak_len then 0.5 else 1 end;
        select coalesce(sum(greatest(0, (entry - coalesce(current_stop, stop)) * coalesce(qty_open, quantity))), 0),
               coalesce(sum(entry * coalesce(qty_open, quantity)), 0)
          into open_risk, exposure from public.trades where venue = 'coinbase' and status = 'open';
        select open_risk + coalesce(sum(risk_dollars), 0), exposure + coalesce(sum(coalesce(limit_price, reference_price) * quantity), 0)
          into open_risk, exposure from public.handoffs where broker = 'coinbase' and action = 'open' and status in ('pending','acknowledged');
        if not cfg.auto_execute then v_block := 'auto-execution paused';
        elsif eq is null or snap_at < now() - interval '2 days' then v_block := 'no fresh Coinbase account snapshot from Grok';
        elsif peak is not null and eq <= peak * (1 - cfg.drawdown_stop_pct / 100) then v_block := format('drawdown pause (equity %s vs 30-day peak %s)', eq, peak);
        else
          rk := least(risk_pct / 100, cfg.max_open_risk_pct / 100 - open_risk / eq);
          if rk < 0.01 then v_block := format('open-risk budget full (%s pct of %s pct used)', round(100 * open_risk / eq, 1), cfg.max_open_risk_pct);
          else
            per_unit := (v_gate - v_stop) + v_gate * 0.012;
            v_qty := eq * rk / per_unit;
            v_cap := least(coalesce(cash_amt, eq) * 0.995, eq - exposure);
            if v_qty * v_gate > v_cap then v_qty := v_cap / v_gate; end if;
            v_qty := trunc(v_qty, 6);
            v_notional := round(v_qty * v_gate, 2);
            if v_notional < greatest(2, eq * 0.05) then v_block := format('position too small ($%s) - cash or budget used up', v_notional); end if;
          end if;
        end if;
        if v_block is null then
          begin
            insert into public.handoffs (broker, destination, action, symbol, direction, order_type, reference_price, limit_price, stop_price,
              target_1, quantity, setup_type, horizon, sleeve, expires_at, entry_condition, invalidation, target_framework, position_guidance)
            values ('coinbase', 'grok', 'open', u.symbol, 'long', 'market', v_ref, v_gate, v_stop, v_tp1, v_qty, 'cb_breakout55', 'swing', 'trading', v_exp,
              format('Market buy about $%s of %s (%s %s) now. Gate: never pay more than %s. Daily close %s broke the 55-day high %s; regime BULL.',
                round(v_qty * v_ref, 2), u.product_id, v_qty, u.symbol, v_gate, v_close, v_hh),
              format('Stop %s (3 x ATR14 %s below). A daily close below the bear line %s exits everything.', v_stop, round(v_atr, 2), round(v_sma * 0.97, 2)),
              format('TP1 %s = 3R: GTC limit sell for HALF. Then stop on the rest to entry +1.2%%, trail the prior 20-day low.', v_tp1),
              format('Risk %s pct of $%s equity incl. fees. Place the stop (stop-limit or bracket) if your connector allows it, else soft stop.', round(100 * rk, 2), eq))
            returning * into v_ho;
            insert into public.cb_signals (as_of, symbol, kind, close, trigger_px, stop, tp1, atr14, regime, risk_pct, quantity, notional, handoff_id, note)
            values (v_asof, u.symbol, 'entry', v_close, v_hh, v_stop, v_tp1, round(v_atr, 4), v_reg, round(100 * rk, 2), v_qty, v_notional, v_ho.handoff_id,
                    format('ref %s gate %s', v_ref, v_gate))
            on conflict (as_of, symbol, kind) do nothing;
            actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'entry', 'handoff_id', v_ho.handoff_id, 'quantity', v_qty,
              'notional', v_notional, 'ref', v_ref, 'gate', v_gate, 'stop', v_stop, 'tp1', v_tp1, 'risk_pct', round(100 * rk, 2));
          exception when others then
            v_block := sqlerrm;
          end;
        end if;
        if v_block is not null then
          insert into public.cb_signals (as_of, symbol, kind, close, trigger_px, stop, tp1, atr14, regime, risk_pct, quantity, notional, blocked_by)
          values (v_asof, u.symbol, 'no_entry', v_close, v_hh, v_stop, v_tp1, round(v_atr, 4), v_reg, risk_pct, v_qty, v_notional, v_block)
          on conflict (as_of, symbol, kind) do nothing;
          actions := actions || jsonb_build_object('symbol', u.symbol, 'kind', 'entry_blocked', 'blocked_by', v_block, 'stop', v_stop, 'tp1', v_tp1);
        end if;
      end if;
    end loop;
  end if;

  -------------------------------------------------------------------------- every run: stop / TP1 / breakeven
  for t in select * from public.trades where venue = 'coinbase' and status = 'open' loop
    select (q ->> 'price')::numeric, (q ->> 'high')::numeric, (q ->> 'low')::numeric into v_price, v_high, v_low
      from jsonb_array_elements(p_quotes) q where upper(q ->> 'symbol') = t.symbol limit 1;
    if v_price is null then continue; end if;
    v_low := coalesce(v_low, v_price); v_high := coalesce(v_high, v_price);
    -- a stop raised today: the day's earlier low doesn't count against it, only the current price
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
        values ('coinbase', 'grok', 'adjust_stop', t.trade_id, t.symbol, 'long', 'market', coalesce(t.qty_open, t.quantity), round(t.entry * 1.012, 2), v_price, now() + interval '2 days',
          format('TP1 is banked: move the stop on the rest to %s (entry +1.2%%, covers fees) so the runner cannot lose.', round(t.entry * 1.012, 2)), 'cb_breakout55', 'swing') returning * into v_ho;
        actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'breakeven', 'handoff_id', v_ho.handoff_id);
      exception when others then
        actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'breakeven', 'error', sqlerrm);
      end;
    end if;
  end loop;

  return jsonb_build_object('ran_at', now(), 'daily', p_daily, 'equity', eq, 'snapshot_at', snap_at, 'actions', actions,
    'universe', (select jsonb_agg(jsonb_build_object('symbol', symbol, 'regime', regime, 'since', regime_since, 'close', close,
       'trigger', trigger_px, 'bear_line', bear_line, 'atr14', atr14, 'as_of', as_of) order by symbol) from public.cb_universe),
    'open', (select coalesce(jsonb_agg(jsonb_build_object('trade_id', trade_id, 'symbol', symbol, 'entry', entry, 'stop', coalesce(current_stop, stop),
       'tp1', coalesce(current_tp1, tp1), 'qty_open', coalesce(qty_open, quantity))), '[]'::jsonb) from public.trades where venue = 'coinbase' and status = 'open'));
end $$;
