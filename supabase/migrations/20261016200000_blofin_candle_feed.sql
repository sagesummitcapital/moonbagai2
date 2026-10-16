-- Stavros 2026-10-16: "make sure i always know the time of this data, if i use bad data its a bad trade".
-- Moonbag's own market-data feed: CLOSED BloFin perp candles (15m, 1h, 4h — the exchange he trades) for every lev_universe
-- coin, straight into the database every 5 minutes by pg_cron. No dependence on TradingView (which rate-limits the agents:
-- 5 blind Desk Lead runs on 10-16). The website, the Woods machine and the agents read these bars and their timestamps.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.data_feed (
  feed text not null, asset text not null, tf text not null,
  last_bar timestamptz, fetched_at timestamptz not null default now(), ok boolean not null, error text,
  primary key (feed, asset, tf)
);
alter table public.data_feed enable row level security;

create or replace function public.lev_candle_sync(p_assets text[] default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $f$
declare
  v_a text; v_tf text; v_bar text; resp record; body jsonb; r jsonb; n integer; total integer := 0; v_last timestamptz; errs jsonb := '[]'::jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  for v_a in select x from unnest(coalesce(p_assets,
      (select array_agg(distinct u.asset) from (select lu.asset from public.lev_universe lu union select unnest(array['BTC','ETH','SOL'])) u))) x
  loop
    foreach v_tf in array array['15m','1h','4h'] loop
      v_bar := case v_tf when '15m' then '15m' when '1h' then '1H' else '4H' end;
      begin
        select * into resp from extensions.http_get(format('https://openapi.blofin.com/api/v1/market/candles?instId=%s-USDT&bar=%s&limit=100', v_a, v_bar));
        if resp.status <> 200 then raise exception 'http %', resp.status; end if;
        body := resp.content::jsonb;
        if body->>'code' <> '0' then raise exception 'blofin %', body->>'msg'; end if;
        n := 0; v_last := null;
        for r in select * from jsonb_array_elements(body->'data') loop
          continue when r->>8 <> '1';
          insert into public.candles as cd (asset, tf, ts, o, h, l, c, v)
          values (v_a, v_tf, to_timestamp((r->>0)::bigint / 1000.0), (r->>1)::numeric, (r->>2)::numeric, (r->>3)::numeric, (r->>4)::numeric, (r->>6)::numeric)
          on conflict (asset, tf, ts) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c, v = excluded.v;
          n := n + 1;
          v_last := greatest(v_last, to_timestamp((r->>0)::bigint / 1000.0));
        end loop;
        total := total + n;
        insert into public.data_feed as df (feed, asset, tf, last_bar, fetched_at, ok, error) values ('blofin', v_a, v_tf, v_last, now(), true, null)
        on conflict (feed, asset, tf) do update set last_bar = excluded.last_bar, fetched_at = excluded.fetched_at, ok = true, error = null;
      exception when others then
        errs := errs || jsonb_build_object('asset', v_a, 'tf', v_tf, 'error', sqlerrm);
        insert into public.data_feed as df (feed, asset, tf, fetched_at, ok, error) values ('blofin', v_a, v_tf, now(), false, sqlerrm)
        on conflict (feed, asset, tf) do update set fetched_at = excluded.fetched_at, ok = false, error = excluded.error;
      end;
    end loop;
  end loop;
  return jsonb_build_object('bars', total, 'errors', errs, 'at', now());
end $f$;

create or replace view public.v_data_freshness with (security_invoker = true) as
select f.asset, f.tf, f.last_bar, f.fetched_at, f.ok, f.error,
       extract(epoch from (now() - f.last_bar)) / 60 as bar_age_min,
       (f.ok and f.last_bar > now() - (case f.tf when '15m' then interval '25 minutes' when '1h' then interval '70 minutes' else interval '250 minutes' end) - interval '10 minutes') as fresh
from public.data_feed f where f.feed = 'blofin';

select cron.schedule('moonbag-blofin-candles', '*/5 * * * *', $$select public.lev_candle_sync()$$);
