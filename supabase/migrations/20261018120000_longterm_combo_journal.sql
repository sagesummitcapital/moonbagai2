-- 2026-10-18 · Long-term simplification + divergence combo + journal (already live; this file records it).
-- Order matters: functions are patched in place with pg_get_functiondef + replace, on top of 20261017120000.

-- market_divergence table
create table if not exists public.market_divergence (as_of timestamptz primary key, bar_ts timestamptz, combo text, detail jsonb not null, created_at timestamptz not null default now());
alter table public.market_divergence enable row level security;
comment on table public.market_divergence is 'Divergence combo (WoodsBot-style): 4H RSI divergence on BTC, TOTAL2 and TOTAL3 at the same time. Stavros 2026-10-18: "i got this from woods bot - can you replicate and add to woods machine?"';

-- rsi_div
create or replace function public.rsi_div(lo numeric[], hi numeric[], cl numeric[], os numeric default 45) returns jsonb language plpgsql immutable as $fn$
-- 4H RSI divergence on the latest swing, WoodsBot-style (fires at the bar close, no waiting for confirmation):
--   p2 = the last closed bar if it is the lowest low of the last 4 bars, else the latest confirmed pivot low (3 left / 2 right) within 10 bars;
--   p1 = the most recent earlier pivot low 3-40 bars back that p2 undercut or matched (p2 low <= p1 low x 1.003, Woods' tolerance);
--   bull = RSI(p2) > RSI(p1) and the lower of the two RSIs < os (oversold-ish). Bear = mirror on highs (RSI > 100 - os).
declare n int := coalesce(array_length(cl,1),0); r numeric[]; up numeric := 0; dn numeric := 0; d numeric; i int; j int;
  b2 int; b1 int; s2 int; s1 int; bull boolean := false; bear boolean := false;
begin
  if n < 45 then return jsonb_build_object('error','not enough bars'); end if;
  r := array_fill(null::numeric, array[n]);
  for i in 2..15 loop d := cl[i]-cl[i-1]; up := up + greatest(d,0); dn := dn + greatest(-d,0); end loop;
  up := up/14; dn := dn/14; r[15] := case when dn = 0 then 100 else 100 - 100/(1+up/dn) end;
  for i in 16..n loop d := cl[i]-cl[i-1]; up := (up*13+greatest(d,0))/14; dn := (dn*13+greatest(-d,0))/14; r[i] := case when dn = 0 then 100 else 100 - 100/(1+up/dn) end; end loop;
  -- lows
  if lo[n] = (select min(x) from unnest(lo[n-3:n]) x) then b2 := n; else
    for i in reverse (n-2)..(n-10) loop
      if lo[i] = (select min(x) from unnest(lo[i-3:i+2]) x) then b2 := i; exit; end if;
    end loop;
  end if;
  if b2 is not null then
    for j in reverse (b2-3)..greatest(b2-40, 20) loop
      if lo[j] = (select min(x) from unnest(lo[j-3:j+2]) x) and lo[b2] <= lo[j] * 1.003 then b1 := j; exit; end if;
    end loop;
    if b1 is not null then bull := r[b2] > r[b1] and least(r[b1], r[b2]) < os; end if;
  end if;
  -- highs
  if hi[n] = (select max(x) from unnest(hi[n-3:n]) x) then s2 := n; else
    for i in reverse (n-2)..(n-10) loop
      if hi[i] = (select max(x) from unnest(hi[i-3:i+2]) x) then s2 := i; exit; end if;
    end loop;
  end if;
  if s2 is not null then
    for j in reverse (s2-3)..greatest(s2-40, 20) loop
      if hi[j] = (select max(x) from unnest(hi[j-3:j+2]) x) and hi[s2] >= hi[j] * 0.997 then s1 := j; exit; end if;
    end loop;
    if s1 is not null then bear := r[s2] < r[s1] and greatest(r[s1], r[s2]) > 100 - os; end if;
  end if;
  return jsonb_build_object('bull', bull, 'bear', bear, 'rsi_now', round(r[n],1),
    'bull_pivots', case when b1 is null then null else jsonb_build_array(b1-n, b2-n) end, 'bull_rsi', case when b1 is null then null else jsonb_build_array(round(r[b1],1), round(r[b2],1)) end,
    'bull_lows', case when b1 is null then null else jsonb_build_array(lo[b1], lo[b2]) end,
    'bear_pivots', case when s1 is null then null else jsonb_build_array(s1-n, s2-n) end, 'bear_rsi', case when s1 is null then null else jsonb_build_array(round(r[s1],1), round(r[s2],1)) end,
    'bear_highs', case when s1 is null then null else jsonb_build_array(hi[s1], hi[s2]) end,
    'low', case when b2 is null then null else lo[b2] end, 'high', case when s2 is null then null else hi[s2] end);
end $fn$;

-- woods_market_divergence (v1)
create or replace function public.woods_market_divergence(p_save boolean default true, p_at timestamptz default null) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
-- WoodsBot-style "Divergence Combo": 4H RSI divergence on BTC, TOTAL2 (crypto ex-BTC) and TOTAL3 (ex-BTC and ETH) at the same time.
-- TOTAL2/TOTAL3 are derived from TOTAL (market_context_sync) minus BTC/ETH market caps (BloFin 4H closes x circulating supply).
declare s_btc numeric := 19.94e6; s_eth numeric := 120.7e6;
  ts_a timestamptz[]; b_lo numeric[]; b_hi numeric[]; b_c numeric[]; t2 numeric[]; t3 numeric[];
  db jsonb; d2 jsonb; d3 jsonb; nb int; combo text; out jsonb; last_ts timestamptz;
begin
  select array_agg(ts order by ts), array_agg(bl order by ts), array_agg(bh order by ts), array_agg(bc order by ts), array_agg(x2 order by ts), array_agg(x3 order by ts)
    into ts_a, b_lo, b_hi, b_c, t2, t3
  from (select t.ts, b.l bl, b.h bh, b.c bc, t.c - b.c * s_btc / 1e9 x2, t.c - b.c * s_btc / 1e9 - e.c * s_eth / 1e9 x3
          from candles t join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = t.ts join candles e on e.asset = 'ETH' and e.tf = '4h' and e.ts = t.ts
         where t.asset = 'TOTAL' and t.tf = '4h' and (p_at is null or t.ts <= p_at)
         order by t.ts desc limit 150) z;
  if coalesce(array_length(ts_a,1),0) < 40 then return jsonb_build_object('error','not enough aligned 4H bars'); end if;
  last_ts := ts_a[array_length(ts_a,1)];
  db := rsi_div(b_lo, b_hi, b_c); d2 := rsi_div(t2, t2, t2); d3 := rsi_div(t3, t3, t3);
  nb := (db->>'bull')::boolean::int + (d2->>'bull')::boolean::int + (d3->>'bull')::boolean::int;
  combo := case when nb = 3 then 'bull'
                when (db->>'bear')::boolean and (d2->>'bear')::boolean and (d3->>'bear')::boolean then 'bear' else null end;
  out := jsonb_build_object('as_of', now(), 'bar', last_ts, 'combo', combo,
    'bull_count', nb, 'bear_count', (db->>'bear')::boolean::int + (d2->>'bear')::boolean::int + (d3->>'bear')::boolean::int,
    'btc', db, 'total2', d2 || jsonb_build_object('now_bn', round(t2[array_length(t2,1)],1)), 'total3', d3 || jsonb_build_object('now_bn', round(t3[array_length(t3,1)],1)),
    'text', case combo
      when 'bull' then 'DIVERGENCE COMBO ▲ — 4H RSI bullish divergence on BTC, TOTAL2 and TOTAL3 together: selling momentum is fading across the whole market. Look for longs at swept lows once the 1H trigger prints; no shorts into it.'
      when 'bear' then 'DIVERGENCE COMBO ▼ — 4H RSI bearish divergence on BTC, TOTAL2 and TOTAL3 together: buying momentum is fading across the market. Look for shorts at swept highs once the 1H trigger prints; no new longs at highs.'
      else format('No combo — 4H RSI divergence: bullish on %s of 3, bearish on %s of 3 (BTC, TOTAL2, TOTAL3).', nb, (db->>'bear')::boolean::int + (d2->>'bear')::boolean::int + (d3->>'bear')::boolean::int) end);
  if p_save then
    insert into market_divergence (as_of, bar_ts, combo, detail) values (now(), last_ts, combo, out) on conflict (as_of) do nothing;
    if combo is not null then
      insert into woods_events (coin, side, kind, bar_ts, detail) values ('MARKET', case when combo = 'bull' then 'long' else 'short' end, 'divergence_combo', last_ts, out) on conflict do nothing;
    end if;
  end if;
  return out;
end $fn$;

-- woods_market_divergence → TOTAL2/TOTAL3 candles
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.woods_market_divergence(boolean, timestamp with time zone)'::regprocedure);
  if position($a$ts_a timestamptz[]; b_lo numeric[]; b_hi numeric[]; b_c numeric[]; t2 numeric[]; t3 numeric[];$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$ts_a timestamptz[]; b_lo numeric[]; b_hi numeric[]; b_c numeric[]; t2 numeric[]; t3 numeric[];$a$, $b$ts_a timestamptz[]; b_lo numeric[]; b_hi numeric[]; b_c numeric[]; t2 numeric[]; t3 numeric[]; t2l numeric[]; t2h numeric[]; t3l numeric[]; t3h numeric[];$b$);
  if position($a$  select array_agg(ts order by ts), array_agg(bl order by ts), array_agg(bh order by ts), array_agg(bc order by ts), array_agg(x2 order by ts), array_agg(x3 order by ts)
    into ts_a, b_lo, b_hi, b_c, t2, t3
  from (select t.ts, b.l bl, b.h bh, b.c bc, t.c - b.c * s_btc / 1e9 x2, t.c - b.c * s_btc / 1e9 - e.c * s_eth / 1e9 x3
          from candles t join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = t.ts join candles e on e.asset = 'ETH' and e.tf = '4h' and e.ts = t.ts
         where t.asset = 'TOTAL' and t.tf = '4h' and (p_at is null or t.ts <= p_at)
         order by t.ts desc limit 150) z;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$  select array_agg(ts order by ts), array_agg(bl order by ts), array_agg(bh order by ts), array_agg(bc order by ts), array_agg(x2 order by ts), array_agg(x3 order by ts)
    into ts_a, b_lo, b_hi, b_c, t2, t3
  from (select t.ts, b.l bl, b.h bh, b.c bc, t.c - b.c * s_btc / 1e9 x2, t.c - b.c * s_btc / 1e9 - e.c * s_eth / 1e9 x3
          from candles t join candles b on b.asset = 'BTC' and b.tf = '4h' and b.ts = t.ts join candles e on e.asset = 'ETH' and e.tf = '4h' and e.ts = t.ts
         where t.asset = 'TOTAL' and t.tf = '4h' and (p_at is null or t.ts <= p_at)
         order by t.ts desc limit 150) z;$a$, $b$  -- TOTAL2 / TOTAL3: TradingView CRYPTOCAP history spliced with CoinGecko (market_context_sync); BTC: BloFin closed 4H bars
  select array_agg(ts order by ts), array_agg(bl order by ts), array_agg(bh order by ts), array_agg(bc order by ts), array_agg(c2 order by ts), array_agg(c3 order by ts),
         array_agg(l2 order by ts), array_agg(h2 order by ts), array_agg(l3 order by ts), array_agg(h3 order by ts)
    into ts_a, b_lo, b_hi, b_c, t2, t3, t2l, t2h, t3l, t3h
  from (select b.ts, b.l bl, b.h bh, b.c bc, x.c c2, x.l l2, x.h h2, y.c c3, y.l l3, y.h h3
          from candles b join candles x on x.asset = 'TOTAL2' and x.tf = '4h' and x.ts = b.ts join candles y on y.asset = 'TOTAL3' and y.tf = '4h' and y.ts = b.ts
         where b.asset = 'BTC' and b.tf = '4h' and (p_at is null or b.ts <= p_at)
         order by b.ts desc limit 150) z;$b$);
  if position($a$d2 := rsi_div(t2, t2, t2); d3 := rsi_div(t3, t3, t3);$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$d2 := rsi_div(t2, t2, t2); d3 := rsi_div(t3, t3, t3);$a$, $b$d2 := rsi_div(t2l, t2h, t2); d3 := rsi_div(t3l, t3h, t3);$b$);
  if n <> 3 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- woods_market_divergence → explicit rsi_div overload
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.woods_market_divergence(boolean, timestamp with time zone)'::regprocedure);
  if position($a$db := rsi_div(b_lo, b_hi, b_c); d2 := rsi_div(t2l, t2h, t2); d3 := rsi_div(t3l, t3h, t3);$a$ in d) = 0 then raise exception 'anchor missing'; end if;
  d := replace(d, $a$db := rsi_div(b_lo, b_hi, b_c); d2 := rsi_div(t2l, t2h, t2); d3 := rsi_div(t3l, t3h, t3);$a$, $b$db := rsi_div(b_lo, b_hi, b_c, 45::numeric); d2 := rsi_div(t2l, t2h, t2, 45::numeric); d3 := rsi_div(t3l, t3h, t3, 45::numeric);$b$);
  execute d;
end $do$;

-- market_context_sync → TOTAL2/TOTAL3
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.market_context_sync()'::regprocedure);
  if position($a$foreach v_a in array array['TOTAL','USDT.D'] loop$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$foreach v_a in array array['TOTAL','USDT.D'] loop$a$, $b$foreach v_a in array array['TOTAL','USDT.D','TOTAL2','TOTAL3'] loop$b$);
  if position($a$v_raw := case v_a when 'TOTAL' then v_total else v_usdt end;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$v_raw := case v_a when 'TOTAL' then v_total else v_usdt end;$a$, $b$v_raw := case v_a when 'TOTAL' then v_total when 'USDT.D' then v_usdt
      when 'TOTAL2' then v_total * (1 - (body->'market_cap_percentage'->>'btc')::numeric / 100)
      when 'TOTAL3' then v_total * (1 - ((body->'market_cap_percentage'->>'btc')::numeric + (body->'market_cap_percentage'->>'eth')::numeric) / 100) end;$b$);
  if position($a$case when v_a = 'TOTAL' then 1 else 3 end$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$case when v_a = 'TOTAL' then 1 else 3 end$a$, $b$case when v_a = 'USDT.D' then 3 else 1 end$b$);
  if n <> 3 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- woods_scan → divergence combo flag
do $do$
declare d text; n int := 0;
begin
  d := pg_get_functiondef('public.woods_scan(boolean)'::regprocedure);
  if position($a$eb_7d numeric;$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$eb_7d numeric;$a$, $b$eb_7d numeric; cb jsonb; cb_dir text; wb_alert jsonb; near_cb boolean;$b$);
  if position($a$  foreach v_coin in array array['BTC','ETH','SOL'] loop$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$  foreach v_coin in array array['BTC','ETH','SOL'] loop$a$, $b$  -- DIVERGENCE COMBO (Stavros 2026-10-18, from WoodsBot: 4H RSI divergence on BTC + TOTAL2 + TOTAL3 together). Paper flag only.
  select detail into cb from market_divergence where as_of > now() - interval '8 hours' order by as_of desc limit 1;
  select jsonb_build_object('side', side, 'bar', bar_ts, 'at', created_at) into wb_alert from woods_events where coin = 'MARKET' and kind = 'woodsbot_combo' and created_at > now() - interval '24 hours' order by created_at desc limit 1;
  cb_dir := coalesce(cb->>'combo', (select case when side = 'long' then 'bull' else 'bear' end from woods_events where coin = 'MARKET' and kind = 'divergence_combo' and bar_ts > now() - interval '24 hours' order by bar_ts desc limit 1));
  anchor := anchor || jsonb_build_object('combo', jsonb_build_object('state', cb_dir, 'text', coalesce(cb->>'text', 'Divergence combo not scanned yet.'), 'bar', cb->'bar', 'bull_count', cb->'bull_count', 'bear_count', cb->'bear_count', 'woodsbot', wb_alert));

  foreach v_coin in array array['BTC','ETH','SOL'] loop$b$);
  if position($a$near_ctx := v_entry is not null and$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$near_ctx := v_entry is not null and$a$, $b$near_cb := v_entry is not null and ((sg = 1 and (cb_dir = 'bull' or wb_alert->>'side' = 'long')) or (sg = -1 and (cb_dir = 'bear' or wb_alert->>'side' = 'short')));
      near_ctx := v_entry is not null and$b$);
  if position($a$'ctx_aligned', near_ctx, 'ctx_state', cx_state)$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$'ctx_aligned', near_ctx, 'ctx_state', cx_state)$a$, $b$'ctx_aligned', near_ctx, 'ctx_state', cx_state, 'combo_aligned', near_cb)$b$);
  if position($a$confidence %s%s%s%s'$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$confidence %s%s%s%s'$a$, $b$confidence %s%s%s%s%s'$b$);
  if position($a$case when near_ctx then ' · CTX✓' else '' end)$a$ in d) > 0 then n := n + 1; end if;
  d := replace(d, $a$case when near_ctx then ' · CTX✓' else '' end)$a$, $b$case when near_ctx then ' · CTX✓' else '' end, case when near_cb then ' · COMBO✓' else '' end)$b$);
  if n <> 6 then raise exception 'anchors %', n; end if;
  execute d;
end $do$;

-- core_etfs theme
insert into investment_themes (theme_id, name, mechanism, what_would_break_it, conviction, status, last_reviewed_at) values ('core_etfs', 'Broad-market ballast (ETFs)', $m$A low-cost S&P 500 core balances the concentrated space and government bets so one bad headline can't sink the account (Stavros 2026-10-18: "maybe part can go into etfs if possible as well to balance things").$m$, $m$Nothing short of a structural break in US equities; this is ballast, not a thesis bet.$m$, 70, 'active', now()) on conflict (theme_id) do nothing returning theme_id;

-- lt_universe hold role
alter table public.lt_universe drop constraint lt_universe_role_check, add constraint lt_universe_role_check check (role = any (array['core','hold','watch','avoid']));

-- lt_universe new names
insert into lt_universe (symbol, name, theme_id, role, target_weight_pct, fud_boost, thesis, add_rule, break_rule, status, notes) values
('UFO','Procure Space ETF','space','core',10,true,$m$Basket of space-economy companies; now holds SpaceX after the VettaFi index reconstitution — the diversified way to own the space theme.$m$,$m$Weekly DCA at target weight; extra buy on a news dip.$m$,$m$Fund drops SpaceX or closes; or the space thesis breaks (Starlink/launch growth stalls 2+ quarters).$m$,'active',$m$Added 2026-10-18 (Stavros: buy and hold space and government stocks; ETFs to balance).$m$),
('ITA','iShares U.S. Aerospace & Defense ETF','defense','core',7,false,$m$The defense primes — the government spending floor, held as an ETF instead of single names.$m$,$m$Weekly DCA at target weight.$m$,$m$Two consecutive budget cycles of real cuts to US defense procurement.$m$,'active',$m$Added 2026-10-18.$m$),
('VOO','Vanguard S&P 500 ETF','core_etfs','core',8,false,$m$Broad-market ballast so one bad headline in space or government names can't sink the account.$m$,$m$Weekly DCA at target weight.$m$,$m$None — ballast. Never sold for performance.$m$,'active',$m$Added 2026-10-18.$m$),
('PLTR','Palantir','ai_infrastructure_core','hold',null,false,$m$Held from before the 2026-10-18 simplification. Keep; no new buys (Stavros).$m$,$m$None — no new buys.$m$,$m$Only Stavros sells.$m$,'active',$m$2026-10-18: keep, no new buys.$m$)
on conflict (symbol) do nothing returning symbol;

-- lt_universe weights
update lt_universe u set role=v.role, target_weight_pct=v.w, fud_boost=v.f, notes=coalesce(u.notes,'')||' | 2026-10-18 simplified plan: '||v.role||coalesce(' '||v.w::text||'%','') from (values ('SPCX','core',22::numeric,true),('TSLA','core',18,true),('INTC','core',8,true),('MP','core',7,true),('LHX','core',5,true),('GFS','core',5,true),('GLD','core',6,false),('SLV','core',4,false),('NVDA','hold',null,false),('GDX','watch',null,false),('FCX','watch',null,false)) v(s,role,w,f) where u.symbol=v.s returning u.symbol, u.role, u.target_weight_pct;

-- risk_config robinhood 100% long-term (Stavros 2026-10-18)
update risk_config set lt_sleeve_pct = 100, lt_dca_weeks = 8, lt_dca_start = '2026-10-19', updated_at = now() where venue = 'robinhood' returning venue, lt_sleeve_pct, lt_dca_weeks, lt_dca_start;

-- v_lt_sleeve hold carve-out
do $do$
declare d text; n int;
begin
  d := pg_get_viewdef('public.v_lt_sleeve'::regclass);
  n := (length(d) - length(replace(d, '( SELECT eq.equity
           FROM eq)', ''))) / length('( SELECT eq.equity
           FROM eq)');
  if n <> 2 then raise exception 'expected 2 equity refs, got %', n; end if;
  -- 2026-10-18: holds Stavros keeps but doesn't add to (role 'hold': NVDA, PLTR) are carved out of the base the targets are computed on
  d := replace(d, '( SELECT eq.equity
           FROM eq)', '(( SELECT eq.equity FROM eq) - ( SELECT COALESCE(sum(COALESCE(t.position_value, t.entry * t.quantity)), 0) FROM trades t JOIN lt_universe hu ON hu.symbol = t.symbol AND hu.role = ''hold'' WHERE t.venue = ''robinhood'' AND t.status = ''open''))');
  execute 'create or replace view public.v_lt_sleeve as ' || d;
end $do$;

-- journal_posts
create table if not exists public.journal_posts (
  post_url text primary key,
  posted_at timestamptz,
  scraped_at timestamptz not null default now(),
  raw_text text not null,
  chart_note text,
  coins text[],
  kind text,
  linked_trade_ids text[],
  processed_at timestamptz,
  digest jsonb
);
alter table public.journal_posts enable row level security;
comment on table public.journal_posts is 'Stavros''s own X posts (@SageSummitCap) = his trading journal. Scraped weekly, verbatim; the Saturday review links them to trades and grades the reads. Stavros 2026-10-17: "this will essentially be the equivalent of my trading journal so i dont have to send twice".';

-- 15-min job (approved by Stavros 2026-10-18)
select cron.alter_job(jobid, command := 'select public.market_context_sync(); select public.woods_market_divergence(true); select public.lev_limit_resolve(); select public.lev_board_refresh(); select public.woods_scan(true);') from cron.job where jobname = 'moonbag-woods-scan';
-- Note: TOTAL2/TOTAL3 4h history (200 bars each) was backfilled once from TradingView CRYPTOCAP; data not in this file.
