-- =============================================================================
-- Moonbag — leverage desk risk tiers (Stavros, 2026-10-04):
--   risk more while the account is small, step down as it grows.
--   under $1,000: 10% · under $10,000: 5% · above: 2%.  Grade 5 = full, grade 4 = half.
--   Margin cap = half the account (was a fixed $50). Max leverage stays 20x.
-- Safe to run more than once.
-- =============================================================================
alter table public.risk_config add column if not exists risk_tiers jsonb;
alter table public.risk_config add column if not exists max_margin_pct numeric;

update public.risk_config set risk_per_trade_pct = 10, max_open_risk_pct = 10,
  risk_tiers = '[{"below":1000,"risk_pct":10},{"below":10000,"risk_pct":5},{"risk_pct":2}]'::jsonb,
  max_margin_pct = 50, max_margin_dollars = 120
 where venue = 'blofin';

create or replace function public.moonbag_lev_signal_check()
returns trigger language plpgsql as $$
declare
  cfg public.risk_config;
  dist numeric; risk_cap numeric; margin_cap numeric; tier jsonb;
  f text;
  frozen text[] := array['asset','direction','setup_id','entry','stop','tp1','tp2','tp3','quantity',
    'notional','leverage','margin','risk_dollars','risk_percent','confidence_score','confidence_components',
    'trigger_condition','trigger_price','account_equity','strategy_version'];
  once text[] := array['outcome','outcome_r','mfe_r','mae_r','resolved_at','armed_at','triggered_at','trade_id'];
  o jsonb; n jsonb;
begin
  new.asset := upper(new.asset);
  if tg_op = 'INSERT' then
    if new.signal_id is null then
      new.signal_id := public.moonbag_next_id('MBS', public.moonbag_today(), new.asset);
    end if;
    new.created_at := now();
  else
    o := to_jsonb(old); n := to_jsonb(new);
    if new.signal_id <> old.signal_id or new.created_at <> old.created_at then
      raise exception 'Signal identity is immutable.';
    end if;
    -- anti-hindsight: once a signal has left "watching", its plan and confidence are frozen
    if old.status <> 'watching' then
      foreach f in array frozen loop
        if (n -> f) is distinct from (o -> f) then
          raise exception 'Signal %: "%" is frozen once the signal is armed. Create a new signal instead.', old.signal_id, f;
        end if;
      end loop;
    end if;
    foreach f in array once loop
      if (o -> f) is not null and (o -> f) <> 'null'::jsonb and (n -> f) is distinct from (o -> f) then
        raise exception 'Signal %: "%" was already recorded and cannot be changed.', old.signal_id, f;
      end if;
    end loop;
    if old.status in ('skipped','expired','invalidated') and new.status is distinct from old.status then
      raise exception 'Signal % is already % (final).', old.signal_id, old.status;
    end if;
    new.updated_at := now();
  end if;

  -- geometry
  if new.direction = 'long' and not (new.stop < new.entry and new.tp1 > new.entry) then
    raise exception 'Long signal needs stop < entry < tp1.';
  end if;
  if new.direction = 'short' and not (new.stop > new.entry and new.tp1 < new.entry) then
    raise exception 'Short signal needs tp1 < entry < stop.';
  end if;
  dist := abs(new.entry - new.stop);
  new.rr_tp1 := round(abs(new.tp1 - new.entry) / dist, 2);

  -- BloFin risk box (only enforced once the signal is actionable)
  if new.status in ('armed','triggered','taken') then
    select * into cfg from public.risk_config where venue = 'blofin';
    if new.quantity is null or new.leverage is null or new.margin is null or new.account_equity is null then
      raise exception 'RISK: an armed signal needs account_equity, quantity, leverage and margin.';
    end if;
    new.risk_dollars := round(dist * new.quantity, 2);
    new.notional := round(new.entry * new.quantity, 2);
    new.risk_percent := round(100 * new.risk_dollars / new.account_equity, 2);
    -- Risk cap steps down as the account grows (risk_tiers), margin cap is a share of the account.
    risk_cap := cfg.risk_per_trade_pct;
    if cfg.risk_tiers is not null then
      for tier in select * from jsonb_array_elements(cfg.risk_tiers) loop
        if tier->>'below' is null or new.account_equity < (tier->>'below')::numeric then
          risk_cap := (tier->>'risk_pct')::numeric; exit;
        end if;
      end loop;
    end if;
    margin_cap := coalesce(new.account_equity * cfg.max_margin_pct / 100, cfg.max_margin_dollars);
    if new.risk_percent > risk_cap * 1.02 then
      raise exception 'RISK: signal risks % pct of the BloFin account (max % at this account size).', new.risk_percent, risk_cap;
    end if;
    if new.leverage > cfg.max_leverage then
      raise exception 'RISK: leverage %x is above the %x cap. NO TRADE.', new.leverage, cfg.max_leverage;
    end if;
    if new.margin > margin_cap * 1.02 then
      raise exception 'RISK: margin $% is above the $% cap.', new.margin, round(margin_cap, 2);
    end if;
    if new.rr_tp1 < 1.5 then
      raise exception 'RISK: reward to TP1 is only %R (minimum 1.5R).', new.rr_tp1;
    end if;
    if dist / new.entry >= (1 / new.leverage) * 0.8 then
      raise exception 'RISK: stop is too close to estimated liquidation at %x.', new.leverage;
    end if;
    if new.armed_at is null then new.armed_at := now(); end if;
  end if;
  if new.status = 'triggered' and new.triggered_at is null then new.triggered_at := now(); end if;
  if new.status = 'taken' and new.trade_id is null then
    raise exception 'A "taken" signal must link the trade_id.';
  end if;
  if new.outcome is not null and new.resolved_at is null then new.resolved_at := now(); end if;
  return new;
end $$;

-- Trades can now be logged with up to 10% risk (was a hard 5% ceiling).
alter table public.trades drop constraint if exists trades_risk_percent_check;
alter table public.trades add constraint trades_risk_percent_check check (risk_percent is null or risk_percent <= 10.5);
