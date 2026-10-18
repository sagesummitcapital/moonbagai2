-- 2026-10-18 · Divergence combo calibrated on WoodsBot's October alerts (already live). Apply after 20261018120000.

-- REGULAR bull: p2 low <= an earlier pivot low
create or replace function public.rsi_div(lo numeric[], hi numeric[], cl numeric[], os numeric default 45) returns jsonb language plpgsql immutable as $fn$
-- 4H RSI divergence on the latest swing, fired at the bar close like WoodsBot.
--   p2 = the last closed bar if it is the lowest low (highest high) of the last 4 bars, else the latest confirmed pivot (3 left / 2 right) within 10 bars.
--   REGULAR bull: p2 low <= an earlier pivot low x 1.003 (3-40 bars back) and RSI(p2) > RSI(that pivot), lower RSI < os.
--   HIDDEN bull (trend continuation): p2 low > the previous pivot low and RSI(p2) < RSI(that pivot) — price higher low, RSI lower low.
--   Bear = mirror on highs. 'bull'/'bear' = regular OR hidden; the type is reported.
declare n int := coalesce(array_length(cl,1),0); r numeric[]; up numeric := 0; dn numeric := 0; d numeric; i int; j int;
  b2 int; b1 int; bh int; s2 int; s1 int; sh int; rbull boolean := false; hbull boolean := false; rbear boolean := false; hbear boolean := false;
begin
  if n < 45 then return jsonb_build_object('error','not enough bars'); end if;
  r := array_fill(null::numeric, array[n]);
  for i in 2..15 loop d := cl[i]-cl[i-1]; up := up + greatest(d,0); dn := dn + greatest(-d,0); end loop;
  up := up/14; dn := dn/14; r[15] := case when dn = 0 then 100 else 100 - 100/(1+up/dn) end;
  for i in 16..n loop d := cl[i]-cl[i-1]; up := (up*13+greatest(d,0))/14; dn := (dn*13+greatest(-d,0))/14; r[i] := case when dn = 0 then 100 else 100 - 100/(1+up/dn) end; end loop;
  if lo[n] = (select min(x) from unnest(lo[n-3:n]) x) then b2 := n; else
    for i in reverse (n-2)..(n-10) loop if lo[i] = (select min(x) from unnest(lo[i-3:i+2]) x) then b2 := i; exit; end if; end loop;
  end if;
  if b2 is not null then
    for j in reverse (b2-3)..greatest(b2-40, 20) loop
      if lo[j] = (select min(x) from unnest(lo[j-3:j+2]) x) then
        if bh is null then bh := j; end if;
        if b1 is null and lo[b2] <= lo[j] * 1.003 then b1 := j; end if;
      end if;
      exit when b1 is not null and bh is not null;
    end loop;
    if b1 is not null then rbull := r[b2] > r[b1] and least(r[b1], r[b2]) < os; end if;
    if bh is not null then hbull := lo[b2] > lo[bh] and r[b2] < r[bh] and r[b2] < 50; end if;
  end if;
  if hi[n] = (select max(x) from unnest(hi[n-3:n]) x) then s2 := n; else
    for i in reverse (n-2)..(n-10) loop if hi[i] = (select max(x) from unnest(hi[i-3:i+2]) x) then s2 := i; exit; end if; end loop;
  end if;
  if s2 is not null then
    for j in reverse (s2-3)..greatest(s2-40, 20) loop
      if hi[j] = (select max(x) from unnest(hi[j-3:j+2]) x) then
        if sh is null then sh := j; end if;
        if s1 is null and hi[s2] >= hi[j] * 0.997 then s1 := j; end if;
      end if;
      exit when s1 is not null and sh is not null;
    end loop;
    if s1 is not null then rbear := r[s2] < r[s1] and greatest(r[s1], r[s2]) > 100 - os; end if;
    if sh is not null then hbear := hi[s2] < hi[sh] and r[s2] > r[sh] and r[s2] > 50; end if;
  end if;
  return jsonb_build_object('bull', rbull or hbull, 'bear', rbear or hbear,
    'bull_type', case when rbull then 'regular' when hbull then 'hidden' end, 'bear_type', case when rbear then 'regular' when hbear then 'hidden' end,
    'rsi_now', round(r[n],1),
    'bull_rsi', case when coalesce(b1,bh) is null then null else jsonb_build_array(round(r[coalesce(case when rbull then b1 end, bh, b1)],1), round(r[b2],1)) end,
    'bull_lows', case when coalesce(b1,bh) is null then null else jsonb_build_array(lo[coalesce(case when rbull then b1 end, bh, b1)], lo[b2]) end,
    'bear_rsi', case when coalesce(s1,sh) is null then null else jsonb_build_array(round(r[coalesce(case when rbear then s1 end, sh, s1)],1), round(r[s2],1)) end,
    'bear_highs', case when coalesce(s1,sh) is null then null else jsonb_build_array(hi[coalesce(case when rbear then s1 end, sh, s1)], hi[s2]) end,
    'low', case when b2 is null then null else lo[b2] end, 'high', case when s2 is null then null else hi[s2] end);
end $fn$;

-- hbull := lo[b2] > lo[bh] * 0.997
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.rsi_div(numeric[], numeric[], numeric[], numeric)'::regprocedure);
  if position($a$hbull := lo[b2] > lo[bh] and$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$hbull := lo[b2] > lo[bh] and$a$, $b$hbull := lo[b2] > lo[bh] * 0.997 and$b$);
  if position($a$hbear := hi[s2] < hi[sh] and$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$hbear := hi[s2] < hi[sh] and$a$, $b$hbear := hi[s2] < hi[sh] * 1.003 and$b$);
  if n <> 2 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- calibrated on WoodsBot's 10/4, 10/14 and 10/18 alerts
create or replace function public.woods_market_divergence(p_save boolean default true, p_at timestamptz default null) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
-- WoodsBot-style "Divergence Combo" (Stavros 2026-10-18; calibrated on WoodsBot's 10/4, 10/14 and 10/18 alerts):
-- 4H RSI divergence (regular or hidden) on BTC, ETH, TOTAL, TOTAL2, TOTAL3 and USDT.D (inverted: a bearish divergence on stablecoin dominance is bullish for crypto).
-- COMBO = at least 3 series agree on one direction and none points the other way. Fires at the 4H bar close.
declare
  ser text[] := array['BTC','ETH','TOTAL','TOTAL2','TOTAL3','USDT.D']; s text; d jsonb; res jsonb := '{}'::jsonb;
  lo numeric[]; hi numeric[]; cl numeric[]; last_ts timestamptz; bar_ts timestamptz;
  nb int := 0; nr int := 0; bulls text[] := '{}'; bears text[] := '{}'; combo text; out jsonb; lbl text;
begin
  select max(ts) into bar_ts from candles where asset = 'BTC' and tf = '4h' and (p_at is null or ts <= p_at);
  foreach s in array ser loop
    select array_agg(l order by ts), array_agg(h order by ts), array_agg(c order by ts), max(ts) into lo, hi, cl, last_ts
      from (select ts, l, h, c from candles where asset = s and tf = '4h' and ts <= bar_ts order by ts desc limit 150) z;
    if last_ts is distinct from bar_ts then res := res || jsonb_build_object(s, jsonb_build_object('error', 'no bar at ' || bar_ts)); continue; end if;
    d := rsi_div(lo, hi, cl, 45::numeric);
    res := res || jsonb_build_object(s, d);
    lbl := case s when 'USDT.D' then 'USDT.D (inverted)' else s end;
    if s = 'USDT.D' then
      if (d->>'bear')::boolean then nb := nb + 1; bulls := bulls || lbl; end if;
      if (d->>'bull')::boolean then nr := nr + 1; bears := bears || lbl; end if;
    else
      if (d->>'bull')::boolean then nb := nb + 1; bulls := bulls || lbl; end if;
      if (d->>'bear')::boolean then nr := nr + 1; bears := bears || lbl; end if;
    end if;
  end loop;
  combo := case when nb >= 3 and nr = 0 then 'bull' when nr >= 3 and nb = 0 then 'bear' end;
  out := jsonb_build_object('as_of', now(), 'bar', bar_ts, 'combo', combo, 'bull_count', nb, 'bear_count', nr, 'bulls', to_jsonb(bulls), 'bears', to_jsonb(bears), 'series', res,
    'btc', res->'BTC', 'total2', res->'TOTAL2', 'total3', res->'TOTAL3',
    'text', case combo
      when 'bull' then format('DIVERGENCE COMBO ▲ — 4H RSI bullish divergence on %s: selling momentum is fading across the market. Look for longs at swept lows once the 1H trigger prints; no shorts into it.', array_to_string(bulls, ', '))
      when 'bear' then format('DIVERGENCE COMBO ▼ — 4H RSI bearish divergence on %s: buying momentum is fading across the market. Look for shorts at swept highs once the 1H trigger prints; no new longs at highs.', array_to_string(bears, ', '))
      else format('No combo — bullish %s/6%s · bearish %s/6%s.', nb, case when nb > 0 then ' (' || array_to_string(bulls, ', ') || ')' else '' end, nr, case when nr > 0 then ' (' || array_to_string(bears, ', ') || ')' else '' end) end);
  if p_save then
    insert into market_divergence (as_of, bar_ts, combo, detail) values (now(), bar_ts, combo, out) on conflict (as_of) do nothing;
    if combo is not null then
      insert into woods_events (coin, side, kind, bar_ts, detail) values ('MARKET', case when combo = 'bull' then 'long' else 'short' end, 'divergence_combo', bar_ts, out) on conflict do nothing;
    end if;
  end if;
  return out;
end $fn$;

-- combo := case when nb >= 3 and nb >= nr + 2
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.woods_market_divergence(boolean, timestamp with time zone)'::regprocedure);
  if position($a$combo := case when nb >= 3 and nr = 0 then 'bull' when nr >= 3 and nb = 0 then 'bear' end;$a$ in d) = 0 then raise exception 'anchor'; end if;
  d := replace(d, $a$combo := case when nb >= 3 and nr = 0 then 'bull' when nr >= 3 and nb = 0 then 'bear' end;$a$, $b$combo := case when nb >= 3 and nb >= nr + 2 then 'bull' when nr >= 3 and nr >= nb + 2 then 'bear' end;$b$);
  d := replace(d, $a$COMBO = at least 3 series agree on one direction and none points the other way.$a$, $b$COMBO = at least 3 series agree on one direction and they outnumber the other side by 2+.$b$);
  execute d;
end $do$;

-- fresh only: the swing point must be the bar that just closed
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.rsi_div(numeric[], numeric[], numeric[], numeric)'::regprocedure);
  -- fresh only: the swing point must be the bar that just closed
  if position($a$  if lo[n] = (select min(x) from unnest(lo[n-3:n]) x) then b2 := n; else
    for i in reverse (n-2)..(n-10) loop if lo[i] = (select min(x) from unnest(lo[i-3:i+2]) x) then b2 := i; exit; end if; end loop;
  end if;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$  if lo[n] = (select min(x) from unnest(lo[n-3:n]) x) then b2 := n; else
    for i in reverse (n-2)..(n-10) loop if lo[i] = (select min(x) from unnest(lo[i-3:i+2]) x) then b2 := i; exit; end if; end loop;
  end if;$a$, $b$  if lo[n] = (select min(x) from unnest(lo[n-3:n]) x) then b2 := n; end if;$b$);
  if position($a$  if hi[n] = (select max(x) from unnest(hi[n-3:n]) x) then s2 := n; else
    for i in reverse (n-2)..(n-10) loop if hi[i] = (select max(x) from unnest(hi[i-3:i+2]) x) then s2 := i; exit; end if; end loop;
  end if;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$  if hi[n] = (select max(x) from unnest(hi[n-3:n]) x) then s2 := n; else
    for i in reverse (n-2)..(n-10) loop if hi[i] = (select max(x) from unnest(hi[i-3:i+2]) x) then s2 := i; exit; end if; end loop;
  end if;$a$, $b$  if hi[n] = (select max(x) from unnest(hi[n-3:n]) x) then s2 := n; end if;$b$);
  -- minimum RSI gap of 3 points
  d := replace(d, $a$rbull := r[b2] > r[b1] and$a$, $b$rbull := r[b2] > r[b1] + 3 and$b$);
  d := replace(d, $a$and r[b2] < r[bh] and r[b2] < 50;$a$, $b$and r[b2] < r[bh] - 3 and r[b2] < 50;$b$);
  d := replace(d, $a$rbear := r[s2] < r[s1] and$a$, $b$rbear := r[s2] < r[s1] - 3 and$b$);
  d := replace(d, $a$and r[s2] > r[sh] and r[s2] > 50;$a$, $b$and r[s2] > r[sh] + 3 and r[s2] > 50;$b$);
  if n <> 2 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- 'woodsbot_combo','2026-10-04 20:00+00'
insert into woods_events (coin, side, kind, bar_ts, detail) values
('MARKET','short','woodsbot_combo','2026-10-04 20:00+00','{"source":"WoodsBot Discord (@Combo Div Alerts) 10/4/2026 5:02 PM Phoenix, forwarded by Stavros","series":{"TOTAL Daily RSI":"bear","USDC.D 4H RSI":"bull","USDC.D Daily RSI":"bull","BTC 4H RSI":"bear"},"direction":"bearish (stablecoin dominance up = risk-off)"}'::jsonb),
('MARKET','long','woodsbot_combo','2026-10-14 12:00+00','{"source":"WoodsBot Discord (@Combo Div Alerts) 10/14/2026 9:02 AM Phoenix, forwarded by Stavros","series":{"TOTAL 4H RSI":"bull","TOTAL2 4H RSI+OBV":"bull","TOTAL3 4H RSI+OBV":"bull","USDT.D 4H RSI":"bear","BTC 4H RSI":"bull","ETH 4H RSI":"bull"},"direction":"bullish (stablecoin dominance down = risk-on)"}'::jsonb)
on conflict do nothing returning id;

-- kind = 'woodsbot_combo' and bar_ts > now() - interval '40 ho
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.woods_scan(boolean)'::regprocedure);
  if position($a$kind = 'woodsbot_combo' and created_at > now() - interval '24 hours' order by created_at desc limit 1;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$kind = 'woodsbot_combo' and created_at > now() - interval '24 hours' order by created_at desc limit 1;$a$, $b$kind = 'woodsbot_combo' and bar_ts > now() - interval '40 hours' order by bar_ts desc limit 1;$b$);
  if position($a$near_cb := v_entry is not null and ((sg = 1 and (cb_dir = 'bull' or wb_alert->>'side' = 'long')) or (sg = -1 and (cb_dir = 'bear' or wb_alert->>'side' = 'short')));$a$ in d) > 0 then n := n + 1; end if;
  -- 2026-10-18 calibration: Moonbag's own combo scan was right 4/10 on BTC 72h direction (coin flip) vs WoodsBot 1 clear win + 1 mixed — the flag follows WoodsBot's alerts only; our scan stays display-only
  d := replace(d, $a$near_cb := v_entry is not null and ((sg = 1 and (cb_dir = 'bull' or wb_alert->>'side' = 'long')) or (sg = -1 and (cb_dir = 'bear' or wb_alert->>'side' = 'short')));$a$, $b$near_cb := v_entry is not null and ((sg = 1 and wb_alert->>'side' = 'long') or (sg = -1 and wb_alert->>'side' = 'short'));$b$);
  if n <> 2 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- 'woodsbot_combo', '2026-10-18 12:00:00+00'
insert into woods_events (coin, side, kind, bar_ts, detail) values ('MARKET', 'long', 'woodsbot_combo', '2026-10-18 12:00:00+00', '{"source":"WoodsBot Discord (@WB - Combo Alerts), 9:02 AM Phoenix 2026-10-18, forwarded by Stavros","alert":"Divergence Combo Alert","series":["TOTAL2 4H RSI","TOTAL3 4H RSI","BTC 4H RSI"],"direction":"bullish","ours_same_bar":{"combo":null,"btc_rsi":[43.6,42.2],"total2_rsi":[39.1,36.7],"total3_rsi":[38.3,35.7],"note":"Moonbag regular-divergence detector did not confirm on the 12:00Z bar (RSI made a lower low vs the 10-17 20:00Z swing). Logged to calibrate against WoodsBot."}}'::jsonb) on conflict do nothing returning id;
