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

## Open universe (v2, 2026-10-10)

- `uni.py` — portfolio engine over many coins (36 Coinbase USD pairs, daily bars from TradingView `COINBASE:<COIN>USD`
  saved as `u/<coin>_d.json`): BTC-gate, alt risk multiplier, ranking, top-N by dollar volume, walk-forward live eligibility.
- `paper.py` — the per-coin paper engine that `cb_run()` mirrors in SQL; it produced the 311-trade seed of `cb_paper`.
- `uni_run1/3/4/5/7.py` — the grids behind COINBASE_STRATEGY.md §4b (naive open universe vs earned live status, three periods,
  threshold sweep, final saved rows in `backtests` with engine_code `py_uni_*`).
