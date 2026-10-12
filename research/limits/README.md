# Limit orders research (2026-10-12)

Question (Stavros): should leverage entries use resting limit orders, and how, to get better R:R?

- Data: Binance perps 1h bars (TradingView), 2026-01-01 → 2026-10-12, BTC ETH SOL NEAR TIA ENA SEI SUI (data/ is git-ignored; re-pull with get-ohlcv 1h).
- `limits.py`: the engine (levels, placement every 4h, limit fill, stop/target/break-even, fees). `grid.py`: parallel variant runs (g1–g5.json → .csv).
- Adopted (`{"entry":"deep","deep":0.5,"fresh":false,"be1":1.5,"dtrend":true}`): 278 trades, +0.132R/trade, PF 1.24, maxDD 22R,
  H1 +0.09 / H2 +0.17, core +0.14 / alts +0.13. Outcomes 24.5% target (+2.75R avg), 23.4% break-even, 52.2% stop.
- Market entry on the same levels (validated 1h close): −0.03R. Limit AT the level: −0.08R. No cooling filter: −0.16R.
- Live implementation: `supabase/migrations/20261012170000_limit_orders.sql` (lev_limit_plan / lev_limit_resolve, paper loop).
