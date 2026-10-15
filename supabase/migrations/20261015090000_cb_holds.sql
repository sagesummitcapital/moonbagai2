-- Coinbase + Robinhood buy-and-hold (Stavros, 2026-10-15: "loosen stops for everything except my lev trades").
-- Applied live on 2026-10-15 by in-place patches; this file re-applies them idempotently.
-- 1) cb_run(): hold trades (horizon 'position') skip the hourly intraday stop / TP1 checks — they exit only on a daily
--    close below the bear line (pass-1 regime exit).
do $x$
declare src text;
begin
  select prosrc into src from pg_proc where proname = 'cb_run';
  if position('hold positions (Stavros 2026-10-15)' in src) > 0 then return; end if;
  src := replace(src, 'if v_price is null then continue; end if;', 'if v_price is null then continue; end if;
    -- hold positions (Stavros 2026-10-15: "loosen stops for everything except my lev trades"): no intraday stop or TP1 check;
    -- they exit only on a DAILY close below the bear line (pass 1 regime exit).
    if t.horizon = ''position'' then continue; end if;');
  execute format('create or replace function public.cb_run(p_quotes jsonb DEFAULT ''[]''::jsonb, p_daily boolean DEFAULT false) returns jsonb language plpgsql as %L', src);
end $x$;

-- 2) moonbag_check_handoff_coinbase(): HOLD BUYs (horizon 'position') — no 2% per-trade cap, no TP1 requirement, several
--    rungs per coin; max_open_positions counts coins. Open-risk, exposure and drawdown caps unchanged.
do $x$
declare src text;
begin
  select prosrc into src from pg_proc where proname = 'moonbag_check_handoff_coinbase';
  if position('HOLD BUY' in src) > 0 then return; end if;
  src := replace(src, 'if new.target_1 is null or new.target_1 <= v_entry then raise',
                      'if coalesce(new.horizon, '''') <> ''position'' and (new.target_1 is null or new.target_1 <= v_entry) then raise');
  src := replace(src, 'if risk > risk_limit * 1.03 then',
                      '-- HOLD BUY (horizon position, Stavros 2026-10-15): dip-ladder rungs on BTC/ETH; no per-trade 2% cap, no one-position-per-coin;
  -- the stop is the bear line (exit on a daily close below it). Open-risk, exposure and drawdown caps still apply.
  if coalesce(new.horizon, '''') <> ''position'' and risk > risk_limit * 1.03 then');
  src := regexp_replace(src, 'if exists \(select 1 from public\.trades where venue = ''coinbase'' and status = ''open'' and symbol = upper\(new\.symbol\)\)\s+or exists \(select 1 from public\.handoffs where broker = ''coinbase'' and action = ''open'' and status in \(''pending'',''acknowledged''\) and symbol = upper\(new\.symbol\)\) then',
     'if coalesce(new.horizon, '''') <> ''position'' and (exists (select 1 from public.trades where venue = ''coinbase'' and status = ''open'' and symbol = upper(new.symbol))
     or exists (select 1 from public.handoffs where broker = ''coinbase'' and action = ''open'' and status in (''pending'',''acknowledged'') and symbol = upper(new.symbol))) then');
  src := regexp_replace(src, 'select trade_id from public\.trades where venue = ''coinbase'' and status = ''open''\s+union all select handoff_id from public\.handoffs where broker = ''coinbase'' and action = ''open'' and status in \(''pending'',''acknowledged''\)',
    'select symbol from public.trades where venue = ''coinbase'' and status = ''open'' and symbol <> upper(new.symbol)
    union select symbol from public.handoffs where broker = ''coinbase'' and action = ''open'' and status in (''pending'',''acknowledged'') and symbol <> upper(new.symbol)');
  execute format('create or replace function public.moonbag_check_handoff_coinbase() returns trigger language plpgsql as %L', src);
end $x$;
