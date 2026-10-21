-- FOCUS BRIEF refresh (Stavros 2026-10-21: "i want to be able to have grok refresh data so we have live prices"). Applied live 2026-10-21.
create or replace function public.focus_refresh(p_force boolean default false)
returns jsonb language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); age int; did boolean := false;
begin
  select extract(epoch from now() - max(as_of))::int / 60 into age from public.woods_machine;
  if p_force or age is null or age > 10 then
    perform public.lev_candle_sync(array['BTC','ETH','SOL']);
    perform public.woods_scan(true);
    did := true;
  end if;
  return jsonb_build_object('refreshed', did, 'woods_age_min_before', age, 'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $$;

-- Invalid-if follows the limit's current TP1 (desk journal #66, 2026-10-20). Applied live 2026-10-20.
alter table public.limit_orders add column if not exists invalid_if text, add column if not exists invalid_price numeric,
  add column if not exists invalid_btc numeric, add column if not exists invalid_by timestamptz, add column if not exists invalid_alert_ids text[],
  add column if not exists invalid_notified_at timestamptz,
  add column if not exists invalid_source text check (invalid_source is null or invalid_source in ('default','custom'));
create or replace function public.limit_invalid_follow_tp()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.invalid_price is not null and new.invalid_source is null then new.invalid_source := 'custom'; end if;
    return new;
  end if;
  if new.invalid_source is distinct from old.invalid_source then
    return new;
  elsif new.invalid_price is distinct from old.invalid_price then
    new.invalid_source := 'custom';
  elsif new.tp1 is distinct from old.tp1 and new.tp1 is not null and coalesce(new.invalid_source, 'default') = 'default' and new.invalid_alert_ids is not null then
    new.invalid_price := new.tp1;
  end if;
  return new;
end $$;
-- create trigger trg_limit_invalid_follow_tp before insert or update on public.limit_orders for each row execute function public.limit_invalid_follow_tp();
