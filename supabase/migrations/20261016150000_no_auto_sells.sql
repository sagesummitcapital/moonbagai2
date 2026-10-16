-- Stavros 2026-10-16: "yes i want no minimum r - but i will always aim for 2:1" and
-- "we need to make sure you are not automating losses on rh or cb".
-- Applied live via pg_get_functiondef + replace (anchors below). Re-runnable: each block is a no-op once applied.

-- 1) BloFin: no minimum R:R at signal insert (moonbag_lev_signal_check): `if new.rr_tp1 < 1.995` -> `if false and new.rr_tp1 < 1.995`.

-- 2) Coinbase cb_run:
--    a) pass 1 regime exit -> exit_warning action + cb_signals 'exit_regime' note "WARNING only"; the close handoff is disabled (if false and ...).
--    b) pass 2 breakout entries disabled (where false ...); the paper book in pass 1 keeps running.
--    c) intraday stop / TP1 / breakeven handoffs skipped for every Coinbase trade (if true then continue).
do $x$
declare src text; a text; b text; c text; d text; e text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'cb_run';
  if position('exit_warning' in src) > 0 then return; end if;
  a := $q$      if found then
        if v_reg = 'bear' then
          if not exists$q$;
  b := $q$      if found then
        if v_reg = 'bear' then
          -- Stavros 2026-10-16: "make sure you are not automating losses on rh or cb" - a daily close below the bear line is a
          -- WARNING to Stavros only; no close handoff is ever created for a Coinbase hold.
          insert into public.cb_signals (as_of, symbol, kind, close, regime, trade_id, note)
          values (v_asof, t.symbol, 'exit_regime', v_close, v_reg, t.trade_id, format('WARNING only - closed %s below the bear line %s; nothing sold (Stavros decides)', v_close, round(v_sma * 0.97, 6)))
          on conflict (as_of, symbol, kind) do nothing;
          actions := actions || jsonb_build_object('symbol', t.symbol, 'kind', 'exit_warning', 'close', v_close, 'bear_line', round(v_sma * 0.97, 6), 'trade_id', t.trade_id);
          if false and not exists$q$;
  c := $q$              where regime = 'bull' and trigger_px is not null and close > trigger_px and as_of = v_today - 1$q$;
  d := $q$              where false -- Stavros 2026-10-16: Coinbase is long-term holds only; no automated breakout buys (paper book still runs in pass 1)
                and regime = 'bull' and trigger_px is not null and close > trigger_px and as_of = v_today - 1$q$;
  e := $q$    if t.horizon = 'position' then continue; end if;$q$;
  execute replace(replace(replace(src, a, b), c, d), e, $q$    -- Stavros 2026-10-16: no automated loss-taking on Coinbase - no intraday stop/TP handoffs for ANY Coinbase trade.
    if true then continue; end if;$q$);
end $x$;
