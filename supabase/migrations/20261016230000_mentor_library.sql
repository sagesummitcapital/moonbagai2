-- THE MENTOR LIBRARY (Stavros, 2026-10-16: "i really like eliz on macro and woods on micro - i follow them both closely ...
-- pretend this is their last cycle and lets get as much knowledge about how they think so we can keep it going when they are gone").
-- See docs/strategy/MENTORS.md. Applied live 2026-10-16 (seed rows — posts #1–2, 22 principles, 6 calls, 15 questions, the
-- three Eliz levels — were inserted with ordinary inserts and are not repeated here).

create table if not exists public.mentor_posts (
  post_id bigserial primary key,
  mentor text not null check (mentor in ('eliz','woods')),
  posted_at timestamptz, received_at timestamptz not null default now(),
  kind text not null default 'update', title text, raw_text text not null, source text,
  submitted_by text not null default 'claude', processed_at timestamptz, digest jsonb
);
alter table public.mentor_posts enable row level security;

create table if not exists public.mentor_principles (
  principle_id text primary key, mentor text not null check (mentor in ('eliz','woods')),
  category text not null, statement text not null, quote text, how_moonbag_applies text,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  times_seen integer not null default 1, post_ids bigint[] not null default '{}',
  status text not null default 'active' check (status in ('active','superseded','retired')), superseded_by text
);
alter table public.mentor_principles enable row level security;

create table if not exists public.mentor_calls (
  call_id bigserial primary key, mentor text not null check (mentor in ('eliz','woods')),
  post_id bigint references public.mentor_posts(post_id), made_at timestamptz not null, asset text not null default 'BTC',
  call text not null, condition jsonb, horizon_days integer not null default 30,
  status text not null default 'open' check (status in ('open','right','wrong','void')), graded_at timestamptz, grade_note text
);
alter table public.mentor_calls enable row level security;

create table if not exists public.mentor_questions (
  q_id bigserial primary key, mentor text not null check (mentor in ('eliz','woods')), question text not null, why text,
  priority integer not null default 2, status text not null default 'open' check (status in ('open','asked','answered','dropped')),
  answer_post_id bigint references public.mentor_posts(post_id), created_at timestamptz not null default now()
);
alter table public.mentor_questions enable row level security;

create or replace view public.v_mentor_record with (security_invoker = true) as
select mentor, count(*) filter (where status in ('right','wrong')) graded,
       count(*) filter (where status = 'right') right_n,
       round(100.0 * count(*) filter (where status = 'right') / nullif(count(*) filter (where status in ('right','wrong')), 0), 1) hit_pct,
       count(*) filter (where status = 'open') open_n, max(made_at) last_call,
       (select max(coalesce(p.posted_at, p.received_at)) from public.mentor_posts p where p.mentor = c.mentor) last_post
from public.mentor_calls c group by mentor;

-- Daily Coinbase spot candles (the Vercel cron for /api/moonbag/candles/sync was never scheduled — vercel.json is empty).
create or replace function public.daily_spot_sync()
returns jsonb language plpgsql security definer set search_path = public, extensions as $f$
declare v_a text; resp record; r jsonb; n integer := 0; errs jsonb := '[]'::jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  for v_a in select x from unnest(array['BTC','ETH','SOL']) x loop
    begin
      select * into resp from extensions.http_get(format('https://api.exchange.coinbase.com/products/%s-USD/candles?granularity=86400', v_a));
      if resp.status <> 200 then raise exception 'http %', resp.status; end if;
      for r in select * from jsonb_array_elements(resp.content::jsonb) loop
        continue when to_timestamp((r->>0)::bigint) >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
        insert into public.candles (asset, tf, ts, o, h, l, c, v)
        values (v_a, '1d', to_timestamp((r->>0)::bigint), (r->>3)::numeric, (r->>2)::numeric, (r->>1)::numeric, (r->>4)::numeric, (r->>5)::numeric)
        on conflict (asset, tf, ts) do nothing;
        n := n + 1;
      end loop;
      insert into public.data_feed (feed, asset, tf, last_bar, fetched_at, ok) values ('coinbase', v_a, '1d', (select max(ts) from candles where asset = v_a and tf = '1d'), now(), true)
      on conflict (feed, asset, tf) do update set last_bar = excluded.last_bar, fetched_at = excluded.fetched_at, ok = true, error = null;
    exception when others then
      errs := errs || jsonb_build_object('asset', v_a, 'error', sqlerrm);
      insert into public.data_feed (feed, asset, tf, fetched_at, ok, error) values ('coinbase', v_a, '1d', now(), false, sqlerrm)
      on conflict (feed, asset, tf) do update set fetched_at = excluded.fetched_at, ok = false, error = excluded.error;
    end;
  end loop;
  return jsonb_build_object('rows', n, 'errors', errs);
end $f$;
-- mentor_grade_calls(): see the function body applied live (migration 'mentor_grader_v2'); copied below.
create or replace function public.mentor_grade_calls()
returns jsonb language plpgsql security definer set search_path = public as $f$
declare mc record; cond jsonb; t0 timestamptz; t1 timestamptz; v_low numeric; v_high numeric; v_level numeric; v_target numeric; v_fail numeric; v_tf text;
  visit timestamptz; wk_break timestamptz; reclaim_ts timestamptz; ok_ts timestamptz; fail_ts timestamptz; out jsonb := '[]'::jsonb; st text; note text;
begin
  for mc in select * from mentor_calls where status = 'open' loop
    cond := mc.condition; t0 := mc.made_at; t1 := mc.made_at + make_interval(days => mc.horizon_days);
    st := null; note := null; v_tf := coalesce(cond->>'tf', '1d');
    if cond->>'type' = 'zone_hold' then
      v_low := (cond->>'low')::numeric; v_high := (cond->>'high')::numeric;
      select min(cd.ts) into visit from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= t0 and cd.ts < t1 and cd.l <= v_high;
      select min(cd.ts) into wk_break from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= t0 and cd.ts < t1 and extract(dow from cd.ts) = 0 and cd.c < v_low;
      if wk_break is not null then st := 'wrong'; note := format('weekly close below %s on %s', v_low, wk_break::date);
      elsif visit is not null then
        select min(cd.ts) into ok_ts from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts > visit and cd.ts < t1 and cd.c > v_high;
        if ok_ts is not null then st := 'right'; note := format('visited %s–%s on %s and closed back above %s on %s', v_low, v_high, visit::date, v_high, ok_ts::date); end if;
      elsif now() > t1 then st := 'void'; note := 'price never visited the zone within the horizon';
      end if;
    elsif cond->>'type' = 'reclaim' then
      v_level := (cond->>'level')::numeric; v_target := (cond->>'target')::numeric; v_fail := coalesce((cond->>'fail')::numeric, v_level);
      select min(cd.ts) into reclaim_ts from candles cd where cd.asset = mc.asset and cd.tf = v_tf and cd.ts >= t0 and cd.ts < t1 and (v_tf = '4h' or extract(dow from cd.ts) = 0) and cd.c > v_level;
      if reclaim_ts is not null then
        select min(cd.ts) into ok_ts from candles cd where cd.asset = mc.asset and cd.tf = v_tf and cd.ts > reclaim_ts and cd.ts < t1 and cd.h >= v_target;
        select min(cd.ts) into fail_ts from candles cd where cd.asset = mc.asset and cd.tf = v_tf and cd.ts > reclaim_ts and cd.ts < t1 and (v_tf = '4h' or extract(dow from cd.ts) = 0) and cd.c < v_fail;
        if ok_ts is not null and (fail_ts is null or ok_ts < fail_ts) then st := 'right'; note := format('closed above %s on %s, reached %s on %s', v_level, reclaim_ts, v_target, ok_ts);
        elsif fail_ts is not null then st := 'wrong'; note := format('closed above %s on %s but closed back below %s on %s', v_level, reclaim_ts, v_fail, fail_ts);
        elsif now() > t1 then st := 'wrong'; note := format('reclaimed %s but never reached %s', v_level, v_target); end if;
      elsif now() > t1 then st := 'void'; note := format('no close above %s within the horizon', v_level);
      end if;
    elsif cond->>'type' = 'reject' then
      v_low := (cond->>'low')::numeric; v_high := coalesce((cond->>'high')::numeric, v_low);
      select min(cd.ts) into visit from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= t0 and cd.ts < t1 and cd.h >= v_low;
      if visit is not null then
        select min(cd.ts) into ok_ts from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= visit and cd.ts < t1 and cd.l <= v_low * (1 - (cond->>'pct')::numeric / 100);
        select min(cd.ts) into fail_ts from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= visit and cd.ts < t1 and extract(dow from cd.ts) = 0 and cd.c > v_high;
        if ok_ts is not null and (fail_ts is null or ok_ts < fail_ts) then st := 'right'; note := format('tagged %s on %s and fell %s%% by %s', v_low, visit::date, cond->>'pct', ok_ts::date);
        elsif fail_ts is not null then st := 'wrong'; note := format('weekly close above %s on %s — accepted, not rejected', v_high, fail_ts::date); end if;
      elsif now() > t1 then st := 'void'; note := 'never reached the zone';
      end if;
    elsif cond->>'type' = 'hold_level' then
      v_level := (cond->>'level')::numeric;
      select min(cd.ts) into fail_ts from candles cd where cd.asset = mc.asset and cd.tf = coalesce(cond->>'tf', '4h') and cd.ts >= t0 and cd.ts < t1 and cd.c < v_level;
      if fail_ts is not null then st := 'wrong'; note := format('%s close below %s on %s', coalesce(cond->>'tf', '4h'), v_level, fail_ts);
      elsif now() > t1 then st := 'right'; note := format('held %s for %s days', v_level, mc.horizon_days); end if;
    elsif cond->>'type' = 'reach' then
      v_level := (cond->>'level')::numeric;
      select min(cd.ts) into ok_ts from candles cd where cd.asset = mc.asset and cd.tf = '1d' and cd.ts >= t0 and cd.ts < t1
        and ((coalesce(cond->>'dir', 'up') = 'up' and cd.h >= v_level) or (cond->>'dir' = 'down' and cd.l <= v_level));
      if ok_ts is not null then st := 'right'; note := format('reached %s on %s', v_level, ok_ts::date);
      elsif now() > t1 then st := 'wrong'; note := format('did not reach %s within %s days', v_level, mc.horizon_days); end if;
    end if;
    if st is not null then
      update mentor_calls set status = st, graded_at = now(), grade_note = note where call_id = mc.call_id;
      out := out || jsonb_build_object('call_id', mc.call_id, 'mentor', mc.mentor, 'status', st, 'note', note);
    end if;
  end loop;
  return out;
end $f$;

select cron.schedule('moonbag-daily-spot', '7 0 * * *', $$select public.daily_spot_sync()$$);
select cron.schedule('moonbag-mentor-grade', '17 0 * * *', $$select public.mentor_grade_calls()$$);

-- woods_scan(): Eliz macro layer (patched live in place, same edits as below):
--  * woods_levels pools carry src 'eliz' for source = 'eliz' (level points 22; Woods' own 25);
--  * anchor.macro = BTC vs her zones: invalidated | buy_zone | lower | mid | upper | range_top | above_range | macro_resistance | expansion, with a plain sentence;
--  * new component 'macro' (0–10): longs score in her buy zone / lower range, shorts at her range top / macro resistance;
--  * confidence = round(sum of components × 100 / 110).
