-- Moonbag: BTC, ETH and MASTER theses must always carry key levels.
-- support + resistance must be non-empty arrays, breakout + invalidation must be set.
-- (MASTER uses BTC's levels as its anchor.)
create or replace function public.moonbag_require_levels()
returns trigger language plpgsql as $$
begin
  if new.asset in ('BTC','ETH','MASTER') then
    if jsonb_typeof(new.levels->'support') is distinct from 'array'
       or jsonb_array_length(new.levels->'support') = 0
       or jsonb_typeof(new.levels->'resistance') is distinct from 'array'
       or jsonb_array_length(new.levels->'resistance') = 0
       or coalesce(jsonb_typeof(new.levels->'breakout'), 'null') = 'null'
       or coalesce(jsonb_typeof(new.levels->'invalidation'), 'null') = 'null' then
      raise exception '% thesis must include support, resistance, breakout and invalidation levels (never blank).', new.asset;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_thesis_require_levels on public.daily_thesis;
create trigger trg_thesis_require_levels before insert on public.daily_thesis
  for each row execute function public.moonbag_require_levels();
