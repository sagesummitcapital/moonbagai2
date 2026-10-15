-- Fib 0.75 of a big impulse leg (Stavros, 2026-10-15: "i think .75 fib levels are great plays"; research/fib, playbook fib_75).
-- Paper limits: on the 1h candles, the latest confirmed swing leg (pivots 5/5) of at least 7 x ATR14(1h), running with the
-- 1h EMA200, gets a resting limit at its 0.75 retracement; stop beyond the leg origin + 0.25 ATR; TP1 the leg extreme (0.0),
-- TP2 the -0.272 extension. Cancelled if price makes a new extreme first; 48h expiry. Resolved by lev_limit_resolve().
create or replace function public.lev_fib_plan(p_assets text[] default null, p_save boolean default true)
returns jsonb language plpgsql as $f$
declare
  a text; out jsonb := '[]'::jsonb;
  hs numeric[]; ls numeric[]; cs numeric[]; ts_ timestamptz[]; n integer; i integer; j integer;
  ema numeric; atr numeric; k numeric; v_last timestamptz;
  pi integer; pk text; qi integer; qk text;
  v_side text; v_org numeric; v_ext numeric; leg numeric; v_entry numeric; v_stop numeric; v_tp1 numeric; v_tp2 numeric; sg integer;
  conf_i integer; broken boolean; v_id text; v_plan numeric;
begin
  for a in
    select x from unnest(coalesce(p_assets,
      (select array_agg(asset order by asset) from public.lev_universe
        where tier = 'core' or asset = 'SOL' or (tier = 'rotation' and rank <= 5)))) x
  loop
    select array_agg(h order by ts), array_agg(l order by ts), array_agg(c order by ts), array_agg(ts order by ts)
      into hs, ls, cs, ts_
      from (select ts, h, l, c from public.candles where asset = a and tf = '1h' order by ts desc limit 400) z;
    n := coalesce(array_length(cs, 1), 0);
    v_last := ts_[n];
    if n < 220 or v_last < now() - interval '3 hours' then
      out := out || jsonb_build_object('asset', a, 'skip', 'data', 'bars', n); continue;
    end if;
    -- EMA200 and ATR14 at the last bar
    ema := cs[1]; k := 2.0 / 201;
    for i in 2..n loop ema := ema + k * (cs[i] - ema); end loop;
    atr := 0;
    for i in n - 13..n loop atr := atr + greatest(hs[i] - ls[i], abs(hs[i] - cs[i - 1]), abs(ls[i] - cs[i - 1])); end loop;
    atr := atr / 14;
    -- the two most recent confirmed pivots (5 bars each side)
    pi := null; qi := null;
    i := n - 5;
    while i >= 6 and qi is null loop
      if hs[i] = (select max(x) from unnest(hs[i - 5:i + 5]) x) then
        if pi is null then pi := i; pk := 'H'; elsif pk = 'L' then qi := i; qk := 'H'; end if;
      end if;
      if qi is null and ls[i] = (select min(x) from unnest(ls[i - 5:i + 5]) x) then
        if pi is null then pi := i; pk := 'L'; elsif pk = 'H' and i <> pi then qi := i; qk := 'L'; end if;
      end if;
      i := i - 1;
    end loop;
    if pi is null or qi is null then out := out || jsonb_build_object('asset', a, 'skip', 'no leg'); continue; end if;
    -- leg: origin q -> extreme p
    if pk = 'H' then v_side := 'long'; v_org := ls[qi]; v_ext := hs[pi]; sg := 1; else v_side := 'short'; v_org := hs[qi]; v_ext := ls[pi]; sg := -1; end if;
    leg := abs(v_ext - v_org);
    conf_i := pi + 5;
    if leg < 7 * atr then out := out || jsonb_build_object('asset', a, 'skip', 'leg too small', 'leg_atr', round(leg / atr, 1)); continue; end if;
    if (sg = 1 and cs[n] < ema) or (sg = -1 and cs[n] > ema) then out := out || jsonb_build_object('asset', a, 'skip', 'against EMA200'); continue; end if;
    if n - conf_i > 48 then out := out || jsonb_build_object('asset', a, 'skip', 'leg older than 48h'); continue; end if;
    v_entry := v_ext - sg * 0.75 * leg;
    v_stop := v_org - sg * 0.25 * atr;
    v_tp1 := v_ext; v_tp2 := v_ext + sg * 0.272 * leg;
    -- broken: a new extreme beyond v_ext, or the entry already traded since confirmation
    broken := false;
    for j in conf_i..n loop
      if (sg = 1 and hs[j] > v_ext) or (sg = -1 and ls[j] < v_ext) then broken := true; end if;
      if (sg = 1 and ls[j] <= v_entry) or (sg = -1 and hs[j] >= v_entry) then broken := true; end if;
    end loop;
    if broken then out := out || jsonb_build_object('asset', a, 'skip', 'leg broken or already filled'); continue; end if;
    if exists (select 1 from public.limit_orders where symbol = a and setup_id = 'fib_75' and status in ('working','touched','filled')
               and abs(limit_price - v_entry) <= 0.002 * v_entry) then
      out := out || jsonb_build_object('asset', a, 'skip', 'already placed'); continue;
    end if;
    v_plan := round(abs(v_tp1 - v_entry) / abs(v_entry - v_stop), 2);
    if p_save then
      insert into public.limit_orders (venue, symbol, direction, origin, limit_price, stop, current_stop, tp1, tp2, plan_r, level, level_kind, grade, setup_id, status, expires_at, reasoning, source)
      values ('blofin', a, v_side, 'paper', public.mb_px(v_entry), public.mb_px(v_stop), public.mb_px(v_stop), public.mb_px(v_tp1), public.mb_px(v_tp2), v_plan, public.mb_px(v_ext), 'fib_0.75',
              'A', 'fib_75', 'working', ts_[conf_i] + interval '48 hours',
              format('%s %s limit %s = 0.75 of the 1h leg %s -> %s (%s x ATR1h, with the EMA200); stop %s beyond the 1.0; TP1 %s (0.0, %sR), TP2 %s (-0.272)',
                     a, v_side, public.mb_px(v_entry), public.mb_px(v_org), public.mb_px(v_ext), round(leg / atr, 1), public.mb_px(v_stop), public.mb_px(v_tp1), v_plan, public.mb_px(v_tp2)),
              'claude')
      returning limit_id into v_id;
    end if;
    out := out || jsonb_build_object('asset', a, 'placed', v_id, 'side', v_side, 'limit', public.mb_px(v_entry), 'stop', public.mb_px(v_stop), 'tp1', public.mb_px(v_tp1), 'plan_r', v_plan, 'leg_atr', round(leg / atr, 1));
  end loop;
  return out;
end $f$;
