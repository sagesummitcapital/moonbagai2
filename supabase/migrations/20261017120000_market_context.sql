-- 2026-10-17 · Market context (Stavros: "i do think we want to be tracking the TOTAL and ETH/BTC market context in some form -
-- it can be used to judge market - same with usdt - if usdt is down market is up and vice versa"). Already live; this file records it.
-- History: candles asset 'TOTAL' ($bn) and 'USDT.D' (%) 4h were backfilled once from TradingView CRYPTOCAP (200 bars, data not in this file).
-- Live: market_context_sync() splices CoinGecko /global onto that history (scale fixed at the first sync, market_context_cfg).
-- Scheduling: approved by Stavros 2026-10-17; the job is altered at the bottom of this file.

create table if not exists public.market_context_cfg (asset text primary key, scale numeric not null, set_at timestamptz not null default now(), note text);
alter table public.market_context_cfg enable row level security;

create or replace function public.market_context_sync() returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $fn$
declare resp record; body jsonb; v_total numeric; v_usdt numeric; v_bucket timestamptz; v_a text; v_raw numeric; v_scale numeric; v_val numeric; out jsonb := '{}'::jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  select * into resp from extensions.http_get('https://api.coingecko.com/api/v3/global');
  if resp.status <> 200 then
    insert into data_feed (feed, asset, tf, fetched_at, ok, error) values ('coingecko','TOTAL','4h',now(),false,'http '||resp.status)
    on conflict (feed, asset, tf) do update set fetched_at = excluded.fetched_at, ok = false, error = excluded.error;
    return jsonb_build_object('ok', false, 'status', resp.status);
  end if;
  body := resp.content::jsonb -> 'data';
  v_total := (body->'total_market_cap'->>'usd')::numeric / 1e9;
  v_usdt := (body->'market_cap_percentage'->>'usdt')::numeric;
  v_bucket := to_timestamp(floor(extract(epoch from now()) / 14400) * 14400);
  foreach v_a in array array['TOTAL','USDT.D'] loop
    v_raw := case v_a when 'TOTAL' then v_total else v_usdt end;
    continue when v_raw is null;
    select scale into v_scale from market_context_cfg where asset = v_a;
    if v_scale is null then
      -- splice CoinGecko onto the TradingView CRYPTOCAP history: scale = last TV close / first CoinGecko reading
      select c / v_raw into v_scale from candles where asset = v_a and tf = '4h' and ts < v_bucket order by ts desc limit 1;
      v_scale := coalesce(v_scale, 1);
      insert into market_context_cfg (asset, scale, note) values (v_a, v_scale, 'TradingView CRYPTOCAP close / CoinGecko at first sync');
    end if;
    v_val := round(v_raw * v_scale, case when v_a = 'TOTAL' then 1 else 3 end);
    insert into candles as cd (asset, tf, ts, o, h, l, c) values (v_a, '4h', v_bucket, v_val, v_val, v_val, v_val)
    on conflict (asset, tf, ts) do update set h = greatest(cd.h, excluded.c), l = least(cd.l, excluded.c), c = excluded.c;
    insert into data_feed (feed, asset, tf, last_bar, fetched_at, ok, error) values ('coingecko', v_a, '4h', v_bucket, now(), true, null)
    on conflict (feed, asset, tf) do update set last_bar = excluded.last_bar, fetched_at = excluded.fetched_at, ok = true, error = null;
    out := out || jsonb_build_object(v_a, v_val);
  end loop;
  return out || jsonb_build_object('ok', true, 'at', now());
end $fn$;

-- woods_scan: market context read + CTX✓ paper flag (patch on top of 20261017090000)
do $do$
declare d text; n int;
begin
  select pg_get_functiondef('public.woods_scan(boolean)'::regprocedure) into d;
  n := 0;
  if position($a$pos numeric;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$pos numeric;$a$, $b$pos numeric;
  cx_state text; cx_text text; cx_ts timestamptz; eb_ts timestamptz; near_ctx boolean;
  tot_now numeric; tot_24 numeric; tot_7d numeric; us_now numeric; us_24 numeric; us_7d numeric; eb_now numeric; eb_24 numeric; eb_7d numeric;$b$);
  if position($a$  foreach v_coin in array array['BTC','ETH','SOL'] loop$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$  foreach v_coin in array array['BTC','ETH','SOL'] loop$a$, $b$  -- MARKET CONTEXT (Stavros 2026-10-17: "tracking the TOTAL and ETH/BTC market context ... same with usdt - if usdt is down market is up and vice versa"). Paper flag only until the weekly review proves it adds R.
  select c, ts into tot_now, cx_ts from candles where asset = 'TOTAL' and tf = '4h' order by ts desc limit 1;
  select c into tot_24 from candles where asset = 'TOTAL' and tf = '4h' and ts <= cx_ts - interval '24 hours' order by ts desc limit 1;
  select c into tot_7d from candles where asset = 'TOTAL' and tf = '4h' and ts <= cx_ts - interval '7 days' order by ts desc limit 1;
  select c into us_now from candles where asset = 'USDT.D' and tf = '4h' order by ts desc limit 1;
  select c into us_24 from candles where asset = 'USDT.D' and tf = '4h' and ts <= cx_ts - interval '24 hours' order by ts desc limit 1;
  select c into us_7d from candles where asset = 'USDT.D' and tf = '4h' and ts <= cx_ts - interval '7 days' order by ts desc limit 1;
  select e.c / b.c, e.ts into eb_now, eb_ts from candles e join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = e.ts where e.asset = 'ETH' and e.tf = '4h' order by e.ts desc limit 1;
  select e.c / b.c into eb_24 from candles e join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = e.ts where e.asset = 'ETH' and e.tf = '4h' and e.ts <= eb_ts - interval '24 hours' order by e.ts desc limit 1;
  select e.c / b.c into eb_7d from candles e join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = e.ts where e.asset = 'ETH' and e.tf = '4h' and e.ts <= eb_ts - interval '7 days' order by e.ts desc limit 1;
  cx_state := case when tot_now is null or us_now is null or tot_24 is null or us_24 is null or cx_ts < now() - interval '8 hours' then 'stale'
                   when us_now < us_24 and tot_now > tot_24 then (case when us_now < us_7d and tot_now > tot_7d then 'risk_on' else 'leaning_on' end)
                   when us_now > us_24 and tot_now < tot_24 then (case when us_now > us_7d and tot_now < tot_7d then 'risk_off' else 'leaning_off' end)
                   else 'mixed' end;
  cx_text := case cx_state
    when 'stale' then 'Market context is stale — TOTAL / USDT.D not updated in 8h+.'
    when 'risk_on' then 'Risk-on: USDT dominance falling and TOTAL rising on both 24h and 7d — money moving into crypto.'
    when 'leaning_on' then 'Leaning risk-on: USDT dominance down and TOTAL up over 24h (7d not confirming yet).'
    when 'risk_off' then 'Risk-off: USDT dominance rising and TOTAL falling on both 24h and 7d — money hiding in stablecoins.'
    when 'leaning_off' then 'Leaning risk-off: USDT dominance up and TOTAL down over 24h (7d not confirming yet).'
    else 'Mixed: USDT dominance and TOTAL not agreeing — no market tailwind either way.' end
    || case when eb_7d is null then '' when eb_now / eb_7d - 1 > 0.01 then ' Alts leading (ETH/BTC up 7d).' when eb_now / eb_7d - 1 < -0.01 then ' BTC leading (ETH/BTC down 7d).' else ' ETH/BTC flat.' end;
  anchor := anchor || jsonb_build_object('context', jsonb_build_object('state', cx_state, 'text', cx_text, 'as_of', cx_ts,
    'total_bn', tot_now, 'total_24h_pct', round(100 * (tot_now / nullif(tot_24, 0) - 1), 2), 'total_7d_pct', round(100 * (tot_now / nullif(tot_7d, 0) - 1), 2),
    'usdt_d', us_now, 'usdt_d_24h', round(us_now - us_24, 3), 'usdt_d_7d', round(us_now - us_7d, 3),
    'ethbtc', round(eb_now, 5), 'ethbtc_24h_pct', round(100 * (eb_now / nullif(eb_24, 0) - 1), 2), 'ethbtc_7d_pct', round(100 * (eb_now / nullif(eb_7d, 0) - 1), 2)));

  foreach v_coin in array array['BTC','ETH','SOL'] loop$b$);
  if position($a$abs(v_entry - ema200) <= greatest(0.5 * atr1, 0.004 * v_entry);$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$abs(v_entry - ema200) <= greatest(0.5 * atr1, 0.004 * v_entry);$a$, $b$abs(v_entry - ema200) <= greatest(0.5 * atr1, 0.004 * v_entry);
      near_ctx := v_entry is not null and ((sg = 1 and cx_state in ('risk_on','leaning_on')) or (sg = -1 and cx_state in ('risk_off','leaning_off')));$b$);
  if position($a$'ema200_confluence', near_ema)$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$'ema200_confluence', near_ema)$a$, $b$'ema200_confluence', near_ema, 'ctx_aligned', near_ctx, 'ctx_state', cx_state)$b$);
  if position($a$confidence %s%s%s'$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$confidence %s%s%s'$a$, $b$confidence %s%s%s%s'$b$);
  if position($a$case when near_ema then ' · EMA200✓' else '' end)$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$case when near_ema then ' · EMA200✓' else '' end)$a$, $b$case when near_ema then ' · EMA200✓' else '' end, case when near_ctx then ' · CTX✓' else '' end)$b$);
  if n <> 6 then raise exception 'only % of 6 anchors found', n; end if;
  execute d;
end $do$;

select cron.alter_job(jobid, command := 'select public.market_context_sync(); select public.lev_limit_resolve(); select public.lev_board_refresh(); select public.woods_scan(true);') from cron.job where jobname = 'moonbag-woods-scan';
