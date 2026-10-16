-- FEEDBACK LOOP (Stavros, 2026-10-16): "look at the trades you suggested, look at what actually happened, and then learn
-- from it and improve for the following week ... on every one of my trades, after 72 hours, give a full update on what price
-- did and what the best play would have been and how i can improve next time ... each week we should be getting more
-- accurate and better. i want you to quantify and actually execute against this goal".

-- 1) 72-hour review of every BloFin trade (numbers from stored 1h candles; the Coach writes the words).
create table if not exists public.trade_review_72h (
  trade_id text primary key references public.trades(trade_id),
  created_at timestamptz not null default now(),
  symbol text not null,
  direction text not null,
  opened_at timestamptz not null,
  window_end timestamptz not null,
  numbers jsonb not null,            -- output of lev_trade_72h()
  r_realized numeric,
  mfe_r numeric,
  mae_r numeric,
  capture_pct numeric,               -- r_realized / mfe_r × 100 (how much of the available move he kept)
  best_play text,                    -- hindsight: the best entry / stop / exit inside the 72h
  what_price_did text,
  improve text,                      -- the one change for next time
  verdict text,
  sent_at timestamptz
);
alter table public.trade_review_72h enable row level security;

create or replace function public.lev_trade_72h(p_trade_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare
  t record; sg integer; t0 timestamptz; t1 timestamptz; e numeric; s numeric; risk numeric;
  hi numeric; lo numeric; c72 numeric; mfe_px numeric; mfe_ts timestamptz; mae_before numeric; stop_hit timestamptz;
  best_entry numeric; opp numeric; n integer; tp1 numeric; tp1_hit timestamptz;
begin
  select * into t from public.trades where trade_id = p_trade_id;
  if not found then return jsonb_build_object('error', 'no trade'); end if;
  sg := case when t.direction = 'short' then -1 else 1 end;
  t0 := coalesce(t.opened_at, t.created_at); t1 := t0 + interval '72 hours';
  e := t.entry; s := t.stop; risk := abs(e - s);
  tp1 := coalesce(t.tp1, t.target);
  if risk is null or risk = 0 then return jsonb_build_object('error', 'no stop'); end if;
  select count(*), max(h), min(l) into n, hi, lo from public.candles
   where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts < t1;
  if n < 6 then return jsonb_build_object('error', 'not enough 1h candles', 'bars', n); end if;
  select c into c72 from public.candles where asset = t.symbol and tf = '1h' and ts < t1 order by ts desc limit 1;
  -- best price in the trade's direction and when
  if sg = 1 then select h, ts into mfe_px, mfe_ts from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts < t1 order by h desc, ts limit 1;
  else select l, ts into mfe_px, mfe_ts from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts < t1 order by l asc, ts limit 1; end if;
  -- worst price before the best price (the stop that would have survived to it); also a better entry available before it
  if sg = 1 then select min(l) into mae_before from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts <= mfe_ts;
  else select max(h) into mae_before from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts <= mfe_ts; end if;
  best_entry := mae_before;
  -- first touch of the original stop / TP1
  select min(ts) into stop_hit from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts < t1
     and ((sg = 1 and l <= s) or (sg = -1 and h >= s));
  if tp1 is not null then
    select min(ts) into tp1_hit from public.candles where asset = t.symbol and tf = '1h' and ts >= date_trunc('hour', t0) and ts < t1
       and ((sg = 1 and h >= tp1) or (sg = -1 and l <= tp1));
  end if;
  opp := case when sg = 1 then (e - lo) / risk else (hi - e) / risk end;   -- the move the OTHER way, in R
  return jsonb_build_object(
    'trade_id', t.trade_id, 'symbol', t.symbol, 'direction', t.direction, 'opened_at', t0, 'window_end', t1, 'bars', n,
    'entry', e, 'stop', s, 'tp1', tp1, 'risk_per_unit', risk, 'r_realized', t.r_multiple, 'status', t.status,
    'high_72h', hi, 'low_72h', lo, 'close_72h', c72,
    'mfe_r', round(sg * (mfe_px - e) / risk, 2), 'mfe_price', mfe_px, 'mfe_at', mfe_ts,
    'mae_r', round(sg * ((case when sg = 1 then lo else hi end) - e) / risk, 2),
    'mae_before_best_r', round(sg * (mae_before - e) / risk, 2),
    'stop_needed_to_reach_best', mae_before,
    'original_stop_hit_at', stop_hit, 'tp1_hit_at', tp1_hit,
    'plan_result', case when stop_hit is null and tp1_hit is null then 'neither' when tp1_hit is not null and (stop_hit is null or tp1_hit < stop_hit) then 'tp1_first' else 'stop_first' end,
    'close_72h_r', round(sg * (c72 - e) / risk, 2),
    'better_entry', best_entry, 'better_entry_r_saved', round(abs(e - best_entry) / risk, 2),
    'other_side_r', round(opp, 2),
    'capture_pct', case when t.r_multiple is not null and sg * (mfe_px - e) > 0 then round(100 * t.r_multiple / (sg * (mfe_px - e) / risk), 0) end
  );
end $f$;

-- 2) Weekly scorecard: is Moonbag (and Stavros) getting more accurate week over week?
create table if not exists public.lev_scorecard (
  week_start date primary key,       -- Monday, Phoenix
  created_at timestamptz not null default now(),
  metrics jsonb not null,            -- lev_weekly_scorecard() output
  targets jsonb,                     -- the bar for this week (from the trailing 4 weeks)
  met jsonb,                         -- per-target true/false
  score integer,                     -- targets met
  score_of integer,
  last_change_verdict text,          -- did last week's change move its KPI?
  focus text,                        -- the ONE change for next week (Desk Lead + open planner read it)
  focus_kpi text,                    -- which KPI the focus is meant to move
  report text
);
alter table public.lev_scorecard enable row level security;

create or replace function public.lev_weekly_scorecard(p_week_start date)
returns jsonb language sql stable security definer set search_path = public as $f$
with w as (
  select (p_week_start::timestamp at time zone 'America/Phoenix') as a,
         ((p_week_start + 7)::timestamp at time zone 'America/Phoenix') as b
),
sent as (   -- what Moonbag told him to trade: DESK ALERT signals (grade 4-5) + paper limit setups, resolved this week
  select s.outcome_r::numeric as r, s.outcome = 'tp1' as hit from lev_signals s, w
   where s.resolved_at >= w.a and s.resolved_at < w.b and s.outcome in ('tp1','stop','timeout')
     and s.confidence_grade >= 4 and coalesce(s.status_reason, '') not ilike 'RESEARCH ONLY%'
  union all
  select l.outcome_r, l.outcome = 'target_first' from limit_orders l, w
   where l.origin = 'paper' and l.resolved_at >= w.a and l.resolved_at < w.b and l.outcome_r is not null
),
model as (  -- every play the desk drew, sent or not
  select s.outcome_r::numeric as r, s.outcome = 'tp1' as hit from lev_signals s, w
   where s.resolved_at >= w.a and s.resolved_at < w.b and s.outcome in ('tp1','stop','timeout')
),
bias as (
  select p.bias_correct from lev_open_plan p where p.plan_date >= p_week_start and p.plan_date < p_week_start + 7 and p.bias_correct is not null
),
you as (
  select t.r_multiple::numeric as r, (t.realized_pnl - coalesce(t.fees, 0))::numeric as pnl from trades t, w
   where t.venue = 'blofin' and t.status = 'closed' and t.closed_at >= w.a and t.closed_at < w.b
),
rev as (
  select r.capture_pct, r.mfe_r, r.r_realized from trade_review_72h r, w where r.opened_at >= w.a and r.opened_at < w.b
),
lb as (
  select l.dollars_left_on_table, l.dollars_saved, case when jsonb_typeof(l.rules_broken) = 'array' then jsonb_array_length(l.rules_broken) when jsonb_typeof(l.rules_broken) = 'object' then (select count(*) from jsonb_object_keys(l.rules_broken))::int else 0 end as breaks from trade_lookbacks l
   where l.week_start = p_week_start and l.venue = 'blofin'
)
select jsonb_build_object(
  'week_start', p_week_start,
  'sent_n', (select count(*) from sent), 'sent_avg_r', (select round(avg(r), 3) from sent), 'sent_hit_pct', (select round(100.0 * avg(hit::int), 1) from sent),
  'model_n', (select count(*) from model), 'model_avg_r', (select round(avg(r), 3) from model), 'model_hit_pct', (select round(100.0 * avg(hit::int), 1) from model),
  'bias_n', (select count(*) from bias), 'bias_hit_pct', (select round(100.0 * avg(bias_correct::int), 1) from bias),
  'you_n', (select count(*) from you), 'you_avg_r', (select round(avg(r), 3) from you), 'you_total_r', (select round(sum(r), 2) from you),
  'you_win_pct', (select round(100.0 * avg((r > 0.1)::int), 1) from you), 'you_pnl', (select round(sum(pnl), 2) from you),
  'capture_pct', (select round(100 * sum(r_realized) / nullif(sum(greatest(mfe_r, 0)), 0), 1) from rev), 'avg_mfe_r', (select round(avg(mfe_r), 2) from rev), 'reviews_n', (select count(*) from rev),
  'rule_breaks', (select coalesce(sum(breaks), 0) from lb),
  'left_on_table', (select round(coalesce(sum(dollars_left_on_table), 0), 2) from lb), 'saved', (select round(coalesce(sum(dollars_saved), 0), 2) from lb)
);
$f$;

-- What the desks read every run: the latest focus line.
create or replace view public.v_lev_focus with (security_invoker = true) as
  select week_start, focus, focus_kpi, score, score_of from public.lev_scorecard order by week_start desc limit 1;

-- 3) Score a week against its targets (deterministic; the weekly review calls it, then writes the focus).
create or replace function public.lev_score_week(p_week_start date)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare
  m jsonb := public.lev_weekly_scorecard(p_week_start);
  tr record; tg jsonb := '{}'::jsonb; met jsonb := '{}'::jsonb; sc integer := 0; cnt integer := 0;
  v numeric; bar numeric; ok boolean;
begin
  select avg((metrics->>'sent_avg_r')::numeric) sent, avg((metrics->>'model_avg_r')::numeric) model,
         avg((metrics->>'you_avg_r')::numeric) you, avg((metrics->>'capture_pct')::numeric) cap
    into tr from (select metrics from public.lev_scorecard where week_start < p_week_start order by week_start desc limit 4) x;
  v := (m->>'sent_avg_r')::numeric; bar := greatest(0, coalesce(tr.sent, 0));
  if v is not null then ok := v > 0 and v >= bar; tg := tg || jsonb_build_object('sent_avg_r', format('> 0R and >= %sR', round(bar, 2))); met := met || jsonb_build_object('sent_avg_r', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  v := (m->>'model_avg_r')::numeric; bar := coalesce(tr.model, v);
  if v is not null then ok := v >= bar; tg := tg || jsonb_build_object('model_avg_r', format('>= %sR', round(bar, 2))); met := met || jsonb_build_object('model_avg_r', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  v := (m->>'bias_hit_pct')::numeric;
  if v is not null then ok := v >= 60; tg := tg || jsonb_build_object('bias_hit_pct', '>= 60%'); met := met || jsonb_build_object('bias_hit_pct', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  v := (m->>'you_avg_r')::numeric;
  if v is not null then ok := v > 0; tg := tg || jsonb_build_object('you_avg_r', '> 0R'); met := met || jsonb_build_object('you_avg_r', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  v := (m->>'capture_pct')::numeric; bar := coalesce(tr.cap, 50);
  if v is not null then ok := v >= bar; tg := tg || jsonb_build_object('capture_pct', format('>= %s%%', round(bar, 0))); met := met || jsonb_build_object('capture_pct', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  if (m->>'you_n')::int > 0 then ok := (m->>'rule_breaks')::int = 0; tg := tg || jsonb_build_object('rule_breaks', '0'); met := met || jsonb_build_object('rule_breaks', ok); cnt := cnt + 1; sc := sc + ok::int; end if;
  insert into public.lev_scorecard (week_start, metrics, targets, met, score, score_of)
  values (p_week_start, m, tg, met, sc, cnt)
  on conflict (week_start) do update set metrics = excluded.metrics, targets = excluded.targets, met = excluded.met, score = excluded.score, score_of = excluded.score_of;
  return jsonb_build_object('week_start', p_week_start, 'metrics', m, 'targets', tg, 'met', met, 'score', sc, 'score_of', cnt);
end $f$;
