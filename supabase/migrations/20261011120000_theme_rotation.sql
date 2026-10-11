-- 2026-10-11: theme roadmap + ETF reference + weekly sector rotation scoreboard (strategy §4.7). Applied live.
create table if not exists public.theme_map (id bigserial primary key, phase int not null, years text, phase_name text, sector text not null, tickers text[] not null, proxy_etf text, source text default 'Stavros 2026-10-11 roadmap graphic', created_at timestamptz default now(), unique (phase, sector));
create table if not exists public.etf_watch (symbol text primary key, name text, invests_in text, cagr_5y_stated numeric, source text, phase int, as_of_stated date default '2026-10-02', created_at timestamptz default now());
create table if not exists public.sector_rotation (id bigserial primary key, as_of date not null, symbol text not null, phase int, ret_1m numeric, ret_3m numeric, ret_6m numeric, rs_3m_vs_spy numeric, above_200d boolean, rank int, note text, created_at timestamptz default now(), unique (as_of, symbol));
alter table public.theme_map enable row level security; alter table public.etf_watch enable row level security; alter table public.sector_rotation enable row level security;
-- Seed data: research/etf_rotation/theme_map.sql (52 sectors), research/etf_rotation/etf.sql (45 ETFs); first sector_rotation snapshot 2026-10-09.
-- Also applied 2026-10-11: risk_config blofin/coinbase risk_per_trade_pct 2, daily_loss_stop_pct 4; daily drawdown checks added to
-- moonbag_lev_signal_check() and moonbag_check_handoff_coinbase().
