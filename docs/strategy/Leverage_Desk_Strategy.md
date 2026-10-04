# Moonbag Leverage Desk — Strategy v1

Book 2 (BloFin). Owner: Stavros places every order. Moonbag watches, plans, scores and learns.
Written 2026-10-04. The live copy is the newest row of `lev_strategy` in the Moonbag database.

## 1. The idea in one paragraph

No trade is the default. Moonbag watches BTC and ETH every hour, keeps the important levels current,
and only calls a trade when a known setup forms at a known level and scores 4 or 5 out of 5.
Every call comes with the full plan: side, entry, stop, size, leverage, TP1 and a confidence score.
Every call — taken or not — is recorded and later graded against what price actually did, so the
confidence score is checked against reality each week and the playbook improves.

Loop: **find levels → wait → signal → record → grade → backtest → adjust → repeat.**

## 2. Rules that do not bend

- BTC and ETH perpetuals only. One coin at a time. No alts until the track record proves out.
- Hold minutes to hours; 3 days maximum. Time stop at 72 hours.
- Trade only confidence grade 4 or 5. Everything lower is logged and paper-tracked, not traded.
- Risk per trade: 2% of the account at most (about $4.80 on $240). Never raised automatically.
- Size comes from the stop distance. Leverage is chosen last, only to fit margin. Max 20x, max $50 margin.
- Reward to TP1 must be at least 1.5R after fees; target 2R or better.
- Stop distance at least 0.5% of price, so fees (about 0.12% of position, round trip) stay small.
- After 2 losses in a row: half risk until the next win. Down 4% in a day: done for the day.
  Down 15% from the peak: live trading pauses, paper only, until the weekly review.
- Core hours Mon–Fri 5am–2pm Phoenix. Outside them, only grade 5 setups are alerted.
- NO TRADE is a valid and common result.

## 3. Goals and honest math

Milestones: **$240 → $1,000 → $10,000 → $100,000 → $1,000,000.**

$240 to $1,000 in 3–4 trades needs +43% to +61% on the whole account per trade. At 2% risk that is a
21R–30R winner every time; with bigger risk it means betting 15–30% of the account per trade, where two
normal losses end the run. That path is not in this strategy. What is:

| Risk per trade | Typical win (3R) | Net wins needed for $240 → $1,000 |
| --- | --- | --- |
| 2% (current rule) | +6% | about 25 |
| 3% | +9% | about 17 |
| 5% (long-term ceiling in the spec) | +15% | about 10 |

"Net wins" means wins left over after losses are paid back. The lever that shortens the road is not
leverage, it is (a) a real edge, and (b) letting part of a winner run far past TP1. Risk percent is
Stavros's decision and is only changed by him.

Each later milestone is 10x, about 40 net 3R wins at 2%. Position sizes grow with the account
automatically because risk is a percent. The $50 margin cap is reviewed at each milestone.

## 4. What the top-100-wallets article adds

The article studies spot memecoin wallets, not leverage setups, so it gives principles, not entries:

1. Fewer trades made far more per trade. → Few, high-conviction trades. Fees and slippage are a cost on every one.
2. The best wallet won only about 27% of the time; losses were about a third the size of wins and one
   trade made most of the money. → Cut losers at the stop, never widen it, and keep a runner on winners.
3. Take part off the table. → Close half at TP1, move the stop to breakeven, let the rest run to TP2/TP3.
4. Never all-in, stay liquid. → One position, fixed small risk, margin cap.
5. Hold few things. → BTC and ETH only.

## 5. Playbook (setups Moonbag is allowed to call)

| Setup | What it is | Status |
| --- | --- | --- |
| Liquidity sweep and reclaim | Price pokes through an obvious high/low, fails, closes back inside | Paper → best first results |
| Confirmed range breakout | Clean close through a well-tested level after compression | Testing |
| Trend pullback to the 20 EMA | Dip-buy / rip-sell in an established trend | Testing — mechanical version lost money |

First backtests (1h candles, Jul 13 – Oct 4 2026, fees included, one position at a time):

- Mechanical entries on the 1h chart lost money on every setup (too many trades, fees and noise).
- The same rules on the 4h chart traded about 5x less and did much better.
- Shorts lost in this period (BTC rose from about 62k to 87k). Longs with the trend were positive:
  sweep-and-reclaim long, 4h — BTC 11 trades, 55% wins, +0.52R average; ETH 10 trades, 50% wins, +0.31R average.
- Samples are small and cover one market regime. Nothing is proven yet. These results set priors, not rules.

Lessons already applied: levels come from the 4h and daily charts; the 1h chart is used only for the
trigger; trading against the 4h trend costs confidence points; trend pullback stays on paper.

## 6. Confidence score (0–100 → grade 1–5)

| Component | Points | What earns them |
| --- | --- | --- |
| Higher-timeframe alignment | 20 | 4h and daily trend agree with the trade |
| Level quality | 20 | Level tested several times, visible on 4h/daily, clean reaction history |
| Trigger quality | 15 | 1h close confirmation (not a wick), sweep + reclaim, volume expansion |
| Reward : risk | 10 | TP1 at 2R = 6, 3R or more = 10 |
| Regime fit | 10 | The setup is being used in the regime it works in (range vs trend) |
| Setup track record | 15 | Backtest plus graded signals for this setup; unproven = 5, losing = 0 |
| Macro and catalysts | 10 | No major data inside the hold window; equities and yields not fighting it |

Penalties: against the 4h trend −10 · major data (CPI, FOMC, jobs) within 2 hours −10 · chasing more than
half an ATR past the level −10 · outside core hours −5 · after 2 losses in a row −5.

Grades: 85+ = 5 · 70–84 = 4 · 55–69 = 3 · 40–54 = 2 · below 40 = 1.

Size by grade: grade 5 → full 2% risk. Grade 4 → 1% risk. Grade 3 and below → paper only.

Weekly calibration: each grade's real win rate and average R are compared with what the grade promised
(`v_lev_calibration`). If grade 4 signals do not clear breakeven over 10 or more resolved signals, the
thresholds go up 5 points and the weakest component is re-weighted. Changes create a new strategy version.

## 7. Every signal carries

Long or short · setup · trigger condition · entry · stop · TP1 (and TP2/TP3 for the runner) · size ·
notional · leverage · margin · dollars at risk · R:R · confidence score and grade with the component
breakdown · what would make it wrong · expiry.

Trade management once in: half off at TP1 and stop to breakeven; runner trails behind 4h structure to
TP2/TP3; out at the stop, the target, or 72 hours — whichever comes first.

## 8. Rhythm

- **Hourly:** log price, bias, regime and levels for BTC and ETH; store the new candles; update forming
  setups and signals; keep TradingView "MB" alerts on the levels that matter; resolve old signals.
- **When a grade 4–5 setup forms or triggers:** notify Stavros with the full plan.
- **When Stavros reports a trade:** record it, link it to the signal, switch alerts to stop / TP1 / next level.
- **Every close (live or paper):** one journal line — thesis, result, one mistake, one rule change.
- **Weekly:** re-run backtests on the grown candle history, test at least one new idea, calibrate the
  confidence score, promote or retire setups, publish a new strategy version if anything changed.
