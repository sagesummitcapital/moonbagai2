# Liquidity sweep -> FVG -> opposite liquidity (tested 2026-10-11)

Stavros shared two outside trading guides. This folder tests the mechanical parts on crypto
(BINANCE BTC/ETH/SOL perps; 1h bars Jan-Oct 2026, 15m bars Aug-Oct 2026; fees 0.05%/side).

- `sweep.py`: engine. Liquidity = previous-day high/low, Asia high/low, London high/low, 4H swing highs/lows.
  A sweep = a bar trades beyond the level and closes back inside. Entry = reclaim close, or a limit at the
  fair value gap the displacement leaves. Stop = beyond the sweep extreme (or the gap). Target = the nearest
  opposite liquidity, needing 2R or 3R. Optional filters: the 4H candle closing 12:00 UTC (5 AM Phoenix), NY window, BTC/ETH/SOL divergence.
- `g3.py`: the honest run, which only trades after 12:00 UTC so the bias candle and London range are known
  (`g2.py` traded from 00:00 UTC and leaked London levels from the future - its positive numbers are invalid).

Result (g3): every mechanical variant lost money after fees (avg -0.1R to -1.1R, both halves).
Relative lessons that held across variants:
- the 5 AM 4H-candle filter cut losses a lot (-0.43R -> -0.11R at 1h): don't trade against a strong 4H candle;
- 2R minimum beat 3R minimum in every variant;
- restricting to the 9:30-12:00 ET window made results worse, not better;
- stops just beyond the gap lost far more than stops beyond the sweep;
- on 15m, an FVG limit entry beat entering at the reclaim close (-0.64R -> -0.17R, small sample).
