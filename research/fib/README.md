# Fib retracement plays — 2026-10-15

Stavros: "i think .75 fib levels are great plays - please test".
`fib.py` — legs from confirmed pivots (5/5), a resting limit at the retracement level, stop beyond the leg origin (1.0)
+ 0.25 ATR, target the leg extreme (0.0) or the −0.272 extension; fees on (maker in/target, taker+slip on stops/time).
8 coins 1h Jan–Oct 2026 (1h8), BTC/ETH 4h, BTC 15m. Grids g1–g3.json.

| Test | Trades | Avg R | Verdict |
|---|---|---|---|
| 0.75 on every 1h leg ≥ 3 ATR | 1,187 | −0.24 | no |
| 0.5 / 0.618 / 0.705 / 0.786 on the same legs | ~1,200 each | −0.21 to −0.24 | 0.75 isn't special on small swings |
| 0.75, legs ≥ 5 ATR with the 1h EMA200 trend | 226 | −0.05 | no |
| **0.75, legs ≥ 7 ATR with trend** | **53** | **+0.24 (PF 1.51, H1 +0.21 / H2 +0.30)** | **paper (fib_75)** |
| 0.786, legs ≥ 7 ATR with trend | 47 | +0.26 | similar |
| 0.618, legs ≥ 7 ATR with trend | 79 | +0.10 (H2 −0.07) | weaker |
| 0.75, legs ≥ 8 ATR, target −0.272 | 27 | +0.41 | watch |
| 4h legs ≥ 5 ATR with trend | 21 | +0.18 (H1 −0.21) | watch |
| 15m legs ≥ 4 ATR | 113 | −0.28 | no |

Caveat: on the big trending legs the edge is mostly in the alts; BTC/ETH/SOL alone were ~+0.03R (22 trades).
Live: `lev_fib_plan()` (migration 20261015180000) places paper limits each 4h LIMIT DESK run; resolved by lev_limit_resolve().
