# Woods framework — mechanical test of the long/short trigger (2026-10-16)

Stavros's mentor's framework became the main strategy on 2026-10-16. `woods.py` tests the part that can be written as rules:
(a) a 4H sweep of a liquidity pool (last 4H swing, previous day/week low/high), (b) a 4H close back (SFP), (c) 4H RSI
divergence from oversold (< 35), (d) a 1H trigger (higher low + close above the bars since the sweep) within 12h; stop just
past the swept wick; management 70% at the first pop (+1R), break-even, runner to 3R. BTC + ETH perps, Feb–Oct 2026, fees on.

| Variant | Trades | Avg R | Note |
|---|---|---|---|
| All four (a–d), 70% at 1R / BE / runner 3R | 74 | −0.12 | about break-even after fees |
| Same entries, single 2R target | 72 | −0.13 | Woods' management is not worse |
| Without (c) the divergence | 186 | **+0.05** (H2 +0.12, PF 1.10) | the divergence leg filters out more winners than losers |
| Without (d) the 1H trigger | 124 | −0.20 | the 1H trigger is the most useful leg |
| Sweep + SFP only | 348 | −0.17 | |
| Without (c), single 2R | 180 | −0.11 | management (70/BE/runner) adds ~+0.15R |
| Without (c), ETH long only when BTC 4H > EMA50 (anchor proxy) | 150 | +0.03 | max DD 9.5R (half) |
| Edge filter (bottom/top third of the 30-day range) | 57–115 | −0.06 to 0.00 | |

What the test can't include: Woods' discretionary zones (which order block or demand zone matters), his line-in-the-sand
maps, and the news reaction — that's where his edge would live. Live tracking: playbook `woods` (live) and `woods_nodiv` (paper);
every Woods trigger is a lev_signals row, so the strategy league scores it weekly.
