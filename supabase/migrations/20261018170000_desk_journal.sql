-- DESK JOURNAL (Stavros, 2026-10-18: "I need you and grok to lock in and work together to improve our execution and communication ...
-- like my daily journal, but instead all three of us contribute and work off it. I like to send potential trades to get inputs back,
-- but then I also want to bounce off what moonbag is looking at and see where we are off, i may like moonbag limits or trade better").
-- Choices (2026-10-18): he writes through Grok; Moonbag answers instantly side by side; weekly scorecard of whose version was better.
-- One thread per trade idea: idea (his numbers) → grok_view → moonbag_view (instant) → decision → outcome; notes/lessons from anyone.

create table if not exists public.desk_journal (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  thread_id   bigint references public.desk_journal(id),
  author      text not null check (author in ('stavros','grok','moonbag','claude')),
  recorded_by text,
  kind        text not null check (kind in ('idea','grok_view','moonbag_view','decision','note','lesson','outcome')),
  coin        text,
  side        text check (side is null or side in ('long','short')),
  entry       numeric,
  stop        numeric,
  tp1         numeric,
  tp2         numeric,
  rr1         numeric,
  at_market   boolean default false,
  price_at    numeric,
  body        text,
  refs        jsonb,
  trade_id    text,
  scored_at   timestamptz,
  score       jsonb
);
create index if not exists desk_journal_thread on public.desk_journal (thread_id);
create index if not exists desk_journal_created on public.desk_journal (created_at desc);
alter table public.desk_journal enable row level security;

-- Grade one version of a trade (entry/stop/tp1) on 15m candles over 72h. Same-bar stop+TP counts as the stop (conservative).
create or replace function public.desk_journal_grade_one(p_coin text, p_side text, p_entry numeric, p_stop numeric, p_tp1 numeric,
  p_from timestamptz, p_market boolean default false, p_hours int default 72)
returns jsonb language plpgsql stable as $$
declare
  sg int := case when p_side = 'long' then 1 else -1 end;
  risk numeric := abs(p_entry - p_stop);
  filled_at timestamptz := case when p_market then p_from end;
  b record; last_c numeric; mfe numeric := 0; mae numeric := 0;
begin
  if p_entry is null or p_stop is null or p_tp1 is null or risk = 0 then return jsonb_build_object('result','incomplete'); end if;
  for b in select ts, h, l, c from public.candles where asset = upper(p_coin) and tf = '15m' and ts >= p_from - interval '15 minutes'
           and ts < p_from + make_interval(hours => p_hours) order by ts loop
    last_c := b.c;
    if filled_at is null then
      if b.l <= p_entry and b.h >= p_entry then filled_at := b.ts; else continue; end if;
    end if;
    mfe := greatest(mfe, sg * ((case when sg = 1 then b.h else b.l end) - p_entry) / risk);
    mae := least(mae, sg * ((case when sg = 1 then b.l else b.h end) - p_entry) / risk);
    if (sg = 1 and b.l <= p_stop) or (sg = -1 and b.h >= p_stop) then
      return jsonb_build_object('result','stop','r',-1,'filled_at',filled_at,'closed_at',b.ts,'mfe_r',round(mfe,2));
    end if;
    if (sg = 1 and b.h >= p_tp1) or (sg = -1 and b.l <= p_tp1) then
      return jsonb_build_object('result','tp1','r',round(abs(p_tp1 - p_entry)/risk,2),'filled_at',filled_at,'closed_at',b.ts,'mae_r',round(mae,2));
    end if;
  end loop;
  if last_c is null then return jsonb_build_object('result','no_data'); end if;
  if filled_at is null then return jsonb_build_object('result','no_fill','r',0); end if;
  return jsonb_build_object('result','open_72h','r',round(sg*(last_c - p_entry)/risk,2),'filled_at',filled_at,'mfe_r',round(mfe,2),'mae_r',round(mae,2));
end $$;

-- Score every idea thread ≥ 72h old: his version, Grok's, Moonbag's live card and Moonbag's resting limit. Returns the scorecard rows.
create or replace function public.desk_journal_score(p_hours int default 72)
returns table (thread_id bigint, coin text, side text, version text, result text, r numeric)
language plpgsql as $$
declare t record; v record; s jsonb; sc jsonb;
begin
  for t in select * from public.desk_journal where kind = 'idea' and scored_at is null and created_at < now() - make_interval(hours => p_hours) loop
    sc := '{}'::jsonb;
    for v in
      select 'stavros' as ver, t.entry e, t.stop s0, t.tp1 t1, coalesce(t.at_market,false) mk, t.created_at at
      union all select 'grok', g.entry, g.stop, g.tp1, coalesce(g.at_market,false), g.created_at from public.desk_journal g where g.thread_id = t.id and g.kind = 'grok_view'
      union all select 'moonbag_live', (m.refs->'live'->>'entry')::numeric, (m.refs->'live'->>'stop')::numeric, (m.refs->'live'->>'tp1')::numeric, true, m.created_at
        from public.desk_journal m where m.thread_id = t.id and m.kind = 'moonbag_view' and m.refs ? 'live'
      union all select 'moonbag_limit', (m.refs->'limit'->>'entry')::numeric, (m.refs->'limit'->>'stop')::numeric, (m.refs->'limit'->>'tp1')::numeric, false, m.created_at
        from public.desk_journal m where m.thread_id = t.id and m.kind = 'moonbag_view' and jsonb_typeof(m.refs->'limit') = 'object'
    loop
      continue when v.e is null;
      s := public.desk_journal_grade_one(t.coin, t.side, v.e, v.s0, v.t1, v.at, v.mk, p_hours);
      sc := sc || jsonb_build_object(v.ver, s);
    end loop;
    update public.desk_journal set scored_at = now(), score = sc where id = t.id;
  end loop;
  return query
    select d.id, d.coin, d.side, k.key, k.value->>'result', (k.value->>'r')::numeric
    from public.desk_journal d, jsonb_each(d.score) k
    where d.kind = 'idea' and d.scored_at > now() - interval '8 days' order by d.id, k.key;
end $$;
