# US-open strategies on crypto perps — 2026-10-15

Stavros: "a lot of traders only trade open, figure out a few winning strategies they use and lets test them."
`open.py` — BTC/ETH/SOL 15m (Aug 3–Oct 13 2026) and 8 coins 1h (Jan–Oct 2026), fees + slippage on, weekdays,
open = 9:30 New York (DST-aware), flat by 16:00 NY. Grids: g1.json (all strategies), g2.json (Open Drive robustness).

| Strategy | Trades | Avg R | Verdict |
|---|---|---|---|
| Opening-range breakout 15/30/60m (15m data) | 106–120 | −0.09 to −0.17 | rejected |
| ORB 60m, 1h data Jan–Oct | 1166 | −0.11 | rejected |
| Failed-breakout fade | 81–93 | −0.15 to −0.29 | rejected |
| Overnight-range sweep (1h, Jan–Oct) | 604 | −0.05 | rejected |
| Previous-day high/low sweep (15m) | 45 | +0.22 but H1 −0.53 / H2 +0.59 | unstable, watch |
| **Open Drive 30m, move ≥ 1 ATR(1h)** | **53** | **+0.26 (PF 1.45, both halves +, all coins +)** | **paper** |
| Open Drive 30m, k 1.25 / 1.5 | 40 / 23 | +0.30 / +0.40 | stronger filter, fewer trades |
| Open Drive 15m / 45m windows | 57 / 63 | +0.04 / −0.03 | fragile |
| Open Drive 60m, 1h Jan–Oct | 395 | −0.10 (−0.005 with trend) | did not hold |

Open Drive is live-tracked as paper in `lev_open_plan.drive` (Desk Lead, 10:00 NY) and graded each morning.
