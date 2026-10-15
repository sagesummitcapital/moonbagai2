# RSI divergence, divergence combos, RSI heatmap, USDT.D — 2026-10-15

Stavros: "I want to start looking at rsi divergence and other indicators as part of leverage scalp strategy ... can you
recreate these [Woods Bot Divergence Combo Alerts]? also using rsi heatmaps ... If usdt is down market is typically going up
... use higher timeframe to see if there is a set up and lower timeframe to confirm."

Data (data/): CRYPTOCAP TOTAL/TOTAL2/TOTAL3/USDT.D/USDC.D 4h (Jan–Oct 2026), BINANCE BTC/ETH perps 4h (Nov 2025–Oct),
1h (Feb–Oct), BTC 15m (Aug–Oct). Fees on (taker 0.06% + 0.01% slippage, maker 0.02% on targets).
`div.py` + g1.json (divergence, combos, combo + LTF confirmation, heatmap) · `fwd.py` (forward returns after combos;
USDT.D lead/lag) · `lvl.py` (divergence at a swept level). Divergence as confluence on limit fills: inline in the session
(look-ahead check: compare only trades still open 6h after the sweep extreme).

| Idea | Trades | Avg R | Verdict |
|---|---|---|---|
| RSI divergence 4h (BTC/ETH) | 44 | −0.18 | no |
| RSI divergence 1h | 162 | −0.06 | no |
| RSI divergence 15m BTC (OS/OB filtered) | 51 | −0.25 | no |
| OBV divergence 4h | 49 | +0.01 | no edge |
| Combo ≥ 2 / 3 / 4 instruments (4h) | 69 / 49 / 36 | −0.17 / −0.10 / −0.16 | no |
| Combo forward BTC 24h / 72h (N ≥ 3) | 24 | −0.44% / −0.38% | no lead |
| Combo ≥ 3 + 1h RSI-cross confirmation | 9 | +0.37 | watch (too few) |
| RSI heatmap OB/OS (4h + 1h) | 110 | −0.15 | no |
| Divergence at a swept PDL/PDH (15m / 1h) | 18 / 85 | −0.39 / −0.07 | no |
| Divergence at limit-sweep fills | 68 | +0.64 **look-ahead** → +0.07 at decision time | no real gain |
| USDT.D vs BTC same 4h bar | — | corr −0.98 | mirror, not a lead; trend doesn't predict next 24h |

The 2026-10-15 BTC move (79,732 → 82,589): the open plan's BTC long limit 79,910 (½ 1h ATR under the PDL 80,188) filled and
hit TP1 81,721 within the hour (+2.2R). The plan's "at the open" line only mentioned shorts — fixed in the open planner.
