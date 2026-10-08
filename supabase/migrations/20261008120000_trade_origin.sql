-- Moonbag vs Stavros's own trades (2026-10-08).
-- Stavros will keep taking some trades from his own read of the levels. Every BloFin trade is tagged
-- so the desk can learn from both and keep score of which approach does better.
--   origin = 'moonbag' : the trade followed a Moonbag DESK ALERT (lev_signals.trade_id links it)
--   origin = 'own'     : Stavros's own call
-- moonbag_score = what the v2 confidence rubric gives the setup at entry. For own trades it is scored
-- after the fact by the lookback, so we can see whether the rubric is missing setups that work.

alter table public.trades add column if not exists origin text;
alter table public.trades add column if not exists moonbag_score numeric;
alter table public.trades add column if not exists origin_notes text;

alter table public.trades drop constraint if exists trades_origin_check,
  add constraint trades_origin_check check (origin is null or origin in ('moonbag', 'own'));
alter table public.trades drop constraint if exists trades_moonbag_score_check,
  add constraint trades_moonbag_score_check check (moonbag_score is null or (moonbag_score >= 0 and moonbag_score <= 100));

-- The three trades so far were all Stavros's own (no signal is linked to them).
update public.trades t set origin = 'own'
from (values ('MBT-2026-10-05-BTC-001'), ('MBT-2026-10-06-BTC-001'), ('MBT-2026-10-07-BTC-001')) v(id)
where t.trade_id = v.id and t.origin is null;

-- Scoreboard: Moonbag vs own, closed leverage trades.
create or replace view public.v_lev_origin_scoreboard as
select
  coalesce(t.origin, 'untagged') as origin,
  count(*) as trades,
  count(*) filter (where t.r_multiple > 0) as wins,
  round(100.0 * count(*) filter (where t.r_multiple > 0) / nullif(count(*), 0), 0) as win_rate_pct,
  round(avg(t.r_multiple), 2) as avg_r,
  round(sum(t.r_multiple), 2) as total_r,
  round(sum(t.r_multiple * t.risk_percent), 2) as account_pct,
  round(sum(t.realized_pnl), 2) as pnl,
  round(avg(t.moonbag_score), 0) as avg_moonbag_score,
  round(avg(t.r_multiple) filter (where t.moonbag_score >= 55), 2) as avg_r_score_55_plus,
  round(avg(t.r_multiple) filter (where t.moonbag_score < 55), 2) as avg_r_score_below_55
from public.trades t
where t.venue ilike 'blofin%' and t.status = 'closed'
group by 1;
