# Moonbag Levels — install on TradingView (once, about 2 minutes)

1. Open any chart on TradingView (desktop or tradingview.com).
2. At the bottom of the screen click **Pine Editor**.
3. Delete what is in the editor, then paste everything from `moonbag_levels.pine` (this folder).
4. Click **Save** (name it "Moonbag Levels"), then **Add to chart**.
5. In the indicator's name on the chart click the star / "Add to favorites", so it is one click on every chart.

What it draws: the nearest 2 levels above and 2 below price from your range levels — month open, previous month open/close, Monday high/low, yesterday's high/low. Monday range is shaded on BTC. Small triangles mark a sweep of the Monday range that closed back inside.

Moonbag's own range high/low and bias-flip line appear separately as silent alert lines named "MB LVL …" (no pings).

Settings (gear icon): show every level instead of the nearest, shade Monday on all coins, line length.

Check once: open BTC and compare the lines with moonbag.ai/dashboard/levels. Charts on Binance can differ from BloFin by a few hundredths of a percent; use BloFin charts (BLOFIN:BTCUSDT.P) where available for an exact match.
