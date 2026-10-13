# Scalp / 15m-entry research (2026-10-13)

Stavros: smaller timeframes, scalps, higher leverage OK; 1h/4h bias with 15m entries; Monday high/low range.

- Data: BINANCE perps BTC/ETH/SOL 15m, 2026-08-01 → 2026-10-13 (TradingView's 15m limit; data/ not committed).
- `scalp.py` engine (setups tpb / swp / orb, market or limit-retest entry, fees on), `grid.py` runs variants (s1.json → s1.csv).
- Result: every 15m variant is negative after fees. Best raw edge: sweep-and-reclaim +0.07R before fees, −0.07 to −0.22R after.
- Monday range (tested in research/limits with src monday / all_mon): negative alone, no gain when added.
- Adopted instead (research/limits m2/m3): limit levels from 0.15 daily ATR; quick mode (2R cap, break-even at +1R).
- Re-test monthly as 15m history grows; `lev_playbook.scalp_15m` is 'retired' until net positive on both halves.
