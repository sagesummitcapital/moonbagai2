-- Coinbase book backtest engine (same rules as docs/strategy/COINBASE_STRATEGY.md and the Python research in
-- docs/strategy/backtests/coinbase_2026-10-10.md). Reads candles (tf '1d', assets BTC/ETH/SOL from COINBASE:*USD).
-- Portfolio: regime-gated (200D hysteresis +2%/-3%) N-day close breakout, stop = k x ATR14, half off at TP1 (R multiple,
-- maker fee), then stop to entry +1.2% and trail the prior 20-day low; exit on regime flip; risk p_risk of equity per
-- trade, max p_max_open_risk combined, no leverage. Taker fee both sides on entries/stops, slippage 0.05%.
-- Usage: select public.cb_backtest();  select public.cb_backtest(array['BTC','ETH'], 0.05, 0.15, 55, 3, 3, 0.5, '2021-01-01', null, true, 'why');
create or replace function public.cb_backtest(
  p_assets text[] default array['BTC','ETH','SOL'],
  p_risk numeric default 0.05, p_max_open_risk numeric default 0.15,
  p_lb integer default 55, p_stop_atr numeric default 3, p_tp1r numeric default 3, p_tp1_frac numeric default 0.5,
  p_from date default null, p_to date default null, p_save boolean default false, p_notes text default null,
  p_fee numeric default 0.006, p_fee_maker numeric default 0.004, p_slip numeric default 0.0005)
returns jsonb language plpgsql as $$
declare
  r record; p record; a text; t timestamptz; st boolean; cur_asset text;
  cash numeric := 1; eqv numeric; peak numeric := 1; maxdd numeric := 0; open_risk numeric; held numeric;
  px numeric; stp numeric; dist numeric; rk numeric; notional numeric; uu numeric; q numeric; exitpx numeric; v_why text;
  ntr integer := 0; nwin integer := 0; sum_r numeric := 0; gwin numeric := 0; gloss numeric := 0;
  first_ts timestamptz; last_ts timestamptz; final_eq numeric := 1; yrs numeric; cagr numeric; res jsonb; trades jsonb;
  v_run bigint := (extract(epoch from clock_timestamp()) * 1000000)::bigint;
begin
  create temp table if not exists _cb_bars (run bigint, asset text, ts timestamptz, o numeric, h numeric, l numeric, c numeric,
    atr numeric, sma200 numeric, hh numeric, ll20 numeric, reg boolean);
  create temp table if not exists _cb_pos (run bigint, asset text, open boolean, e numeric, stop numeric, u numeric, cost numeric, outv numeric,
    tp1 boolean, tp1px numeric, riskamt numeric, d0 timestamptz, last_c numeric);
  create temp table if not exists _cb_tr (run bigint, asset text, d0 timestamptz, d1 timestamptz, rr numeric, ret numeric, why text);
  create index if not exists _cb_bars_ix on _cb_bars (run, asset, ts);
  execute format($f$
    insert into _cb_bars
    select %3$s, asset, ts, o, h, l, c,
      case when count(*) over w14 = 14 then avg(tr) over w14 end,
      case when count(*) over w200 = 200 then avg(c) over w200 end,
      case when count(*) over wlb = %1$s then max(h) over wlb end,
      case when count(*) over w20 = 20 then min(l) over w20 end,
      false
    from (select asset, ts, o, h, l, c,
                 greatest(h - l, coalesce(abs(h - lag(c) over (partition by asset order by ts)), 0),
                          coalesce(abs(l - lag(c) over (partition by asset order by ts)), 0)) as tr
            from public.candles where tf = '1d' and asset = any(%2$L::text[])) x
    window w14 as (partition by asset order by ts rows between 13 preceding and current row),
           w200 as (partition by asset order by ts rows between 199 preceding and current row),
           wlb as (partition by asset order by ts rows between %1$s preceding and 1 preceding),
           w20 as (partition by asset order by ts rows between 20 preceding and 1 preceding)$f$, p_lb, p_assets, v_run);
  cur_asset := null; st := false;
  for r in select asset, ts, c, sma200 from _cb_bars where run = v_run order by asset, ts loop
    if cur_asset is distinct from r.asset then cur_asset := r.asset; st := false; end if;
    if r.sma200 is null then st := false;
    elsif not st and r.c > r.sma200 * 1.02 then st := true;
    elsif st and r.c < r.sma200 * 0.97 then st := false; end if;
    if st then update _cb_bars set reg = true where run = v_run and asset = r.asset and ts = r.ts; end if;
  end loop;
  for t in select distinct ts from _cb_bars
            where run = v_run and (p_from is null or ts >= p_from) and (p_to is null or ts < p_to + 1) order by ts loop
    if first_ts is null then first_ts := t; end if;
    last_ts := t;
    for p in select * from _cb_pos where run = v_run and open loop
      select * into r from _cb_bars where run = v_run and asset = p.asset and ts = t;
      if not found then continue; end if;
      exitpx := null;
      if r.l <= p.stop then
        exitpx := least(r.o, p.stop) * (1 - p_slip); v_why := 'stop';
      else
        if not p.tp1 and r.h >= p.tp1px then
          q := p.u * p_tp1_frac;
          cash := cash + q * p.tp1px * (1 - p_fee_maker); p.outv := p.outv + q * p.tp1px * (1 - p_fee_maker);
          p.u := p.u - q; p.tp1 := true; p.stop := greatest(p.stop, p.e * 1.012);
        end if;
        if p.tp1 and r.ll20 is not null then p.stop := greatest(p.stop, r.ll20); end if;
        if not r.reg then exitpx := r.c * (1 - p_slip); v_why := 'regime'; end if;
      end if;
      if exitpx is not null then
        cash := cash + p.u * exitpx * (1 - p_fee); p.outv := p.outv + p.u * exitpx * (1 - p_fee);
        insert into _cb_tr values (v_run, p.asset, p.d0, t, (p.outv - p.cost) / p.riskamt, p.outv / p.cost - 1, v_why);
        update _cb_pos set open = false where run = v_run and asset = p.asset;
      else
        update _cb_pos set stop = p.stop, u = p.u, tp1 = p.tp1, outv = p.outv, last_c = r.c where run = v_run and asset = p.asset;
      end if;
    end loop;
    select cash + coalesce(sum(u * last_c), 0) into eqv from _cb_pos where run = v_run and open;
    select coalesce(sum(greatest(0, u * (e - stop))), 0) / eqv into open_risk from _cb_pos where run = v_run and open;
    foreach a in array p_assets loop
      if exists (select 1 from _cb_pos where run = v_run and open and asset = a) then continue; end if;
      select * into r from _cb_bars where run = v_run and asset = a and ts = t;
      if not found or not r.reg or r.hh is null or r.atr is null or not (r.c > r.hh) then continue; end if;
      px := r.c * (1 + p_slip); stp := px - p_stop_atr * r.atr; dist := (px - stp) / px + 2 * p_fee;
      rk := least(p_risk, p_max_open_risk - open_risk);
      if rk < 0.01 then continue; end if;
      select coalesce(sum(u * last_c), 0) into held from _cb_pos where run = v_run and open;
      notional := least(eqv * rk / dist, cash * 0.999, eqv - held);
      if notional < eqv * 0.05 then continue; end if;
      uu := notional * (1 - p_fee) / px; cash := cash - notional;
      insert into _cb_pos values (v_run, a, true, px, stp, uu, notional, 0, false, px + p_tp1r * (px - stp), notional * dist, t, r.c);
      open_risk := open_risk + notional * dist / eqv;
    end loop;
    select cash + coalesce(sum(u * last_c), 0) into eqv from _cb_pos where run = v_run and open;
    final_eq := eqv; peak := greatest(peak, eqv); maxdd := least(maxdd, eqv / peak - 1);
  end loop;
  select count(*), count(*) filter (where rr > 0), coalesce(sum(rr), 0),
         coalesce(sum(ret) filter (where ret > 0), 0), coalesce(-sum(ret) filter (where ret <= 0), 0),
         coalesce(jsonb_agg(jsonb_build_object('asset', asset, 'd0', d0::date, 'd1', d1::date, 'r', round(rr, 2), 'why', why) order by d0), '[]'::jsonb)
    into ntr, nwin, sum_r, gwin, gloss, trades from _cb_tr where run = v_run;
  yrs := greatest(extract(epoch from (last_ts - first_ts)) / 86400 / 365.25, 0.01);
  cagr := power(final_eq, 1 / yrs) - 1;
  res := jsonb_build_object('assets', p_assets, 'from', first_ts::date, 'to', last_ts::date,
    'params', jsonb_build_object('risk', p_risk, 'max_open_risk', p_max_open_risk, 'lookback', p_lb, 'stop_atr', p_stop_atr,
       'tp1_r', p_tp1r, 'tp1_frac', p_tp1_frac, 'fee', p_fee, 'fee_maker', p_fee_maker, 'slip', p_slip),
    'multiple', round(final_eq, 3), 'cagr_pct', round(100 * cagr, 1), 'max_dd_pct', round(100 * maxdd, 1),
    'trades', ntr, 'win_rate', case when ntr > 0 then round(100.0 * nwin / ntr) end,
    'avg_r', case when ntr > 0 then round(sum_r / ntr, 2) end, 'total_r', round(sum_r, 1),
    'profit_factor', case when gloss > 0 then round(gwin / gloss, 2) end,
    'still_open', (select count(*) from _cb_pos where run = v_run and open), 'trade_list', trades);
  if p_save then
    insert into public.backtests (book, setup_id, engine_code, asset, timeframe, period_start, period_end, params, n_trades, wins,
      win_rate, avg_r, total_r, profit_factor, notes, run_by)
    values ('coinbase', null, 'cb_breakout', array_to_string(p_assets, '+'), '1d', first_ts::date, last_ts::date,
      (res -> 'params') || jsonb_build_object('cagr_pct', res -> 'cagr_pct', 'max_dd_pct', res -> 'max_dd_pct', 'multiple', res -> 'multiple'),
      ntr, nwin, case when ntr > 0 then round(1.0 * nwin / ntr, 3) end, case when ntr > 0 then round(sum_r / ntr, 3) end,
      round(sum_r, 2), case when gloss > 0 then round(gwin / gloss, 2) end, p_notes, 'cb_backtest');
  end if;
  return res;
end $$;
