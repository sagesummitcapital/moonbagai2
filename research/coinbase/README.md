# Coinbase book research (2026-10-10)

Python research behind `docs/strategy/COINBASE_STRATEGY.md`. Data: TradingView daily bars for COINBASE:BTCUSD,
COINBASE:ETHUSD, COINBASE:SOLUSD and weekly BITSTAMP:BTCUSD, saved as `btc_d.json`, `eth_d.json`, `sol_d.json`,
`btc_w.json` (format `{"bars": {"t": [...], "o": [...], "h": [...], "l": [...], "c": [...]}}`; not committed).

- `macro.py` — cycle position, moving averages, prior-cycle timing
- `flips.py` — historical regime flip dates (200D hysteresis, weekly 20 EMA, 50W SMA)
- `run1.py` — regime filters with full exposure vs hold
- `run2.py` / `run5.py` — swing entry grid and parameter sensitivity
- `run3.py` / `run6.py` — trend core vs swing vs combinations, risk levels
- `run4.py` — multi-coin breakout portfolio (the chosen system lives in `port.py`)

The database function `public.cb_backtest()` implements `port.port()` exactly (verified trade-for-trade).
