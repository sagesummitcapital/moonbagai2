-- 2026-10-13 (Stavros: "just continue watching my strategy and let's come up with the winner — weekly custom strategy").
-- Fix: lev_limit_resolve() used a record named L, which clashed with candles.l ("column reference l is ambiguous");
-- renamed to lr in place (the original migration file is updated to match).
-- Quick-mode tracking for paper limits + the strategy league view the Saturday review uses to pick the week's winner.
alter table public.limit_orders add column if not exists quick_outcome text, add column if not exists quick_r numeric;

create or replace function public.lev_limit_quick_resolve()
returns integer language plpgsql as $$
declare lr record; b record; sg integer; v_risk numeric; v_stop numeric; v_tgt numeric; v_prev_h numeric; v_prev_l numeric;
        v_out text; v_exit numeric; v_fee numeric; n integer := 0;
begin
  for lr in select * from public.limit_orders where origin = 'paper' and filled_at is not null and quick_outcome is null loop
    sg := case when lr.direction = 'long' then 1 else -1 end;
    v_risk := abs(lr.limit_price - lr.stop); v_stop := lr.stop; v_tgt := lr.limit_price + sg * 2 * v_risk;
    v_out := null; v_prev_h := null; v_prev_l := null;
    for b in select ts, h, l from public.candles where asset = lr.symbol and tf = '1h' and ts >= date_trunc('hour', lr.filled_at) order by ts loop
      if v_prev_h is not null and v_stop = lr.stop and ((sg = 1 and v_prev_h >= lr.limit_price + v_risk) or (sg = -1 and v_prev_l <= lr.limit_price - v_risk)) then
        v_stop := lr.limit_price * (1 + sg * 0.002);
      end if;
      if (sg = 1 and b.l <= v_stop) or (sg = -1 and b.h >= v_stop) then
        v_out := case when v_stop = lr.stop then 'stop' else 'be' end; v_exit := v_stop; v_fee := 0.0008; exit;
      end if;
      if v_prev_h is not null and ((sg = 1 and b.h >= v_tgt) or (sg = -1 and b.l <= v_tgt)) then
        v_out := 'target'; v_exit := v_tgt; v_fee := 0.0002; exit;
      end if;
      v_prev_h := b.h; v_prev_l := b.l;
    end loop;
    if v_out is not null then
      update public.limit_orders set quick_outcome = v_out,
             quick_r = round((sg * (v_exit - lr.limit_price) - lr.limit_price * 0.0002 - v_exit * v_fee) / v_risk, 3)
       where limit_id = lr.limit_id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace view public.v_strategy_league as
with lim as (
  select date_trunc('week', coalesce(resolved_at, filled_at)) wk, 'limit_full (paper)' strategy, outcome_r r from public.limit_orders where origin = 'paper' and status = 'closed'
  union all
  select date_trunc('week', filled_at), 'limit_quick (paper)', quick_r from public.limit_orders where origin = 'paper' and quick_r is not null
  union all
  select date_trunc('week', closed_at), case when origin = 'moonbag' then 'moonbag signals taken' else 'your own calls' end, r_multiple
    from public.trades where venue = 'blofin' and status = 'closed' and r_multiple is not null
  union all
  select date_trunc('week', resolved_at), 'desk signals (paper)', outcome_r from public.lev_signals where outcome_r is not null and trade_id is null)
select wk::date week, strategy, count(*) n, round(avg(r), 3) avg_r, round(sum(r), 2) total_r,
       round(100.0 * count(*) filter (where r > 0.05) / count(*), 0) win_pct
  from lim where r is not null group by 1, 2 order by 1 desc, total_r desc;
