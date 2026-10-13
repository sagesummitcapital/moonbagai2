-- Prices on the board and in limit plans: 2 decimals (coins under $1: 4). Stavros, 2026-10-13: "only show .00 decimal points".
create or replace function public.mb_px(x numeric) returns numeric language sql immutable as $$
  select case when x is null then null when abs(x) >= 1 then round(x, 2) else round(x, 4) end $$;

-- lev_limit_plan() and lev_board_refresh(): every round(<value>, 8) became public.mb_px(<value>) (patched in place).
do $x$ declare src text; fn text; begin
foreach fn in array array['lev_limit_plan','lev_board_refresh'] loop
  select prosrc into src from pg_proc where proname = fn;
  src := regexp_replace(src, 'round\(([^,()]+), 8\)', 'public.mb_px(\1)', 'g');
  if fn = 'lev_limit_plan' then
    execute format('create or replace function public.lev_limit_plan(p_assets text[] default null, p_save boolean default true) returns jsonb language plpgsql as %L', src);
  else
    execute format('create or replace function public.lev_board_refresh() returns jsonb language plpgsql as %L', src);
  end if;
end loop; end $x$;
