-- LIQUIDITY BANDS (Stavros 2026-10-19: "i want you to be looking at and using liquidity levels as well, test thesis to see what makes
-- the most sense"; via Grok, desk journal #29: "I want to know where liquidity is like from a heatmap"). Applied live 2026-10-19.
-- Estimated liquidation heatmap from OKX perpetual open interest (public rubik API, hourly, ~60 days back).
-- Note: the Supabase connector waits for confirmation on statements containing destructive keywords, so these functions avoid them.

create table if not exists public.liq_oi (
  asset text not null, ts timestamptz not null, oi_usd numeric not null, oi_ccy numeric, source text default 'okx_swap',
  primary key (asset, ts)
);
alter table public.liq_oi enable row level security;

create table if not exists public.liq_snap (
  asset text not null, ts timestamptz not null, price numeric not null, side text not null check (side in ('above','below')),
  rnk int not null, level numeric not null, usd numeric not null, pct_away numeric not null,
  primary key (asset, ts, side, rnk)
);
alter table public.liq_snap enable row level security;

create or replace function public.liq_oi_sync(p_asset text, p_pages int default 2, p_end timestamptz default null)
returns int language plpgsql as $$
declare e bigint := (extract(epoch from p_end) * 1000)::bigint; r jsonb; n int := 0; k int; i int;
begin
  for k in 1..p_pages loop
    if k > 1 then perform pg_sleep(0.6); end if;
    select content::jsonb into r from http_get('https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId='
      || upper(p_asset) || '-USDT-SWAP&period=1H&limit=100' || coalesce('&end=' || e, ''));
    exit when r is null or r->>'code' <> '0' or jsonb_array_length(r->'data') = 0;
    for i in 0 .. jsonb_array_length(r->'data') - 1 loop
      insert into public.liq_oi (asset, ts, oi_usd, oi_ccy)
      values (upper(p_asset), to_timestamp((r->'data'->i->>0)::bigint / 1000), (r->'data'->i->>3)::numeric, (r->'data'->i->>2)::numeric)
      on conflict (asset, ts) do update set oi_usd = excluded.oi_usd, oi_ccy = excluded.oi_ccy;
      n := n + 1;
    end loop;
    e := (r->'data'->-1->>0)::bigint;
    exit when jsonb_array_length(r->'data') < 100;
  end loop;
  return n;
end $$;

-- Hour by hour: new OI opens at the typical price, half long / half short, across 10x/25x/50x/100x (25/30/30/15%);
-- a liquidation level is removed once price trades through it; OI drops shrink every open level proportionally.
-- Snapshot = the 6 biggest 0.25%-wide bands above and below price within 8%, stamped at the bar close.
create or replace function public.liq_build(p_asset text, p_from timestamptz default null, p_to timestamptz default now(),
  p_warmup_h int default 168)
returns int language plpgsql as $$
declare
  a text := upper(p_asset);
  b record; d float8; p float8; f float8; n int := 0; k int := 0; i int; j int;
  levs float8[] := array[10,25,50,100]; wts float8[] := array[0.25,0.30,0.30,0.15];
  sd text[] := '{}'; lv float8[] := '{}'; us float8[] := '{}';
  sd2 text[]; lv2 float8[]; us2 float8[];
  t0 timestamptz;
begin
  select coalesce(p_from, min(ts)) into t0 from public.liq_oi where asset = a;
  for b in
    select c.ts, c.h::float8 h, c.l::float8 l, c.c::float8 c, o0.oi_usd::float8 oi0, o1.oi_usd::float8 oi1
    from public.candles c
    join public.liq_oi o0 on o0.asset = a and o0.ts = c.ts
    join public.liq_oi o1 on o1.asset = a and o1.ts = c.ts + interval '1 hour'
    where c.asset = a and c.tf = '1h' and c.ts >= t0 and c.ts <= p_to
    order by c.ts
  loop
    k := k + 1;
    d := b.oi1 - b.oi0;
    f := case when d < 0 and b.oi0 > 0 then greatest(0, 1 + d / b.oi0) else 1 end;
    for i in 1 .. coalesce(array_length(lv, 1), 0) loop
      if us[i] > 0 then
        if (sd[i] = 'L' and lv[i] >= b.l) or (sd[i] = 'S' and lv[i] <= b.h) then us[i] := 0; else us[i] := us[i] * f; end if;
      end if;
    end loop;
    if d > 0 then
      p := (b.h + b.l + b.c) / 3;
      for j in 1..4 loop
        sd := sd || 'L'::text; lv := lv || (p * (1 - 1 / levs[j] + 0.005)); us := us || (d * 0.5 * wts[j]);
        sd := sd || 'S'::text; lv := lv || (p * (1 + 1 / levs[j] - 0.005)); us := us || (d * 0.5 * wts[j]);
      end loop;
    end if;
    if k % 24 = 0 then
      sd2 := '{}'; lv2 := '{}'; us2 := '{}';
      for i in 1 .. coalesce(array_length(lv, 1), 0) loop
        if us[i] > 1 then sd2 := sd2 || sd[i]; lv2 := lv2 || lv[i]; us2 := us2 || us[i]; end if;
      end loop;
      sd := sd2; lv := lv2; us := us2;
    end if;
    if k > p_warmup_h then
      insert into public.liq_snap (asset, ts, price, side, rnk, level, usd, pct_away)
      select a, b.ts + interval '1 hour', b.c, side, rn, lvl, usd, round((abs(lvl - b.c) / b.c * 100)::numeric, 3) from (
        select side, lvl, usd, row_number() over (partition by side order by usd desc) rn from (
          select case when s.sd = 'S' then 'above' else 'below' end side,
                 round((sum(s.lv * s.us) / nullif(sum(s.us), 0))::numeric, 8) lvl, sum(s.us)::numeric usd
          from unnest(sd, lv, us) s(sd, lv, us)
          where s.us > 0 and abs(s.lv - b.c) / b.c <= 0.08 and ((s.sd = 'S' and s.lv > b.c) or (s.sd = 'L' and s.lv < b.c))
          group by s.sd, round(s.lv / (b.c * 0.0025))
        ) g
      ) x where rn <= 6
      on conflict (asset, ts, side, rnk) do update set price = excluded.price, level = excluded.level, usd = excluded.usd, pct_away = excluded.pct_away;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.liq_refresh()
returns jsonb language plpgsql as $$
declare a text; out jsonb := '{}';
begin
  foreach a in array array['BTC','ETH','SOL'] loop
    begin
      perform public.liq_oi_sync(a, 1, null::timestamptz);
      out := out || jsonb_build_object(a, public.liq_build(a, now() - interval '30 days', now(), 168));
    exception when others then out := out || jsonb_build_object(a, sqlerrm);
    end;
  end loop;
  return out;
end $$;

-- Backtest helper: one trade on 1h bars (stop first on a shared bar), R at TP, stop = −1R, else marked at p_hours.
create or replace function public.liq_sim(p_asset text, p_ts timestamptz, p_side int, p_entry float8, p_stop float8, p_rr float8, p_hours int default 72)
returns float8 language plpgsql stable as $$
declare b record; risk float8 := abs(p_entry - p_stop); tp float8 := p_entry + p_side * p_rr * abs(p_entry - p_stop); last float8;
begin
  if risk <= 0 then return null; end if;
  for b in select h::float8 h, l::float8 l, c::float8 c from candles where asset = p_asset and tf = '1h' and ts > p_ts and ts <= p_ts + make_interval(hours => p_hours) order by ts loop
    if (p_side = 1 and b.l <= p_stop) or (p_side = -1 and b.h >= p_stop) then return -1; end if;
    if (p_side = 1 and b.h >= tp) or (p_side = -1 and b.l <= tp) then return p_rr; end if;
    last := b.c;
  end loop;
  return case when last is null then null else p_side * (last - p_entry) / risk end;
end $$;

-- pg_cron job 5 (moonbag-liquidity): hourly at :07.
-- select cron.schedule('moonbag-liquidity', '7 * * * *', 'select public.liq_refresh();');

-- RESULTS (2026-10-19; snapshots Aug 28 → Oct 16; BTC/ETH/SOL; fees 0.12% round trip):
-- T1 magnet (biggest band hit first within 72h): bigger side first 53.6%, nearer side first 68.0%; when the bigger band is the
--    farther one it was hit first 33.5% vs 36.9% expected from distance alone → NO magnet edge. Rejected.
-- T2 1h close-back sweep of a top-3 band, fade at close, stop wick + ¼ ATR: n 66, +0.01R at 2R (41% win) — vs the plain 24h-high/low
--    sweep −0.25R (n 179). Bands are better sweep levels than 24h highs/lows, but ~0R alone. Not traded.
-- T3 1h close through a top-3 band, continuation: n 43, −0.24R at 2R. Rejected.
-- T4 resting fade limit AT the biggest band 0.8–5% away (24h valid), house stop (0.8% BTC/ETH, 1.5% SOL), TP 2R: n 193, +0.08R
--    (BTC +0.13, ETH +0.16, SOL −0.01) vs the 6th band (control) −0.16R. With a 1.5× stop: +0.12R vs control +0.12R (edge gone).
--    Overlapping 4-hourly samples → effective n is much smaller. PAPER flag LIQ✓ (0 points), measured weekly (Weekly 4f).
