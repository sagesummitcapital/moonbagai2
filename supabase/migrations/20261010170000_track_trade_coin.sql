-- Any BloFin trade puts its coin on the leverage desk's watch list (Stavros 2026-10-10: "when i open a trade -
-- like current on inj - make sure trading view updates accordingly with levels and alerts"). Coins outside the
-- Scout's rotation (e.g. INJ) were invisible to the Desk Lead, so they never got STOP / TP alerts. Applied live.
create or replace function public.moonbag_trade_track_coin() returns trigger language plpgsql as $$
begin
  if new.venue = 'blofin' and new.status in ('open','pending') then
    insert into public.lev_universe (asset, tier, tv_symbol, blofin_symbol, max_leverage, in_play, reason, updated_at)
    values (upper(new.symbol), 'bench', 'BINANCE:' || upper(new.symbol) || 'USDT.P', upper(new.symbol) || '-USDT', 10, true,
            'auto-added: open BloFin trade ' || new.trade_id, now())
    on conflict (asset) do update set in_play = true, updated_at = now();
  end if;
  return new;
end $$;
create trigger trg_trade_track_coin after insert or update of status on public.trades
  for each row execute function public.moonbag_trade_track_coin();
