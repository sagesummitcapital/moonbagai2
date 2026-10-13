-- 2026-10-13: limit levels allowed from 0.15 x ATR14(1D) from price (was 0.3) in lev_limit_plan() and lev_board_refresh().
-- Evidence: research/limits m2/m3 (386 trades, +0.12R, BTC/ETH/SOL +0.21R, both halves positive). Patched in place.
do $x$ declare src text; fn text; begin
foreach fn in array array['lev_limit_plan','lev_board_refresh'] loop
  select prosrc into src from pg_proc where proname = fn;
  src := replace(src, '0.3 * v_a1d', '0.15 * v_a1d');
  if fn = 'lev_limit_plan' then
    execute format('create or replace function public.lev_limit_plan(p_assets text[] default null, p_save boolean default true) returns jsonb language plpgsql as %L', src);
  else
    execute format('create or replace function public.lev_board_refresh() returns jsonb language plpgsql as %L', src);
  end if;
end loop; end $x$;
