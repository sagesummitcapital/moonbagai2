# Moonbag Leverage Desk — Strategy v5

Book 2 (BloFin). Stavros places every order. Moonbag watches, plans, scores and learns.
v5 written 2026-10-08 (DB v6: trade-only alerts · v7: daily loss limit removed). The live copy is the newest row of `lev_strategy` in the Moonbag database.

## 1. The goal

Capture as much R:R as possible while keeping risk management in place. That needs trades:
a desk that never alerts never learns. No trade is still the default — but a good setup must be
able to reach Stavros.

## 2. Why nothing reached A under v1–v4 (review of Oct 4–8)

- 181 hourly checks, 3 signals recorded, highest score 41/100. No setup ever scored above C.
- Every signal got 0/15 for "setup track record" (the desk read the losing 1h backtests as a losing
  record) and 0/10 for "macro" (only checked once the rest passed 60). Best possible score was
  about 75, so grade 4 (70+) needed a near-perfect setup and grade 5 (85+) was unreachable.
- Setups were scored while still forming, so "trigger quality" was scored before the trigger printed,
  and never rescored when it did.
- The good ones that were missed: the ETH breakdown short (Oct 7, scored 36, paper result +2.22R)
  and the BTC lower-high short Stavros took on Oct 6 (+2.1R, no signal; the original plan paid 2.2R
  and a runner would have paid ~4.8R). The ETH range-low longs that lost (−1R twice) were
  counter-trend sweeps. Re-scored with the v5 rubric below, the two winners land at 74 and 65 (DESK
  ALERT) and the two losers at about 43 (RESEARCH ONLY). Four trades prove nothing, but the rubric
  now separates with-trend structure from counter-trend hope, which is what it should do.

## 3. Rules that do not bend

- BTC and ETH perpetuals only. One position at a time. Hold 3 days maximum (time stop 72 hours).
- Stavros places every order and may set his own size; Moonbag records what he actually did.
- Leverage ≤ 20x; the stop must sit inside 80% of the distance to liquidation.
- Reward to TP1 at least 1.5R (prefer 2R+). Stop at least 0.5% from entry, beyond real structure.
- After 2 losses in a row: half risk until the next win. No daily trade or loss limit (Stavros removed
  it 2026-10-08) — a loss does not end the day.
  Down 15% from the peak: live alerts pause, research only, until the weekly review.

## 4. Confidence score v2 (0–100)

| Component | Points | How it is scored |
| --- | --- | --- |
| Structure & level | 25 | 4h/daily level, touched 2+ times = 15; plus clean invalidation just beyond it = +5; confluence (prior range edge, lower-high/higher-low stack, round number) = +5 |
| Higher-timeframe alignment | 20 | With the 4h trend = 20 · range edge trade inside a clear range = 12 · counter-trend after a 1h close reclaim = 6 · counter-trend without a reclaim = 0 and −15 penalty |
| Reward : risk to TP1 | 20 | 1.5R = 8 · 2R = 12 · 2.5R = 16 · 3R+ = 20 (TP1 at a real level, not a wish) |
| Trigger | 15 | Scored when the trigger prints: 1h close through the level = 10; + follow-through bar or volume expansion = +5. 0 while still forming |
| Regime fit | 10 | Setup used in the regime it works in (breakdown/pullback in trend, sweep-reclaim at range edges) = 10 · mixed = 5 · wrong regime = 0 |
| Evidence | 10 | Forward paper + live results for this setup and direction: unproven = 5 · 3+ resolved with avg R > 0 = 8 · 10+ with avg R > 0.3 = 10 · 10+ with avg R < 0 = 0 · fewer than 10 negative = 3. 4h backtests count only if positive on both coins |

Penalties: counter-trend without a reclaim −15 · chasing more than half an ATR past the level −10 ·
CPI/FOMC/jobs/ISM within 2 hours −10. Off-hours is not a penalty any more; it only changes who gets pinged.

Two-stage scoring: while a setup forms, the desk records a projected score (trigger counted as 10).
When the trigger prints it rescores with the real trigger points. The ping goes out on the rescored number.

## 5. Labels — what reaches Stavros

| Score | Grade | Label | What happens |
| --- | --- | --- | --- |
| 85+ | 5 · A+ | DESK ALERT | Push + TradingView alert at the entry: the order to place |
| 70–84 | 4 · A | DESK ALERT | Push + TradingView alert at the entry: the order to place |
| 55–69 | 3 · B | DESK ALERT (starter) | Push + alert, starter size |
| 40–54 | 2 · C | RESEARCH ONLY | Recorded and paper-tracked, no ping. Reviewed every Saturday |
| < 40 | 1 | PASS | Logged in the hourly note only |

DESK ALERT checklist — all must be yes, whatever the score, or it drops to RESEARCH ONLY:
1. BTC or ETH, and no BloFin trade open.
2. R:R at TP1 ≥ 1.5 (prefer ≥ 2).
3. Stop beyond real structure and ≥ 0.5% from entry.
4. Leverage ≤ 20x at the suggested size, stop inside 80% of the liquidation distance.
5. With the 4h trend, a range-edge trade, or counter-trend only after a 1h close reclaim with the plan written out.
6. Plan fits inside 72 hours.
7. No CPI/FOMC/jobs/ISM release within 2 hours.
8. The setup is not retired (10+ resolved with avg R < 0).

Off-hours: DESK ALERTs at grade 4–5 still ping; grade 3 starters wait for core hours (Mon–Fri 5am–2pm Phoenix).

## 6. Size

Starting sizes while the account is under $1,000 (Stavros may override per trade):

- Grade 3 (B) starter: 1% of the account — for the first 10 DESK ALERTs under this gate, then reviewed.
- Grade 4 (A): 5%. Grade 5 (A+): 10%. (Under $10k: 2.5% / 5%; above: 1% / 2%.)
- Leverage is chosen last, only to fit margin (≤ half the account), never above 20x.

## 7. Runner rule (from the Oct 5 and Oct 6 trades)

1. Put TP1 in as a limit for half the position and let it fill — don't close by hand in front of it.
2. When TP1 fills, move the stop on the other half to entry. The runner then costs nothing.
3. Trail the runner behind the last 1h swing until it is +3R, then behind the last 4h swing.
4. TP2 = the next 4h/daily level (aim ≥ 3R). Out at TP2, the trailed stop, or 72 hours.
5. If a target is moved after entry, leave the new one working — don't close in between.

Oct 6 BTC short: half at TP1 plus a breakeven runner was worth about 4.8R vs the 2.1R banked.

## 8. Provisional rule (being tested, not yet hard)

"No long while price is below the 10-day low unless a 1h close reclaims it." Source: the Oct 7 BTC long
(−1.01R). One trade is not evidence; the Saturday C-setup review backtests it and either promotes it to a
hard rule or drops it.

## 9. Robinhood setup score (0–10) — so an A is reachable

| Part | Points |
| --- | --- |
| Daily and weekly trend agree with the trade | 2 |
| Entry at a real level (breakout retest, prior high/low, 50-day) | 2 |
| R:R to target 1: 2R+ = 2 · 1.5R = 1 | 2 |
| Relative strength vs SPY over 20 days | 1 |
| Volume confirms (breakout or support hold on above-average volume) | 1 |
| Name sits in a Moonbag theme (watch or active) | 1 |
| Evidence: positive backtest or paper results for this setup type | 1 |

A = 8+, B = 6.5–7.9. A live fill still needs entry, stop, size and invalidation, and the stop must fit the
$12 loss box. B setups go live at half size inside the same box (changed 2026-10-08 so the book can learn);
everything below B is paper.

## 10. Rhythm

- Hourly: log, store candles, score setups. TradingView alerts and pings exist ONLY for trades to take
  (TAKE TRADE order, TAKE TRADE NOW on a confirmed trigger, CANCEL, open-trade events). No watch,
  level or "no trade yet" alerts (Stavros, 2026-10-08). Levels live in the morning brief and dashboard.
- After each close: 24-hour lookback.
- Saturday: C-setup review (every RESEARCH ONLY setup of the week, what it would have paid, which
  component held it back) → then the weekly strategy review → coaching breakdown.
