-- Stavros 2026-10-16: "raise to 150x since that is what exchange allows". The liquidation safe cap (liq >= 1.25 x stop
-- distance, lib/moonbag/limits.ts) still limits each trade; dollar risk never changes with leverage.
alter table public.lev_universe drop constraint if exists lev_universe_max_leverage_check;
alter table public.lev_universe add constraint lev_universe_max_leverage_check check (max_leverage >= 1 and max_leverage <= 150);
update public.lev_universe set max_leverage = 150 where max_leverage < 150;
update public.risk_config set max_leverage = 150 where venue = 'blofin';
