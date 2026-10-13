# Moonbag Strategy — Source of Truth

Version 15 · 2026-10-11 · Owner: Stavros · Maintained by Claude

This file is the one place the Moonbag strategy is written down. Every agent works from it.
When it changes, the same text is saved in three places: this file in the repo
(`docs/strategy/MOONBAG_STRATEGY.md`), the claude.ai project, and the database (`strategy_doc`,
read by the scheduled agents and by Grok through `GET /api/moonbag/strategy`). The database
tables (`lev_strategy`, `risk_config`, `lev_universe`) hold the same rules in machine form. If they
ever disagree with this file, this file wins, and Claude fixes the tables.

Analysis, not financial advice. Stavros decides every trade.

---

## 0. The Moonbag Playbook (all books, one page each)

Written by the Strategist, 2026-10-11, at Stavros's request: "a clearly defined strategy for all asset classes". This section is the short version. Sections 3 and 4 hold the detail. If they ever disagree, the risk numbers in §0.1 win.

Every rule below comes from our own backtests, live trades and lookbacks. Where the evidence is thin, it says so and the rule stays cautious.

### 0.1 Universal rules (every book)

| Rule | BloFin (leverage) | Coinbase (spot) | Robinhood trading | Robinhood holdings |
| --- | --- | --- | --- | --- |
| Max risk per trade | 2% | 2% | 1% | no stop (DCA) |
| Daily drawdown stop | 4% | 4% | 3%, plus the $12 loss box | none |
| Minimum reward : risk to target 1 | 2 : 1 | 2 : 1 (we use 3 : 1) | 2 : 1 | not a trade |
| Max combined open risk | 15% | 15% | 5% | sleeve capped at 25% of the account |
| Half risk after | 2 losses in a row, until the next win | 3 losses in a row | 3 losses in a row = stop and review | n/a |
| Trading pauses when | account is 15% below its peak | equity is 20% below its 30-day peak | account is 8% below its peak, or equity under $90 | a thesis breaks |

The same for every book:

1. **Know the stop before the entry.** No stop price, no trade.
2. **Every criterion met, or no trade.** "Almost" is a no.
3. **One position per symbol.**
4. **Daily drawdown stop.** Once realised losses today (Phoenix day) reach the limit, no new trades until tomorrow. Open trades are still managed.
5. **Journal every trade** and every skipped setup. Each closed trade gets a 24-hour lookback.
6. **Judge by expectancy (average R per trade) and rule-following, not win rate.**
7. **Gains compound by themselves.** Size is a percent of the current balance, so it grows with the account. Never raise the percent after a win.
8. **Only Stavros changes a risk number.**

**Strategy of the week (2026-10-13).** Every Saturday the review scores every approach on one board (his own calls, Moonbag picks he took, the desk's paper signals, the limit recipe full-target and quick mode) and names ONE winner for next week: 10+ trades in 4 weeks and positive R in both halves; anything losing over 10+ trades can't win. The Monday week plan opens with it and its rule. Grok builds inputs with it first; if his idea uses another approach, Grok still gives the inputs and says in one line which approach is winning. No winner yet → "too early".

**No trade cap (2026-10-13).** No limit on the number of trades per day or per week — never suggest one. The limits are 2% per trade, the 4% daily stop, 15% combined open risk, one trade per coin, half size after 2 losses in a row.

### 0.2 BloFin leverage (Stavros places every order)

**Coins.** BTC and ETH always. Plus at most 2 "in play" coins from the top 5 the market is rotating into. Never a cooling coin (10%+ off its 3-day low or high, or more than 2 daily ATRs from its daily 20 EMA).

**The one setup: a real level, then a 1-hour close.**

1. **Level.** A 4h or daily level: swing high or low, range edge, previous day or week high/low. Touched 2+ times is best. No clear level, no trade.
2. **Trigger (one of two), on a closed 1h candle:**
   - **Sweep and close back.** Price trades through the level, then a 1h candle closes back inside. Long at a range low (reclaim), short at a range high (rejection).
   - **Breakout and hold.** A 1h candle closes beyond the level and the next 1h candle does not close back through it (or a retest holds).
   Never enter on the first touch or a wick.
3. **Direction.** With the 4h trend, or at a range edge. Against the trend only after a reclaim. Trading against the 5 AM Phoenix 4H candle (when its body is at least half its range) costs 10 points.
4. **Stop.** Beyond the 4h/daily structure that proves the idea wrong (the swept wick or the far side of the level, never a 15m/1h micro-swing), plus half the 1h ATR. At least 0.8% from entry on BTC/ETH and 1.5% on other coins, and never less than 1.5 × the 1h ATR. A wider stop means a smaller position and lower leverage, not more risk.
5. **Targets.** TP1 = the next real level, placed just in front of it, never beyond it. It must be 2R or more. TP2 = the level after that.
6. **Grade (the Gate's 0-100 score).** 85+ = A+. 70-84 = A. 55-69 = B. Only A and A+ reach the phone.

**Size and leverage.**

| Grade | BTC / ETH risk | Other coins risk | BTC/ETH leverage ceiling | Other coins ceiling |
| --- | --- | --- | --- | --- |
| A+ | 2% | 2% | 20x | 10x |
| A | 2% | 1% | 15x | 8x |
| B | 1% | 0.5% | 10x | 5x |

- Coins to buy = risk $ ÷ distance from entry to stop. Leverage never changes the dollar risk.
- Leverage = the lowest whole number that keeps margin at or under half the balance. Ceilings halve in a hot market.
- Liquidation must sit at least 1.25× the stop distance past entry. Isolated margin.

**Management.** TP1 is a limit order for half. When it fills, move the stop to entry. Trail the rest behind the last 1h swing, then the 4h swing after +3R. Out at TP2 or the trailed stop. Aim for about 72 hours, but there is no time stop: at 72h the desk sends one review line (idea intact → hold; idea broken → suggest closing). Do not close by hand in front of a working target.

**Alerts.** Range lines are silent. The phone only gets TAKE TRADE NOW (A or A+) and the stop / target alerts of an open trade.

**What the evidence says (thin).** 5 live trades, all Stavros's own calls: +0.48R average. The one that scored 55+ made +2.1R. The four under 55 averaged about +0.04R. Setups planned at 2-3R won 3 of 4. Setups planned under 2R went 0 for 4. Mechanical 1h entries lost in the backtest; 4h levels did better. No Moonbag alert has been taken live yet. So: 4h/daily levels, 2R minimum, and smaller size when there is no desk grade.

#### QUICK INPUTS FOR ANY COIN (Grok uses this, word for word)

When Stavros asks "give me inputs for <coin>", run this checklist in order. The first "no" ends it: answer **NO TRADE** and name the price where it would become a trade.

1. **Daily drawdown.** Are today's realised losses under 4%? Is there at least 1% of the 15% open-risk budget left? Is there no open trade on this coin?
2. **Not cooling.** Is the coin within 10% of its 3-day low and high, and within 2 daily ATRs of its daily 20 EMA?
3. **Level.** Is price at a real 4h/daily level (not mid-range)?
4. **Trigger.** Has a 1h candle closed back inside after a sweep, or closed beyond the level and held? If not, give a limit order at the level only when the trigger has already printed; otherwise NO TRADE.
5. **Stop = invalidation.** Below the 4h/daily support (long) or above the resistance (short) that the trade depends on, plus half the 1h ATR, at least 0.8% (BTC/ETH) or 1.5% (others) from entry and at least 1.5 × the 1h ATR. Wider stop = smaller size and lower leverage, same 2% risk. Never pull the stop closer to make 2R work: if TP1 is under 2R with the real stop, it is NO TRADE.
6. **Reward.** Is the next real level 2R or more away? TP1 goes just in front of it.
7. **No major US data** (CPI, FOMC, jobs, ISM) within 2 hours.
8. **Grade and risk.** If the Moonbag desk has a live signal on this coin, use its grade and the table above. If it has none, Grok does not score it: treat it as B (1% on BTC/ETH, 0.5% on any other coin). Halve it after 2 losses in a row.
9. **Size.** Coins = risk $ ÷ |entry − stop|. Notional = coins × entry.
10. **Leverage.** Lowest whole number with margin at or under half the balance, inside the ceiling. Check liquidation is 1.25× the stop distance past entry; if not, cut leverage or size. Rough liquidation: entry × (1 − 1 ÷ leverage) for a long, entry × (1 + 1 ÷ leverage) for a short. BloFin's own number is the one to trust.

**Output, always in this form:**

```
<COIN> <Long|Short> · Entry <price> (<market|limit>) · SL <price> (<x.x>%) · TP1 <price> (<x.x>R, half) · TP2 <price>
Size <qty> <COIN> (≈ $<notional>) · Leverage <x>x isolated · Margin $<m> · Risk $<r> (<p>% of $<balance>) · Liq ≈ <price>
Why: <the level and the 1h close, one line> · Skip if: <what cancels it>
```

**Worked example** ($250 balance, desk grade A, BTC): long 83,000, stop 82,300 under the 4h support (0.84%). Risk 2% = $5. Size = 5 ÷ 700 = 0.0071 BTC = $593. Leverage 5x, margin about $119, liquidation near 66,400. TP1 must be 84,400 or higher. With no desk grade the same trade is 1% = $2.50, 0.0036 BTC, 3x.

**NO TRADE** when: no level, no 1h close, reward under 2R, coin cooling, no risk budget, 4% daily drawdown hit, or data within 2 hours. Say it in one line with the price that would change it.

**LIMIT ORDERS (2026-10-12, §3.12).** Same levels, entered by a resting limit instead of at market: put the limit half a 1h ATR *through* the level (below the support for a long, above the resistance for a short) so it only fills on a sweep; level 0.15–2 daily ATRs from price, on the side of the daily 50 EMA; stop and minimums as above; TP1 the next opposite level, at least 2R (aim 3R); stop to entry at +1.5R; cancel after 24 hours or if price reaches TP1 first. A DCA ladder shares one stop and the 2% is for all rungs together. Grok records every resting limit in Moonbag (POST /limits) so it gets a TradingView alert and a line under "Open limits".

### 0.3 Coinbase spot (Grok executes)

- **Trades:** BTC, ETH, SOL, spot only, long or cash. 36 coins are paper-traded; alts are paper-only by Stavros's choice.
- **Regime (trend filter):** BULL = daily close above 1.02 × the 200-day average. BEAR = daily close below 0.97 × it. Longs only in BULL.
- **Entry:** a BULL coin closes the day above its prior 55-day high. Market buy after the 00:00 UTC close, never more than 1% above the handed-off price.
- **Stop:** 3 × ATR(14) below entry.
- **Target:** sell half at 3R. Then the stop on the rest goes to entry + 1.2%.
- **Trail:** the rest trails the prior 20-day low (10-day low once BTC is above 100k).
- **Regime exit:** if the coin turns BEAR on a daily close, sell everything in it.
- **Risk:** 2% per trade including fees. 4% daily drawdown stop. 15% open risk. Max 3 positions. Half risk after 3 straight losses. New entries pause at 20% below the 30-day peak.
- **Evidence:** 2021-26 backtest with fees, 29 trades, +1.15R average, worst drawdown −18.9%, against −76.7% for holding BTC. All 36 variants made money in both test periods.
- **Thin spot:** that backtest ran at 5% risk (29.6% a year vs 19.6% for holding BTC). At 3% it made 19.4% a year. 2% was not tested and will return less: expect a much smaller drawdown than holding BTC, but it may not beat BTC on return in a strong bull run. No live trades yet.

### 0.4 Robinhood trading sleeve (Grok executes)

- **Trades:** US stocks and ETFs (price $5+, volume 1M+), and 1x inverse ETFs for bearish views. Long-only. No options, margin, leveraged ETFs, crypto or VRF.
- **Setup score (0-10):** trend on daily and weekly, entry at a real level, 2R+ to target, strength vs SPY, volume, theme, evidence.
  - **A (8+):** full size. **B (6.5-7.9):** half size. Below B: paper only.
- **Entry:** at a real level (breakout retest, prior high/low, 50-day average), with entry, stop, size and invalidation written first. The order must be one the broker can place.
- **Risk:** 1% per trade. 3% daily stop. $12 combined loss box. 5% open risk. Max 20% of the account per position, 6 positions.
- **Weekly limits:** two fills a week, one symbol a day.
- **Exits:** the stop, the target (2R or more), or the written invalidation. No partials at this account size.
- **Pause:** 8% below the peak, 3 losses in a row, or equity under $90.
- **Evidence (weak):** the mechanical version of the A setup lost in the backtest (about −0.09R to −0.16R per trade over 84-113 trades). Two live trades, +0.34R average. So both entry types stay **paper-first** until 5 closed paper trades show a positive average R. Until then expect few or no live fills. That is the rule working, not a fault.

### 0.5 Robinhood long-term holdings (DCA)

- **What it is:** 25% of the Robinhood account, bought weekly over 8 weeks from 2026-10-09, then every Monday.
- **Weights:** SPCX 25 · TSLA 20 · GLD 12 · NVDA 10 · INTC 8 · SLV 8 · MP 7 · GDX 5 · FCX 5.
- **Caps:** one name at most 30% of the sleeve. SPCX + TSLA at most 45%.
- **Buying:** each week's money goes to the names furthest below target. SPCX, TSLA and NVDA get a double buy when 15%+ below their 26-week high with the thesis intact. Metals never get a double buy.
- **No stops.** These are not trades. A holding is sold only on a written thesis break, confirmed by the Saturday review and Stavros.
- **What breaks a thesis (examples):** SPCX: Starlink growth stalls 2 quarters or Starship grounded 6+ months. TSLA: autonomy misses 2 more years while margins fall, or Musk leaves. NVDA: big-cloud spending cut 2 quarters running or gross margin under 60%. GLD: central banks turn net sellers for 2 quarters. Each name's full rule is in `lt_universe`.
- **Evidence:** one week bought. Too early to judge. Benchmark is SPY bought on the same dates.

### 0.6 The scoreboard

**Daily (in the morning brief), per book:**

- Trades closed, R for the day, realised loss vs the daily drawdown stop.
- Open risk vs its cap.
- Rule breaks (any trade outside this playbook).

**Weekly (Saturday review), per book:**

| Metric | What it tells us |
| --- | --- |
| Expectancy = average R per trade | Is there an edge |
| Total R and % of the account | What it paid |
| R:R buckets: 2-2.5R, 2.5-3R, 3R+ | Which targets actually get hit |
| Max drawdown from the peak | How bad it got |
| Rule-following % = trades with zero rule breaks ÷ all trades | Discipline. Target 100% |
| Versus benchmark over the same dates | BloFin and Coinbase vs holding BTC. Robinhood trading and holdings vs SPY |
| Moonbag signals vs own calls (BloFin) | Whether the score adds anything |
| What the lock-in earned vs holding the plan | Whether early exits cost R |

**The bar a rule change must clear:** 10 or more resolved results, or a backtest that holds on two coins (Coinbase: 20+ backtest trades that hold in both halves). One win or one loss changes nothing. Risk numbers, the 20x ceiling, the 15% open-risk cap and the 72-hour limit change only when Stavros says so.

### 0.7 What is NOT part of the strategy

Tested or tried, and rejected:

- The outside guide's full "sweep → fair value gap → opposite liquidity" setup: lost −0.1R to −1.1R per trade on crypto.
- A 3R minimum: 2R beat it in every version.
- Trading only the 9:30-12:00 New York window: worse, and too few trades.
- Stops just beyond the fair value gap: much worse than stops beyond the sweep.
- Mechanical 1h entries with no level, and the trend pullback to the 20 EMA: negative in every backtest. Paper only.
- Any trade planned under 2R: 0 for 4 on paper, and the cause of the week's only full loss.
- Leverage above 20x, stops tighter than 0.8% (BTC/ETH) or 1.5% (others), and closing by hand in front of a working target.
- Coinbase: all 36 coins at full risk (drawdown −64%), and the BTC 20-week EMA gate (it whipsawed).
- Double buys on gold and silver: made silver worse.
- Chasing a coin after a 10% move.
- Prop-firm and income claims from outside guides.

---

## 1. Goal and principles

- **Two books, one brain.** Book 1 is Robinhood (longer-term thesis, the Agentic account). Book 2 is the BloFin leverage desk.
- **Leverage milestones:** $240 → $1k → $10k → $100k → $1M.
- **Maximise R:R while keeping risk management in place.** No trade is the default, but we have to trade to make money. A good setup must be able to reach Stavros.
- **Feedback loops are vital.** Every setup is recorded, whether or not it is traded. Every trade gets a 24-hour lookback. Every week the Auditor checks what worked and changes rules on evidence. Testing new ideas and learning from mistakes is expected.
- **Alerts are for action.** No "watching, no trade yet" messages.

---

## 2. The agents — heads, agents, tasks

Three heads route the work, agents each own a few tasks, and every run writes one line to `agent_runs`
(work, quiet or error). The dashboard Agents tab shows this as an org chart.

| Head | Agents under it | Scheduled task |
| --- | --- | --- |
| **Desk Lead** (leverage desk) | Scout · Cartographer · Gate · Risk Officer · Exit Clerk | Desk Lead (hourly, :25) · Scout (every 4h, :07) |
| **Strategist** (research + head of both agentic books: Robinhood and Coinbase) | Publisher · Level Watch · Coinbase Desk · Executor (Grok/RockBot) · Auditor → Coach | Daily cycle (5:50 AM) · Intraday check (6:45 / 9:45 / 1:45) · Coinbase desk (hourly :32, full run after the 00:00 UTC close) · Weekly reviews (Sat 6:29 / 6:59) · 24h lookback (every 3h) |
| **Stavros** | — | Places every BloFin order; also takes his own calls |

| Agent | Tasks |
| --- | --- |
| Scout | Rank ~25 coins vs BTC · pick the top 5 rotation coins (daily close) · pick up to 2 in play (every 4h) |
| Cartographer | Each coin's two lines: range high + range low · one TradingView alert per line carrying the play |
| Gate | Check validation on closed 1h candles · score 0–100 + 8-point checklist · TAKE TRADE NOW or NO TRADE |
| Risk Officer | Size to the risk tier and open-risk budget · leverage inside the ceiling · BloFin order card |
| Exit Clerk | Swap a coin's lines to stop + target when a trade opens · TP1 → breakeven, trail · 72h review (no time stop) · restore lines after close |
| Publisher | Morning-brief X post · trade opened / closed X posts (templates, filled by the website) |
| Level Watch | Robinhood levels during market hours — messages only when something changed |
| Coinbase Desk | The Strategist's Coinbase arm: daily candles for 36 coins · `cb_run()` — regime, paper book, live status, entries, stops/TP1/trail · hands orders to Grok |
| Executor | Grok/RockBot: Robinhood AND Coinbase orders inside the limits · records fills and BloFin trades · account snapshots for both · posts the X posts |
| Coach | 24h lookback on every close · scores Stavros's own calls |
| Auditor | The Strategist's weekly self-review: C-setup review · weekly strategy review · Coinbase paper book and promotions · R:R, leverage, rotation, agent health · writes strategy changes here |

**Token discipline.**

- The Desk Lead starts every hour with a cheap sentinel: one database query, one price check, one alert-log check.
- If no coin has a reason to work, it logs a quiet run and stops. A coin has a reason when:
  - it has an open trade;
  - one of its alerts fired;
  - a play is mid-validation;
  - it is a 4h close;
  - its lines are missing.
- Candles are fetched only for coins in work.
- Robinhood checks never analyse crypto.
- The Scout is its own small task.
- The Auditor reviews work vs quiet vs error every Saturday.

**ONE DESK, ONE SCORE.** Only the Gate scores setups. Grok reads `/briefing`, `/signals` and `/strategy` and never runs a parallel score.

---

## 3. Book 2 — Leverage desk (BloFin)

### 3.1 Universe — which coins

- **Core:** BTC and ETH are always watched and always have their two lines.
- **Rotation:** the top 5 coins the market is rotating into, re-ranked by the Scout every daily close. A coin is ranked on:
  1. relative strength vs BTC over 1 month (main factor);
  2. confirmed by 3 months;
  3. liquid, with a perpetual listed on BloFin and market cap above about $1B;
  4. no stablecoins, wrapped coins or BTC/ETH clones.
- **In play:** of the 5, at most the **2 strongest** that also show fresh momentum (1M relative strength rising and price above the 4h 50 EMA) get their two lines and TradingView alerts at a time. That keeps alerts and noise down.
- **No chase — cooling (Stavros, 2026-10-10: "after a 10% move there is not much to capture, i would want to wait and see").** A coin is **cooling** when its last price is 10%+ above its lowest low of the last 3 daily candles, or 10%+ below its highest high of the last 3 daily candles, or more than 2 × daily ATR(14) away from its daily 20 EMA. A cooling coin is never put in play, gets no armed plays and no trade alerts, in either direction. It stays on the watchlist. It cools off by itself once price bases for about 3 days (the 3-day move drops under 10%). Then the Cartographer draws fresh lines off the base. Open trades on a cooling coin are managed as normal.
- **Seed list (2026-10-09), 1M vs BTC:** NEAR +102%, ENA +30%, SUI +25%, AAVE +24%, AVAX +24%. Bench: LTC, SOL.
- Live list: `lev_universe` and the dashboard Agents tab.

### 3.2 Hard rules (do not bend)

- **One trade per coin, no cap on the number of open trades, combined risk to the stops ≤ 15% of the account** (Stavros, 2026-10-09; 2-trade cap removed 2026-10-10). A trade on one coin never changes another coin's lines. Each extra trade is sized to fit what is left of the 15% (below 1% left = NO TRADE). Risk on a trade drops to 0 once its stop is at or past entry.
- Aim to be done within about 72 hours; there is no time stop (Stavros, 2026-10-12). At 72h the desk sends one review line.
- Stavros places every order.
- Stop beyond real 4h/daily structure plus half the 1h ATR, at least 0.8% from entry (1.5% for rotation coins) and at least 1.5 × the 1h ATR. The stop must sit inside 80% of the distance to liquidation.
- **Reward to TP1 at least 2R** (Stavros, 2026-10-10: "i want 2:1 r:r"). No exceptions below 2R.
- Isolated margin. Margin at most half the account.
- **Leverage ceiling:** 20x for BTC/ETH, 10x for rotation coins (database-enforced).
- **Risk per trade: 2% of the BloFin balance at most, and a 4% maximum daily drawdown** (Stavros, 2026-10-11; replaces the 4% cap of 2026-10-10):

  | Grade | BTC / ETH | Any other coin |
  | --- | --- | --- |
  | 5 (A+) | 2% | 2% |
  | 4 (A) | 2% | 1% |
  | 3 (B) | 1% | 0.5% |

- **Daily drawdown stop:** once realised losses today (Phoenix day) reach 4% of the account, no new trades until tomorrow. The database enforces this on Moonbag signals.

- Other coins take **one grade lower size** (the right-hand column) until 10 resolved alt signals show positive average R.
- After 2 losses in a row: half risk until the next win. Down 15% from the peak: trade alerts pause, research only, until the Saturday review.
- No cap on the number of trades in a day, and one loss doesn't end the day. The only daily limit is the 4% daily drawdown stop above (the 2026-10-08 removal of the daily loss limit was replaced on 2026-10-11).

### 3.3 The two lines per coin (Cartographer) — TradingView = Moonbag home page

**No open trade on the coin.** It has exactly two lines, each one a TradingView alert:

- **RANGE HIGH**: the nearest real 4h/daily level above that capped price.
- **RANGE LOW**: the nearest real level below that held.
- Prefer levels that are **external liquidity** — where stops cluster: swing highs and lows, the previous day's high/low and, from each Sunday, the previous week's high/low. A sweep of one of these (price trades through it and a 1h candle closes back inside) is the reclaim / rejection play below.

They bracket price. The same two numbers show on the Moonbag home page (morning brief coin card, "TradingView lines"), in the morning brief text and in the X post. Each alert message carries the play:

| 4h trend | At the range high | At the range low |
| --- | --- | --- |
| Down | Primary: rejection SHORT · Alt: breakout LONG on a close above + hold | Primary: breakdown SHORT · Alt: sweep-and-reclaim LONG |
| Up | Primary: breakout LONG · Alt: rejection SHORT | Primary: reclaim LONG · Alt: breakdown SHORT |
| Range | Primary: rejection SHORT | Primary: reclaim LONG |

**Validation** (never enter on the touch or a wick):

- **Breakout / breakdown:** a 1h candle closes beyond the line and the next 1h candle doesn't close back through it, or a retest holds.
- **Rejection / reclaim:** price sweeps beyond the line, then a 1h candle closes back inside.

**After the 1h close** the Gate decides: TAKE TRADE NOW (the full inputs) or NO TRADE.

**What reaches your phone (Stavros, 2026-10-10: "only send lev alerts when i should take a trade — not useless alerts").**

- The range-line alerts are **silent** (no push, no popup). They are Moonbag's tripwires, not messages to you. They still show as lines on the chart and in the alert list.
- Your phone only gets a TradingView alert when:
  1. there is a trade to take: **TAKE TRADE NOW** — an "MB NOTE" alert with the full inputs (grade A or A+, any time); or
  2. you have a trade open: its STOP / TP alerts and the one lock-in line.
- No "touched, waiting" and no NO TRADE pushes. Every decision is still logged on the dashboard (signals and agent runs), and B-grade setups are paper-tracked there.

If the range held, the line is re-armed. If it broke, the box is redrawn.

**A trade is open on the coin**, whether a Moonbag trade or Stavros's own: that coin's two lines become **STOP** (live `current_stop`) and the **next target** (TP1, then TP2). Other coins keep their range lines. When Stavros moves his stop or target, the lines follow at the next hour. When the trade closes, the range lines come back.

Lines come from price alerts. The connector can't draw permanent chart drawings, so the line shows on the chart while its alert is active. A fired alert is re-armed by the next hourly run.

### 3.4 Confidence score (Gate) — 0 to 100

| Part | Points |
| --- | --- |
| Structure & level | 25: a 4h/daily level touched 2+ times = 15; + clean invalidation = 5; + confluence = 5 |
| Higher-timeframe alignment | 20: with the 4h trend = 20; range edge = 12; counter-trend after a 1h reclaim = 6; counter-trend with no reclaim = 0, plus a −15 penalty |
| Reward : risk to TP1 | 20: 2R = 12; 2.5R = 16; 3R+ = 20 (under 2R = no trade) |
| Trigger | 15: scored when validation prints. 1h close through the level = 10; follow-through or volume = +5 |
| Regime fit | 10: right regime for the setup = 10; mixed = 5; wrong = 0 |
| Evidence | 10: forward results for this setup. Unproven = 5; 3+ positive = 8; 10+ with avg > 0.3R = 10; 10+ negative = 0 (retired) |

- **Penalties:**
  - chasing more than half an ATR past the level: −10;
  - CPI/FOMC/jobs/ISM within 2 hours: −10;
  - **trading against the day's 4H candle: −10.** This is the 4H candle that closes at 12:00 UTC (5 AM Phoenix). It counts when its body is at least half its range. In the 2026-10-11 backtest, skipping trades against it cut losses the most of any filter (§3.11).
- **Rotation coins:** add **"leading vs BTC"** to regime fit (full 10 only while the coin is in the top 2 by relative strength).

| Score | Grade | Label | What happens |
| --- | --- | --- | --- |
| 85+ | 5 (A+) | DESK ALERT | TAKE TRADE NOW alert any time |
| 70–84 | 4 (A) | DESK ALERT | TAKE TRADE NOW alert any time |
| 55–69 | 3 (B) | STARTER (dashboard only) | Paper-tracked and shown on the dashboard. No phone alert. |
| 40–54 | 2 (C) | RESEARCH ONLY | Paper-tracked; reviewed Saturday |
| Under 40 | 1 | PASS | Logged |

**DESK ALERT checklist** (all must be yes):

1. Coin is core or in play, no open trade on this coin, and at least 1% of the 15% open-risk budget left.
2. R:R at TP1 is at least 2.
3. Stop is beyond structure and far enough from entry.
4. Leverage is within the coin's cap and the stop is inside 80% of the liquidation distance.
5. The trade is with the 4h trend, at a range edge, or counter-trend only after a reclaim.
6. The plan should play out in about 72h (an aim, not a limit).
7. No major US data release within 2h.
8. The setup is not retired.
9. The coin is not cooling (no chase after a 10% move).

### 3.5 Leverage — flexible, per trade (Risk Officer)

**Leverage does not change the dollar risk.** The stop distance and the risk tier set the $ at risk and the position size. Leverage only sets how much margin is tied up and how far away liquidation sits. So leverage is chosen per trade, inside a ceiling that depends on the trade, the market and the score.

**Ceiling by grade:**

| Grade | BTC/ETH ceiling | Rotation coin ceiling |
| --- | --- | --- |
| A+ (5) | 20x | 10x |
| A (4) | 15x | 8x |
| B (3) | 10x | 5x |

**The ceiling is halved when the market is hot:** 1h ATR% is more than 1.5× its 30-day average, funding is extreme, or major data is due within 24h.

**The pick, in order:**

1. **Floor:** the lowest leverage that keeps margin within half the account.
2. **Default:** the floor, rounded up to a whole number.
3. **Range:** Stavros may go anywhere from the floor up to the ceiling. The order card shows the range.
4. **Safety check, always:** liquidation must sit at least 1.25× the stop distance beyond entry. If it doesn't, size comes down.

**Learning loop:** the Auditor tracks leverage used vs outcome, slippage and liquidation proximity. It adjusts the ceilings only on evidence, never above Stavros's 20x.

### 3.6 Trade inputs — one recipe for Moonbag and Grok (Stavros, 2026-10-10)

Whoever gives Stavros inputs for a BloFin trade uses this exact recipe, so both work from one strategy:

- the Moonbag desk, for the coins it watches and alerts on in TradingView;
- Grok, for any coin Stavros asks about.

1. **Levels first.** Mark the real 4h and daily levels: prior swing highs and lows, range edges, levels touched 2+ times. No clear level means no trade.
2. **Entry at a level, after validation** (§3.3), never on the first touch or a wick. The best levels are external liquidity (swing highs/lows, previous day/week high/low). The best entries come after price sweeps one and closes back inside. Don't trade against the 4H candle that closed at 5 AM Phoenix if its body is at least half its range.
   - breakout: a 1h close beyond the level and the next 1h holds (or a retest holds);
   - rejection or reclaim: a sweep beyond the level, then a 1h close back inside.
   Use a market order only if price is within a quarter of the 1h ATR of the level. Otherwise use a limit at the level.
3. **Stop loss = invalidation:** just beyond the structure that proves the idea wrong — below the support a long depends on, above the resistance a short depends on (the swept wick, or the far side of the level), plus a buffer of half the 1h ATR. Use the 4h/daily structure, never a 15m/1h micro-swing. At least 0.8% from entry on BTC/ETH and 1.5% on other coins, and at least 1.5 × the 1h ATR. If TP1 is then under 2R, it is not a trade — never move the stop closer to make the numbers work.
4. **Take profit.** TP1 = the next real level in the trade's direction; take half there. TP2 = the level after that; the runner goes there.
5. **R:R at least 2:1** from entry to TP1 against entry to stop. If the next level is closer than 2R, there is no trade from here: wait for a limit at a better level, or skip.
6. **Risk at most 2% of the BloFin balance**, using the §3.2 table, and stop for the day at a 4% drawdown:
   - BTC/ETH: A+/A 2%, B 1%.
   - Other coins: A+ 2%, A 1%, B 0.5%.
   - Half risk after 2 losses in a row, until the next win.
   - One trade per coin, and all open trades together risk at most 15%.
   - If unsure of the grade, use the lower one.
7. **No chase.** If the coin is cooling (§3.1: 10%+ off its 3-day low or high, or more than 2 daily ATRs from its daily 20 EMA), there is no trade. Wait for a base.
8. **Size (the amount).** Coins = risk $ ÷ |entry − stop|. Notional = coins × entry.
9. **Leverage.** Use the lowest whole leverage that keeps margin at or below half the balance, within the ceiling (§3.5: BTC/ETH up to 20x, other coins up to 10x, lower for lower grades, halved in a hot market).
   - Liquidation must sit at least 1.25× the stop distance beyond entry. If it doesn't, cut leverage.
   - Margin = notional ÷ leverage. Isolated margin.
10. **Time and management.** Aim for about 72 hours; there is no time stop. At TP1, take half and move the stop to entry, then trail the runner (§3.7).

**The inputs, always in this form:**

```
<COIN> <Long|Short> · Entry <price> (<market|limit>) · SL <price> (<x.x>%) · TP1 <price> (<x.x>R, half) · TP2 <price>
Size <qty> <COIN> (≈ $<notional>) · Leverage <x>x isolated · Margin $<m> · Risk $<r> (<p>% of $<balance>) · Liq ≈ <price>
Why: <the level and the validation, one line> · Skip if: <what cancels it>
```

If the recipe says no trade (no level, R:R under 2, cooling, no risk budget left, or the 4% daily drawdown is hit), say **NO TRADE** and name the price where it would become one.

### 3.6b Order card (Risk Officer → Stavros)

Every TAKE TRADE NOW comes as a BloFin-ready card, worked out from the live balance and the open-risk budget:

```
TAKE TRADE NOW — <A+|A|B starter> · <score>/100 · <play>
Validated: <what printed>
• Coin: <BTC|ETH|SUI…>
• Side: <Long|Short>
• Entry: <Market now — valid up to X | Limit X>
• Stop: <price> (stop-market, x.xx% away)
• TP1: <price> (x.xR) — half, limit · TP2 <price> (x.xR) runner
• Size: <qty> <coin> (≈ $notional) — set BloFin's size unit to the coin
• Leverage: <x>x isolated (OK range <floor>–<ceiling>x) · margin $m · liq ≈ <price>
• Risk: $r (p% of $equity) · R:R 1:<rr> · open risk after this q% of 15%
• Lock-in: at +1R (<price>) move the stop to entry and take 25% off, or wait for TP1 (half off) — your call
After TP1 fills: move the stop on the rest to entry. Skip if: <reason>.
```

- **Optional sharper entry (fair value gap):** if the move off a sweep leaves a 15m fair value gap (a 3-candle gap), a limit at the gap edge may replace the market entry. The stop stays beyond the sweep, never just beyond the gap. The card shows both entries.
- **Entry:** market if price is within a quarter of the 1h ATR of the planned entry. Otherwise a limit order at the level. If a market entry drops TP1 below 2R, the card switches to the limit order.
- **NO TRADE** is logged on the dashboard and never pushed to your phone.

### 3.7 Trade management (Exit Clerk) — runner rule

1. TP1 is a limit order for half the position. Let it fill; don't close by hand in front of it.
2. When TP1 fills, move the stop on the rest to entry.
3. Trail the runner behind the last 1h swing until it is +3R, then behind the last 4h swing.
4. TP2 is the next 4h/daily level. Exit at TP2 or the trailed stop (no time stop; one review at 72h).
5. If Stavros moves a target or stop, the live fields (`current_stop`, `current_tp1–3`) are updated and the alerts follow.

**Lock-in: breakeven stops and partial profits (Stavros's usual management, 2026-10-09).** He often moves the stop to entry and takes 25–50% off before TP1, so gains aren't given back. The system supports it fully:

- **Recording.** Grok records every fill with `POST /api/moonbag/trades/{id}/exits` (percent or quantity, price, BloFin P&L and fee, reason). A stop move is `PATCH current_stop`. Each fill is its own immutable row in `trade_exits`. The trade keeps `qty_open`, `banked_pnl` and `banked_fees`. The last fill closes the trade: the exit price is size-weighted, P&L and fees are summed over every fill, and R = total P&L ÷ the original risk in dollars.
- **Risk budget.** Open risk counts only the size still open × the distance to the current stop. A trade with its stop at or past entry is **risk-free** and frees its share of the 15% budget for the other coin.
- **Alerts.** The coin keeps its two lines: STOP at the live stop ("breakeven, rest is risk-free") and the next target. They are not recreated for a partial.
- **Prompt.** At +1R with the stop still at the original level, the Exit Clerk sends one line naming the lock-in point (stop to entry, 25% off). It goes out once per trade and is never a nag.
- **Partial targets / runners** ("let winners ride"). A take-profit can be set for part of the position, e.g. "50% TP at 83,780". It is stored as `current_tp1` plus `current_tp1_qty`, and the rest is a runner. When the partial target fills, the second alert becomes RUNNER +3R. The Exit Clerk suggests trailing the stop to the last closed 1h swing once that locks in at least 0.5R more, at most once every 4 hours, and never says to close the runner by hand.
- **Corrections.** The same fill reported twice (same size, same price) is rejected. A mistaken fill on an open trade is voided with a reason, never deleted.
- **Learning.** The Coach compares what the lock-in earned with holding the original plan (`r_if_held_to_plan`). The weekly review reports whether breakeven + partials is adding or costing R across trades. A rule only changes with 10+ trades of evidence.

### 3.8 R:R — flexible, learned

- **Minimum 1:2** (Stavros, 2026-10-10).
- **Every Saturday the Auditor:**
  1. groups results into 2–2.5R, 2.5–3R and 3R+ buckets;
  2. checks how far stopped trades ran in our favour first;
  3. checks how often winners reached 3R;
  4. may raise the minimum once there are 10+ results per bucket.
- Never below 2 without Stavros.

### 3.9 Stavros's own calls

- Stavros still takes trades from his own read. Every BloFin trade is tagged `moonbag` or `own`.
- The Coach scores own trades with the same rubric after the fact.
- The Auditor compares the two. If own trades that score under 55 keep winning, the rubric is missing something, and that becomes a tested rule.

---

### 3.11 Ideas taken from outside guides (2026-10-11)

Stavros shared two outside guides: a "liquidity sweep → fair value gap → opposite liquidity" setup with a fixed morning routine, and a 4H-candle day-bias / correlation routine. He asked to keep our strategy and take only what adds value.

We tested the mechanical setup on BTC/ETH/SOL perps (1h Jan–Oct 2026, 15m Aug–Oct, fees included). The code is in `research/leverage_sweep_fvg/`.

**Run as written, it lost money on crypto in every version tested:** −0.1R to −1.1R per trade, in both halves of the period. So it is **not** adopted as a setup.

What held up as relative improvements, and is adopted:

- **Day bias from the 4H candle closing at 5 AM Phoenix (12:00 UTC).** Skipping trades against a strong one (body at least half its range) cut losses the most of any filter: −0.43R → −0.11R on 1h. It is now a −10 penalty (§3.4).
- **Sweep, not touch.** A level only counts once price has actually traded through it and closed back inside. Our reclaim / rejection validation already works this way; levels now favour external liquidity (§3.3).
- **Previous day and previous week highs/lows** join the level set (marked each Sunday for the week).
- **Fair value gap entry as an option** after a sweep (§3.6b). On 15m it beat entering at the reclaim close (small sample). The stop always goes beyond the sweep: stops just beyond the gap lost far more.
- **Process rules** (both guides):
  - Never trade without every criterion met.
  - Know exactly where you're wrong before entry.
  - Judge the system by expectancy (average R) and rule-following, not win rate.
  - If you're breaking rules, stop and fix it. The Coach flags 2+ rule breaks in a week and suggests pausing your own trades until the Saturday review.

Tested and **not** adopted:

- **Minimum 3R:** 2R beat 3R in every version.
- **9:30–12:00 ET window only:** worse results and too few trades in a 24/7 market.
- **Stops just beyond the gap:** much worse.
- **BTC/ETH/SOL "one swept, the others didn't" filter:** too few trades to judge; it stays a note in a signal's evidence.

Not part of the strategy at all: prop-firm and income claims. Risk was later set to 2% per trade with a 4% daily drawdown stop (Stavros, 2026-10-11).

### 3.12 Limit orders — resting orders at the levels (Stavros, 2026-10-12)

Stavros: "I want to introduce limit orders ... it should overall be similar to market trades, but these should make it better and should have really good R:R and win %."

**What was tested** (research/limits, BTC/ETH/SOL + rotation top 5 NEAR/TIA/ENA/SEI/SUI, 1h bars Jan–Oct 2026, maker 0.02% / taker 0.06% + slippage, a fill and a stop in the same bar counted as a loss). Every 4 hours, per coin: the nearest support (long) or resistance (short) from the 4h swings of the last 10 days and the previous day and week high/low, 0.3–2 daily ATRs from price.

| Variant (same levels, stop rule and targets) | Trades | Avg R | Profit factor | Both halves |
|---|---|---|---|---|
| Market entry after a 1h close back (the desk's validated bounce) | 203 | −0.03 | 0.96 | no |
| Limit AT the level (no trend filter, no break-even move) | 517 | −0.08 | 0.90 | no |
| Limit half a 1h ATR THROUGH the level (adopted) + daily-EMA50 trend + break-even at 1.5R | 278 | **+0.13** | **1.24** | **yes (+0.09 / +0.17)** |

Outcomes of the adopted version: 24.5% reach the target (average +2.75R), 23.4% scratch at break-even, 52.2% stop. It is an R:R strategy, not a high win-rate one: about 1 trade in 4 pays 2.75R, about half of the rest are scratched. The edge comes from where the order fills: a limit through the level only fills when the level is swept, which is exactly where the market entries in §3.6 kept being stopped. Without the no-chase filter the result was −0.16R; placing only every 8h instead of every 4h dropped it to +0.08R; every 12h, 0R.

**The recipe** (Moonbag and Grok use the same one):
1. Level: 4h swing low/high of the last 10 days, previous day or previous week low/high, 0.15–2 × ATR14(1D) from price (was 0.3 until 2026-10-13 — closer levels fill more often and did better, §3.13).
2. Trend: longs only above the daily 50 EMA, shorts only below. Never on a cooling coin.
3. Limit: 0.5 × ATR14(1h) through the level.
4. Stop: the larger of 0.8% (BTC/ETH/SOL) / 1.5% (others) and 1.5 × ATR14(1h) beyond the fill.
5. TP1: the next opposite level, at least 2R. Stop to entry (plus fees) once price has been +1.5R.
6. Cancel after 24 hours, or as soon as price reaches TP1 before filling (backtest: a 24h expiry gave +0.11R, 48h +0.13R; 24h keeps the orders close to price).
7. Risk 2% (BTC/ETH/SOL) / 1% (others) while the setup is at paper stage; a DCA ladder shares one stop and one 2% budget.

**How it runs.** lev_limit_plan() runs this recipe on the stored 1h candles after every 4h close and places one *paper* limit per coin; lev_limit_resolve() replays them (fill, break-even, target, stop, expiry). The Desk Lead sends at most 3 LIMIT SETUP messages a day (plan ≥ 2.5R, BTC/ETH/SOL or an in-play coin). His own resting limits are recorded by Grok (POST /limits); the sync puts a TradingView alert at each limit price and lists the coin under "Open limits" in the Moonbag – Crypto Futures watchlist. A trade recorded at a limit's price fills that limit automatically.

**Feedback loop.** The Saturday review compares paper results with the backtest (step 3e), by level type, side and coin, and his own limits against the recipe. Playbook 'limit_sweep' moves from paper to live after 10 resolved paper limits averaging above 0R, and is retired after 20 averaging below −0.1R. Parameter changes only through a research rerun that holds on both halves and on core and alts.

### 3.13 Scalps, 15-minute entries and the Monday range — tested 2026-10-13

Stavros: "the A+ setups are range edges and they are not as likely to hit — I want smaller time frames, smaller scalps, higher leverage is OK ... what about 1h or 4h bias using 15m for entry? ... what if you use the Monday high/low range?"

Tested on Binance perps with fees (taker 0.06% + slippage on market orders and stops, maker 0.02% on limits and targets).

| Idea | Data | Trades | Avg R after fees | Verdict |
|---|---|---|---|---|
| 15m trend pullback under a 4h + 1h trend (5 AM–3 PM) | BTC/ETH/SOL 15m, Aug–Oct | 120 | −0.29 (−0.08 before fees) | no |
| 15m sweep-and-reclaim of 1h / day / Asia levels, 4h trend | same | 780 | −0.22 (+0.07 before fees) | no |
| same, limit back at the swept level | same | 647 | −0.16 | no |
| same, 0.6% minimum stop | same | 532 | −0.07 | no |
| New York opening-range breakout (13:30–14:00 UTC) | same | 81 | −0.12 (0.00 before fees) | no |
| Monday high/low as the only levels (limit recipe) | 8 coins 1h, Jan–Oct | 199 | −0.17 | no |
| Monday high/low added to the normal levels | same | 276 | +0.12 (vs +0.13 without) | no gain |
| Tighter limit stops (0.4–0.5%, 1 × 1h ATR) for higher leverage | same | 305 | +0.02 | worse |
| **Limit recipe with levels from 0.15 daily ATR (closer)** | same | **386** | **+0.12 (BTC/ETH/SOL +0.21)** | **adopted** |
| **Quick mode: target capped at 2R, stop to entry at +1R** | same | **362** | **+0.09, max drawdown 14R** | **option** |

Why scalps fail here: on a 0.4–0.5% stop, the round trip of fees is 0.25–0.3R, so a setup needs more than that in raw edge just to break even. The best 15m setup (sweep-and-reclaim) had about +0.07R. Leverage does not change this: it changes size, not R. Getting more trades that hit comes from closer levels and a nearer target, not a smaller timeframe.

What the closer levels change: the limit can sit at a level 0.15 daily ATRs away (for BTC about 0.35% from price instead of 0.7%), so more orders fill during the session; both halves stayed positive (+0.14 / +0.10R) and BTC/ETH/SOL improved to +0.21R per trade. Quick mode suits his scalping style: about 1 in 4 hits 2R, about 1 in 3 is scratched at entry, and its worst drawdown was 14R against 19.5R for the full-target version.

Stavros's own trades (11 to 2026-10-13): +4.9R in total, +0.45R average — better than every system so far, on a small sample. His winners were entries at a range edge with a ~0.5% BTC stop (10/6 short +2.1R; 10/9 long trailed to +2.65R). What cost him: closing four winners by hand at +0.19 to +0.29R before the target, and two entries with no trigger (−1R each). The loss journal tracks both.

The feedback loop: the 15m scalp setups are in the playbook as 'scalp_15m' (retired) and are re-tested monthly while 15m history builds up (TradingView gives about 10 weeks of 15m bars); they come back only if net positive on both halves. The limit recipe and quick mode are tracked weekly in step 3e of the Saturday review.

### 3.10 X posts (Publisher → Grok)

Posts are filled from fixed templates by the website. No model writes them. **R and % only**: no dollar amounts or account size (Stavros, 2026-10-09). Grok fetches `GET /api/moonbag/x-posts`, posts them and marks them posted.

- **Morning brief** (once a day, after 6 AM Phoenix):

  ```
  Moonbag morning brief · Thu, Oct 9
  Market: <risk> · bias <bias>
  BTC <price> · range <low>–<high>
  ETH <price> · range <low>–<high>
  Rotation leaders vs BTC: <A> · <B> · <C>
  <COIN>: <side above/below level> …
  Not financial advice.
  ```

- **Trade opened** (when Grok records any BloFin trade):

  ```
  New trade: <COIN> <SIDE> · Moonbag <grade> (<score>/100) | own read
  Entry <e> · Stop <s>
  TP1 <tp1> (<x>R) · TP2 <tp2>
  Risk <p>% of account · R:R 1:<rr> · <lev>x
  Not financial advice.
  ```

- **Trade closed:**

  ```
  Closed: <COIN> <SIDE> · <±x>R (<±y>% of account)
  Entry <e> → exit <x> · held <h>h
  Exit: <reason> · Call: Moonbag desk | own read
  Not financial advice.
  ```

- **Trade update** (a partial taken, or the stop moved to breakeven or into profit):

  ```
  Trade update: <COIN> <SIDE>
  Took <p>% off at <price> (<±x>R)
  Stop at breakeven — the rest is risk-free
  <q>% still running to TP1 <tp1>
  Banked <±x>R (<±y>% of account)
  Not financial advice.
  ```

Each post is at most 280 characters. Optional lines are dropped first.

---

## 4. Book 1 — Robinhood (Agentic account ending 0349)

### 4.1 What it trades

- US stocks and ETFs (price ≥ $5, average volume ≥ 1M).
- 1x inverse ETFs (SH, PSQ, DOG, RWM) for bearish views.
- Long-only. No options, no margin, no leveraged ETFs, no crypto. Never VRF.

### 4.2 Hard limits

- $12 combined loss box. Soft halt at $90 equity.
- Two fills a week, one symbol per day.
- Max 20% of the account per position, 40% per theme, 80% gross exposure, 5% open risk, 6 positions.
- Down 8% from the peak or 3 losses in a row: stop and review.

### 4.3 Equity setup score (0–10)

| Part | Points |
| --- | --- |
| Daily and weekly trend agree | 2 |
| Entry at a real level (breakout retest, prior high/low, 50-day) | 2 |
| R:R to target 1: 2R+ = 2; under 2R = no trade (2:1 minimum, 2026-10-11) | 2 |
| Relative strength vs SPY (20 days) | 1 |
| Volume confirms | 1 |
| In a Moonbag theme | 1 |
| Evidence (backtest / paper) | 1 |

- **A (8+):** full size.
- **B (6.5–7.9):** half size.
- Both must fit inside the $12 box and have entry, stop, size and invalidation.
- Below B is paper only.

### 4.4 Flow

1. Strategist writes the equity thesis and handoffs.
2. Level Watch checks the levels intraday.
3. Executor places the order and records the fill.
4. Coach runs the lookback after the close.
5. The Auditor reviews on Saturday. "A is not static": the definition is re-tested weekly with backtests and paper trades.


### 4.5 Long-term sleeve — Moonbag Holdings (2026-10-09)

Full thesis: `docs/strategy/LONG_TERM_THESIS.md`.

- **What it is.** 25% of the Robinhood account, bought by weekly DCA over 8 weeks from 2026-10-09 (then every Monday). It draws on Rich Dad, The Entropy Trap and where the US government is taking equity.
- **Core holdings and target weights:** SPCX 25 · TSLA 20 · GLD 12 · NVDA 10 · INTC 8 · SLV 8 · MP 7 · GDX 5 · FCX 5. Each name has its own break rule.
- **Separate rules.** Buys don't count toward 2 fills a week, one symbol a day, A-setups only or the $12 box. No hard stops: exits only on a written thesis break, confirmed by the weekly review and Stavros.
- **Caps (database-enforced):** sleeve ≤ 25% of equity · one name ≤ 30% of the sleeve · SPCX + TSLA ≤ 45%. Account-wide limits still apply: $90 soft halt, 80% gross exposure, never VRF, no crypto.
- **FUD boost.** SPCX, TSLA and NVDA only: a week's buy doubles when the name is 15%+ below its 26-week high and its thesis is intact. Metals never get a boost, per the backtest.
- **Watchlist** (government-backed or on-thesis; bought only after promotion) and **avoid list** (entropy losers, tracked as paper shorts) live in `lt_universe`.
- **Feedback loop.** The Saturday review scores the sleeve against SPY bought on the same dates, checks the FUD boost against plain DCA, grades the paper shorts, runs the entropy scan ("who just lost pricing power?") and checks each watchlist name's add-rule.

### 4.6 Book 3 — Coinbase crypto trend book (2026-10-10)

Full strategy, research and backtests: `docs/strategy/COINBASE_STRATEGY.md`. Machine form: `risk_config` (venue `coinbase`), `cb_universe`, `cb_signals`, `cb_backtest()`.

- **What it is.** The agentic Coinbase account (started with $100), connected to Grokbot. It is spot only: long or cash (USDC). It works like Robinhood: Moonbag decides and hands off (`broker: coinbase`), Grok executes and reports, and everything shows on `/dashboard/coinbase`.
- **Who directs it.** The Strategist heads Book 3 exactly like Book 1: its daily cycle reviews the Coinbase desk's signals, fills and paper book; Grok executes both books' handoffs. One strategist, one self-improvement loop, risk limits untouched.
- **Coins (v2, open universe).** 36 Coinbase USD pairs are scanned and paper-traded daily (`cb_paper`). BTC, ETH and SOL trade live at 2% risk (5% until 2026-10-11) with a 4% daily drawdown stop. **Alts are OFF for live trading (Stavros, 2026-10-10: not keen on alts for the agentic account; he trades alts himself on BloFin)** — they stay scanned and paper-traded so the record keeps building; `risk_config.alts_live` turns them back on. If switched on, an alt trades live only after its own paper record shows 4+ trades averaging +0.5R or better — at half risk (1%), only while BTC is bull, after core coins. Opening all coins at full risk cut average R from +1.15 to +0.30 and deepened the worst drawdown to −64% in the backtest; the earned-status rule kept average R at +1.10 (2021–26) and raised CAGR to 37.8% vs 32.6% (2023–26). See COINBASE_STRATEGY.md §4b.
- **Regime, per coin.**
  - **BULL:** a daily close above 1.02 × 200-day SMA.
  - **BEAR:** a daily close below 0.97 × 200-day SMA. That means exit, cash, no longs.
  - This is the "flip bearish" rule. Stavros's 100–105k BTC top is used as a profit-taking zone, not as a forecast.
- **Entry.** A BULL coin closes above its prior 55-day high. Market buy after the 00:00 UTC close; Grok never pays more than 1% above the handed-off price.
- **Stop.** 3 × ATR(14) below entry.
- **Take profit and trail.** TP1 sells half at 3R. Then the stop on the rest goes to entry + 1.2%, and the runner trails the prior 20-day low (the 10-day low once BTC trades above 100k).
- **Risk.**
  - 2% of equity per trade, including fees (5% until 2026-10-11); new entries stop for the day after a 4% drawdown.
  - 15% max open risk; one position per coin, max 3. Alts: half the per-trade risk.
  - Risk halves after 3 straight losses.
  - New entries pause if equity is 20% below its 30-day peak.
  - The database enforces all of this (`moonbag_check_handoff_coinbase`).
- **Why this system.** On Coinbase data with fees, 2021–26, it returned 29.6% a year with a −18.9% worst drawdown, against 19.6% a year and −76.7% for buy-and-hold. All 36 parameter variants tested were profitable in both 2017–20 and 2021–26.
- **Separate from Book 1.** The Robinhood no-crypto rule stands. Coinbase is the only place Moonbag owns spot crypto.

---

### 4.7 Theme roadmap and sector rotation (2026-10-11)

Stavros shared two references: a three-phase theme roadmap and a list of 20 popular ETFs with what they hold and their 5-year returns. Both are now in the database, so every agent works from the same map:

- `theme_map`: 52 sectors, each with its tickers and the ETF that tracks it.
- `etf_watch`: 45 ETFs, each with what it invests in and the stated 5-year CAGR.

| Phase | Years | Theme | Example sectors (proxy ETF) |
| --- | --- | --- | --- |
| 1 | 2026–27 | AI & power buildout | chips (SMH), software (IGV), cyber (CIBR), data centers (DTCR), hyperscalers (XLK) |
| 2 | 2027–29 | Energy & resources | utilities (XLU), grid (PAVE), nuclear (NLR), copper (COPX), rare earths (REMX), gold/silver (GLD/SLV) |
| 3 | 2028–30+ | Physical AI | robotics (BOTZ), defense/drones (ITA), space (ARKX), quantum (QTUM), biotech (XBI/IBB) |

**The roadmap is a hypothesis; the rotation scoreboard is the evidence.**

- **Each Saturday** the weekly review ranks every ETF by its 3-month return against SPY and checks whether it is above its 200-day average. It stores the result in `sector_rotation`.
- The scoreboard shows which phase is actually leading, and re-orders the TradingView watchlist "Moonbag – Rotation (themes & ETFs)".
- **First reading (2026-10-09):**
  - Leading: GDX +17.8%, IGV +17.6%, CIBR +15.9%, COPX +11.4%, XLE +10.8% vs SPY.
  - Lagging: rare earths, utilities and nuclear (REMX −24.0%, XLU −13.4%, NLR −9.5%).
  - So Phase 1 software is still leading. Phase 2 power is not yet, apart from copper, gold and energy.

**How it's used:**

- **Robinhood equity setups:** the theme point in the setup score (§4.3) also counts a stock in a `theme_map` sector whose ETF is in the top third of the rotation and above its 200-day average (a "rotation tailwind"). The daily cycle looks for equity ideas there first.
- **The morning brief** shows the top 3 leading ETFs.
- **Holdings:** a held or DCA name whose sector ETF is in the bottom third and below its 200-day average is flagged on Saturday as a headwind. It is never sold automatically.

**What was tested and not adopted.** A monthly momentum rotation was tested on 33 of these ETFs from 2015 to 2026 (hold the top 3 by 3-month return):

- It made 15.1% a year vs SPY's 12.0%, with a −36.7% worst drawdown.
- Risk-adjusted it was no better than SPY (Sharpe 0.69 vs 0.73), and it lost to QQQ (18.4%, Sharpe 0.88).
- It lagged SPY in 2015–20 (9.4% vs 10.5%).

So it is a scoreboard and a filter, not an allocation engine. The 5-year CAGR column is backward-looking: buying last period's winners is what the test above measured.

## 5. Daily brief (one format, every day)

**MOONBAG MORNING BRIEF**, in this order:

1. THE MARKET
2. BTC
3. ETH
4. ROTATION: the top 5 and the 2 in play
5. STOCKS
6. TODAY
7. YOUR BOOKS
8. YESTERDAY

Every coin shows its price, bias, its **range lines low / high** (the same two lines as TradingView), and its plays. The same text answers "daily summary" in the dashboard, in Grok and in Claude, from `GET /api/moonbag/briefing`.

---

## 6. Feedback loops

| Loop | Agent | When | What changes |
| --- | --- | --- | --- |
| Every setup recorded and paper-tracked | Gate | Hourly | Evidence points |
| 24h lookback per trade | Coach | After each close | Habits, suggestions |
| C-setup review | Auditor | Saturday 6:29 | Which component held back setups that worked |
| Strategy review: backtests, calibration, R:R buckets, leverage, Moonbag vs own | Auditor | Saturday 6:59 | Strategy version, playbook status, minimum R:R, leverage ceilings |
| Rotation re-rank | Scout | Daily | The 5 coins and the 2 in play |
| Coinbase signals vs live fills (`cb_signals`), `cb_backtest` re-run, R:R buckets | Coinbase desk (daily) + Auditor (Saturday) | Daily / weekly | Coinbase rules; a risk-ladder proposal to Stavros after 15 closed trades |

**Changes on evidence only:** 10+ resolved results, or a backtest that holds on two coins. Risk %, the 20x ceiling, the 2-trade / 15% open-risk limit and the stop minimums change only when Stavros says so.

---

## 7. Change log

- **2026-10-13 (v21):** §0.1: strategy of the week (weekly league picks one winner) and no trade cap.
- **2026-10-13 (v20):** §3.13 — 15m scalps (trend pullback, sweep-and-reclaim, NY opening range) and the Monday range tested: not adopted (negative after fees / no gain). Limit levels allowed from 0.15 daily ATR (was 0.3): +0.12R over 386 trades, BTC/ETH/SOL +0.21R. Quick mode (2R target, break-even at +1R) added as an option.
- **2026-10-12 (v19):** Monday is plan day (Stavros: "it seems to work better than force market"): no TAKE TRADE NOW or LIMIT SETUP pushes on Mondays; the daily cycle writes a WEEK PLAN (bias, levels, the 2–3 setups to hunt, events, risk for the week) that Tuesday–Friday follow. Trading-hours board on the leverage page, refreshed hourly 5 AM–3 PM Phoenix on weekdays (lev_board_refresh()): BTC/ETH/SOL and the top-5 movers each show a range low (long zone) and range high (short zone) = the TradingView RANGE lines, with the limit-sweep plan, grade (A+ = with the daily trend, ≥ 3R, 0.3–2 daily ATRs away) and how close price is. A+ setups are shown only from strategies with a positive record. (The limit backtest itself showed no Monday weakness — +0.29R on 27 Monday trades — so the paper loop keeps running on Mondays and the weekly review tracks whether plan days help his own trading.)
- **2026-10-12 (v18):** Limit orders (§3.12, §0.2): resting limits half a 1h ATR through the level, backtested +0.13R per trade (PF 1.24, both halves positive) vs −0.03R for market entries on the same levels; paper loop via lev_limit_plan()/lev_limit_resolve(); his limits recorded via /limits with TradingView alerts and an "Open limits" watchlist section. Worked example in §0.2 updated to the v16 stop minimum.
- **2026-10-12 (v17):** The stop is the invalidation (Stavros: "stops being below levels, essentially invalidation — they were too close on last stop"): below the support a long depends on / above the resistance a short depends on, never pulled closer to reach 2R. Current levels, alerts and setups are relayed from GET /levels in one fixed format.
- **2026-10-12 (v16):** Wider stops and no time stop (Stavros: "stop losses might be too tight"; "no time limit but that is what we aim for"). Evidence: 11 of 12 resolved desk signals were stopped and 7 of those were +0.5R or better first; his BTC long of 2026-10-12 (stop 0.51%, 5x) was stopped in 14 minutes. Backtest (breakout engine, 1h, 2R target): avg R went from −0.31 (BTC) / −0.31 (ETH) with a 1 × ATR stop to −0.10 / −0.16 with 1.5 × ATR, on both coins. New stop: beyond 4h/daily structure + ½ × 1h ATR, minimum 0.8% BTC/ETH and 1.5% other coins, and at least 1.5 × the 1h ATR. Risk stays 2%: a wider stop means a smaller position and lower leverage. Fewer setups will clear 2R; that is intended. The 72h time stop is gone: aim for about 72h, one review line at 72h.
- **2026-10-11 (v15):** Theme roadmap and sector rotation (§4.7):
  - `theme_map`, `etf_watch` and the weekly `sector_rotation` scoreboard;
  - rotation-tailwind theme point for equity setups;
  - Leading ETFs line in the morning brief;
  - TradingView rotation watchlist.
  A monthly ETF momentum rotation was backtested and not adopted.

- **2026-10-11 (v14):** The Moonbag Playbook added as §0: one page per book (BloFin, Coinbase, Robinhood trading, Robinhood holdings), the universal rules, Grok's quick-inputs checklist for any coin, the scoreboard, and what is not part of the strategy. No risk number changed. Two lines brought in line with the fixed rules: §3.2 now names the 4% daily drawdown stop as the only daily limit, and §4.3 scores a Robinhood trade under 2R as no trade.
- **2026-10-11 (v13):** Risk per trade is capped at 2% on every book (BloFin 4% → 2%, Coinbase 5% → 2%; Robinhood stays at 1%), with a 4% maximum daily drawdown. Minimum 2:1 R:R stays. The Strategist writes the one-page Playbook for all asset classes (§0).
- **2026-10-11 (v12):** Took the useful parts of two outside guides (§3.11):
  - −10 penalty for trading against the 5 AM 4H candle;
  - external-liquidity levels, including previous day/week highs and lows;
  - optional fair value gap entry;
  - process rules.
  The guides' full sweep→FVG setup was backtested and not adopted: it lost money after fees on crypto.
- **2026-10-11 (v11):** Leverage desk changes (Stavros):
  - One input recipe for Moonbag and Grok (§3.6): amount, leverage, TP and SL all come from levels.
  - Minimum 2:1 R:R; risk at most 4% per trade.
  - No chase: a coin 10%+ off its 3-day low or high is cooling, with no plays.
  - Range-line alerts are silent. The phone only gets TAKE TRADE NOW (A/A+) and alerts on open trades.
  - B setups are dashboard-only.

- **2026-10-10 (v10):** Coinbase alts switched off for live trading at Stavros's request (`risk_config.alts_live = false`); BTC/ETH/SOL only live, all 36 coins still paper-traded. Desk Lead now delivers every TOUCH / DECISION / TAKE TRADE / management line as an "MB NOTE" TradingView alert as well.

- **2026-10-10 (v9):** One Strategist heads both agentic books (Robinhood + Coinbase); the Coinbase desk, Executor (Grok, both accounts) and the Auditor (its weekly self-review) report to it. Coinbase v2: open universe — 36 coins scanned and paper-traded, alts earn live status (4+ paper trades, avg ≥ +0.5R) at half risk while BTC is bull (§4.6, COINBASE_STRATEGY.md §4b). No risk limit changed.

- **2026-10-10 (v7):** Book 3 — Coinbase crypto trend book (§4.6, COINBASE_STRATEGY.md).
  - Spot BTC/ETH/SOL, regime-gated 55-day breakout, 5% risk, 15% open risk.
  - Grok executes Moonbag handoffs (`broker: coinbase`). A new Coinbase desk (hourly) and the weekly review run the feedback loops.

- **2026-10-10 (v6):** 2-open-trade cap removed (Stavros: "no 2 trade limit").
  - Still in force: one trade per coin, 15% combined open risk to the stops (a risk-free trade counts 0), margin cap, 2-loss half-risk, 15% drawdown pause.
  - Desk Lead: every fired MB alert gets an answer (touch line + one decision), runs at :02 after each 1h close, keeps the TradingView watchlist in sync.

- **2026-10-09 (v5):** Long-term sleeve added (§4.5 and LONG_TERM_THESIS.md).
  - 25% of the Robinhood account, weekly DCA over 8 weeks, with its own rules.
  - Lists: 9 core names, 12 watchlist names, 10 avoid names (paper shorts).
  - Week 1 buys: SPCX, TSLA, GLD.

- **2026-10-09 (v3):** breakeven stops and partial profits are first-class.
  - New `trade_exits` table and endpoint.
  - Open risk counts only the size still open.
  - Lock-in line added to the order card, plus the +1R prompt.
  - "Trade update" X post.
  - Leverage page fix: a score component stored as a group no longer crashes the page.

- **2026-10-09 (v2):**
  - **Alerts:** two lines per coin (range high/low) on TradingView and the home page; a coin with an open trade swaps to stop + target, and other coins are unaffected.
  - **Positions:** max 2 open, 15% combined open risk.
  - **X posts:** templates for Grok.
  - **Agents:** reorganised as heads → agents → tasks with run logging and a quiet-run sentinel; Scout split into its own 4h task; Robinhood intraday check no longer analyses crypto and only messages on change.
  - **Cleanup:** 14 old Agentic stock alerts deleted from TradingView.

- **2026-10-09 (v1 of this file):** added rotation coins (top 5, 2 in play), flexible leverage by grade/coin/market, this single strategy file, and the agents map.
- **2026-10-08:**
  - Order card added.
  - Level plays: alerts always set.
  - Daily loss limit removed.
  - Trade-only pings.
  - Own-call tracking.
  - Confidence v2 so B/A setups can reach Stavros.
