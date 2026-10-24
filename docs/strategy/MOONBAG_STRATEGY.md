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

**NORTH STAR (Stavros, 2026-10-15): "The goal is to make money, so lets make sure that is the north star of our strategy — but while managing risk and improving confidence so we get good at long term investments, and also trading crypto futures." Goal: $10,000,000.** The two kinds of money are run differently. Coinbase and Robinhood are LONG-TERM HOLDS: "that's where i want to put money and let it grow long term". They are bought on dips, a stop is fine only as a wide thesis line, and there are no tight stops or quick profit-taking (§0.3, §0.4). BloFin leverage is TRADING: "my lev trades need strict r:r and risk management". Every lev trade gets a real stop, at least 2R, 2% max risk and the drawdown stops (§0.2). Each weekday morning the desk writes an open plan for the leverage desk (§0.2b) and grades yesterday's, so confidence is earned by a track record rather than claimed. The $10M bar at the top of the leverage page shows all three accounts. Deposits are recorded separately, so new money never counts as trading profit.

Written by the Strategist, 2026-10-11, at Stavros's request: "a clearly defined strategy for all asset classes". This section is the short version. Sections 3 and 4 hold the detail. If they ever disagree, the risk numbers in §0.1 win.

Every rule below comes from our own backtests, live trades and lookbacks. Where the evidence is thin, it says so and the rule stays cautious.

### 0.00 MAIN STRATEGY — the Woods framework (adopted 2026-10-16)

Stavros, 2026-10-16: "i was able to get my mentor and a trader that ive looked up to for a while to give me a run down on strategy ... traders typically only use one and get really good at it ... we just repeat this strategy and can still test others but this is main strategy." This section governs the leverage desk; everything else in §0.2–§3 is a tool inside it or a paper test beside it.

1. **Anchor:** BTC drives every trade. BTC below its key reclaim level (the line in the sand) makes alt longs LOWER QUALITY — a warning on the card, not a block (CR-9, Stavros 2026-10-23: "Yes all those sound good"; he doesn't want blanket directional filters). Each setup still has to pass its own trigger (rule 5) and the hard stops (4% daily stop, a closed 15m back through the swept level, no trading the news-spike candles).
2. **Top-down:** weekly/daily = zones. 4H = setup. 1H/15m = entry only.
3. **Levels:** order blocks and demand zones (where buyers bid before a rally), supply zones (where sellers stopped it), liquidity pools (equal lows/highs, last week's low/high, range lows/highs).
4. **No-man's land:** no trades in the middle of a range or of an order block. Trade the edges or the break. Expect chop before big moves.
5. **Long trigger (all required):** (a) sweep of a low or liquidity pool, (b) close back above it (SFP), (c) 4H RSI bullish divergence from oversold, (d) 1H/15m trigger (higher low or demand candle). Shorts mirror.
6. **News:** don't front-run CPI/PPI/FOMC. Trade the reaction after the sweep.
7. **Entry:** limit orders at zone edges plus alerts. Skip the trade if price doesn't come to the level.
8. **Stop:** just past the swept wick or extreme. If the level is reclaimed against us, we're wrong.
9. **Management:** take most off at the first pop (70%), stop to break-even, let the rest run. (No minimum R since 2026-10-16 — Stavros: "no minimum r - but i will always aim for 2:1". The card shows the R; a first pop under 2R is flagged "under your 2:1 aim — your call".)
10. **Hedge:** when a BTC long isn't fully confirmed, hedge with a correlated short (ETH, about half the size; close it on 4H acceptance).
11. **Bias flip:** bullish only on acceptance (a 4H close that holds) above the level that last rejected price — not on a touch.
12. **The map:** Woods' levels live in `woods_levels` (GET/POST /woods). 10/15 map: BTC swept ~80K and filled 79,710 + the 1D demand zone; 82,400–82,800 is the line in the sand — below = chop/neutral; 4H acceptance above 82,800 = bullish, possible squeeze through the highs. ETH 2,590 unconfirmed.

**House risk rules unchanged:** 1–2% risk by grade, 4% daily drawdown stop, ≤ 15% open risk, cross margin with the stop on the exchange at entry.

**How Moonbag runs it:** the 5:15 AM open planner writes the daily Woods map (anchor, zones, checklist a–d per coin and side, news, hedge, the edge limits) at the top of the leverage desk; the hourly Desk Lead checks the four-part trigger and sends "WOODS A+" cards only when all four are true (blocked for an alt long under the BTC line, mid-range entries and release windows), plus a flip watch on the BTC line; Grok's fast-inputs card adds the anchor, no-man's-land and hedge lines and the 70/30 split.

**Evidence so far (research/woods, mechanical rules only):** all four legs −0.12R over 74 trades; without the divergence leg +0.05R over 186 (both halves ≥ −0.04); the 70%/BE/runner management beat a single 2R target by ~0.15R on the same entries. The discretionary zone reading isn't testable — live results (playbook `woods`, scored weekly in the strategy league) decide, and `woods_nodiv` runs in paper beside it.

**THE MENTORS — ELIZ = MACRO, WOODS = MICRO (Stavros, 2026-10-16):** "i really like eliz on macro and woods on micro - i follow them both closely ... pretend this is their last cycle and lets get as much knowledge about how they think so we can keep it going when they are gone." Eliz's weekly structure decides WHERE (her range, buy zone with confirmation, the weekly close that shifts the structure, macro resistance, invalidation); Woods decides WHEN (anchor, four-part trigger, limits at edges, 70% at the first pop). Every post they make is kept verbatim (`mentor_posts`), distilled into levels (`woods_levels` source eliz/woods), principles (`mentor_principles`, their words + how Moonbag applies them) and testable calls (`mentor_calls`, graded nightly → `v_mentor_record`), and logged in `strategy_changes`; rule changes from a post are only proposed. The Woods machine shows Eliz's macro line and scores it (10 points: buy-zone longs / range-top shorts highest, mid-range chasing lowest). If either stops posting for 14 days the Saturday review writes the map in their style, labelled as Moonbag's. Full method: docs/strategy/MENTORS.md · moonbag.ai/dashboard/mentors. Current Eliz map (wk10): BTC 70–74k buy zone (confirmation only) · 87–88k range top · 97–100k macro resistance.

**WHAT THEY LOOK AT → WHAT MOONBAG LOOKS AT (X scrape, adopted by Stavros 2026-10-17):** "meshing the minds to create a super trader." Woods machine levels now include time levels — yearly open (20 pts), monthly open and previous month high/low (18), last Monday high/low (15), weekly open (12) — and the 0.75–0.786 retracement of the last 4H impulse leg (fib, 10 pts, `FIB✓` on limits). The 4H EMA200 is tracked on paper only (`EMA200✓` flag, 0 pts) until the weekly review shows ≥ 0.15R better on 10+ resolved limits. Confidence = points × 100/130. **Monday Mentor Lens** (open planner v7): an 8-point checklist (weekly 3 boxes, time levels, zones, liquidity, trigger state, momentum/fib/EMA200, news week, mentors) produces Moonbag's weekly bias DRAFT in `weekly_bias`; Stavros confirms or overrides it through Grok (`POST /api/moonbag/bias`), and the bias scores 10 pts in woods_scan. The Saturday review grades his call and the draft separately (v20). A Saturday 6:15 AM scrape of @eliz883 / @robw00ds (built-in browser on Stavros's computer; promos dropped) feeds the review's mentor intake. **Market context** (Stavros, 2026-10-17: "if usdt is down market is up and vice versa"): TOTAL and USDT dominance on the 4H (TradingView CRYPTOCAP history, kept fresh from CoinGecko) plus ETH/BTC from BloFin — USDT.D falling + TOTAL rising (24h and 7d) = risk-on, the mirror = risk-off, otherwise mixed; ETH/BTC up = alts leading. Shown as a Market line on the Woods machine and flagged CTX✓ on limits, on paper (0 pts) until the weekly review shows ≥ 0.15R better on 10+ resolved. Not adopted: a post-CPI wait card.

**THE WOODS MACHINE + OWN DATA FEED (Stavros, 2026-10-16):** "I love the woods map. I want you to really hone that in and make it a machine. accuracy and r:r ... make sure i always know the time of this data, if i use bad data its a bad trade ... always have limits with confidence score that way i can throw them in if i agree."
- **Data:** Moonbag pulls CLOSED BloFin perp candles (15m / 1h / 4h, every lev coin) into the database every 5 minutes (`lev_candle_sync`, pg_cron) — the exchange he trades, no TradingView dependence (TradingView's rate limit blinded 5 Desk Lead runs on 10-16). Every card, ticket and plan shows the time of its newest bar; stale data (> 45 min) turns the stamp red and nothing is sent from it.
- **Machine:** every 15 minutes `woods_scan` runs the four legs on closed bars for BTC/ETH/SOL (sweep of a low/high pool → close back → 4H RSI divergence from < 35 / > 65 → 1H trigger within 12h, wick held), the BTC anchor from Woods' line in the sand, and one resting limit per coin and side at the nearest pool OUTSIDE no-man's land: entry ¼ ATR1h through the pool, stop ≥ 1 × ATR1h and the house minimum, TP1 = the first opposing level ≥ 1R (70%), TP2 ≥ max(3R, TP1 + 1R). Confidence 0–100 = level quality 25 (Woods > previous week > plan > previous day > 4H swing) + anchor 20 + R:R 20 + 4H RSI 15 + trend 10 + track record 10; A+ ≥ 75, A ≥ 60, B ≥ 45. A/A+ limits are paper-tracked (`woods_limit`) and graded by the Saturday scorecard; muted automatically if their record is ≤ 0R (POSITIVE R ONLY).
- **Alerts:** TradingView carries only Woods limit alerts (A/A+), a trade's STOP/TP and MB NOTEs. A WOODS TRIGGER (all four legs) is a TAKE TRADE NOW; A+ limits get one line; everything else stays on the dashboard.

**POSITIVE R ONLY (Stavros, 2026-10-16):** "if you test things and they are negative r:r, thats not something i want to do. woods strat is my strat, and that has positive r:r, as you can see based on my trading results." A strategy reaches Stavros only if its backtest averages > 0R after fees and, once it has 3+ tracked results, those average > 0R too. Woods is judged on his own live trades (14 closed BloFin trades, +0.33R average on 2026-10-16). Retired for negative records: sweep_reclaim (live −0.28R, 13), breakout_close (−0.36R, 5), lower_high_fade (−0.46R, 6), trend_pullback (backtests −0.3 to −0.6R), scalp_15m. Paper limits stay silent while their paper record is ≤ 0R (3+ closed) and come back on their own when it turns positive.

**THE FEEDBACK LOOP (Stavros, 2026-10-16):** "look at the trades you suggested, look at what actually happened, and then learn from it and improve for the following week ... each week we should be getting more accurate and better. i want you to quantify and actually execute against this goal."
- **Every trade, 72h after entry** (Coach): `lev_trade_72h()` measures what price did — best move his way (R), worst, where it sat at 72h, whether the original stop or TP1 came first, the stop that would have held, the better entry, the other side — and he gets a 72H UPDATE: what price did, the best play in hindsight, how much of the move he kept, and the one thing to change. Stored in `trade_review_72h`.
- **Every Saturday** (weekly review, PART A0): `lev_score_week()` scores six KPIs against the trailing 4 weeks — Moonbag's sent calls (avg R, the headline), all desk plays (avg R), open-plan bias hit rate (≥ 60%), his trades (avg R > 0), share of the move kept, risk-rule breaks (0). It grades last week's focus (worked / no effect / worse), then sets ONE focus rule for next week aimed at the biggest miss. The Desk Lead, the open planner and the Coach read it every run (`v_lev_focus`) and print it on cards. The focus never changes risk %, the daily stop, open-risk or leverage caps — those are Stavros's.
- **The goal, quantified:** the score (targets met) and Moonbag's sent-call average R rise on a 4-week rolling basis. Baseline week of Oct 5: 3/4 targets; Moonbag's sent calls +0.63R (2); all desk plays −0.60R (16); his trades +0.82R (7); kept 18% of the available move (avg best move +4.5R); 19 rule breaks logged.

### 0.0 The trader's code (Stavros, 2026-10-15)

Wait for your setup and manage your risk. Professionals know when to do nothing. A level touch isn't a trade — wait for confirmation. Know your stop before your entry; if the risk doesn't fit, the trade doesn't fit. More contracts don't fix bad discipline. Add only when the trade confirms. Put a shot clock on every trade. After your stop is hit, the trade is over. Take the loss, goldfish memory, next setup. No clear head, no trade. Missing a trade isn't losing money — chasing it can be. Slow down. (Full text and how the desk enforces each line: docs/TRADER_CODE.md. Two new rules from it: no re-entry on the same coin and side in the same session after a stop-out without a fresh setup and 3-line plan; after two losses in a day Grok asks "Clear head?" before any inputs.)

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
5. **Targets.** TP1 = the next real level, placed just in front of it, never beyond it. Aim for 2R or more; no hard minimum since 2026-10-16 (Stavros: "no minimum r - but i will always aim for 2:1") — under 2R is flagged "your call". TP2 = the level after that.
6. **Grade (the Gate's 0-100 score).** 85+ = A+. 70-84 = A. 55-69 = B. Only A and A+ reach the phone.

**Size and leverage.**

| Grade | BTC / ETH risk | Other coins risk | BTC/ETH leverage ceiling | Other coins ceiling |
| --- | --- | --- | --- | --- |
| A+ | 2% | 2% | 150x | 150x |
| A | 2% | 1% | 150x | 150x |
| B | 1% | 0.5% | 150x | 150x |

Leverage ceiling: 150x on every coin (Stavros 2026-10-16: "raise to 150x since that is what exchange allows"), or BloFin's own max for that coin if lower — and never above the safe cap that keeps liquidation ≥ 1.25 × the stop distance away. The safe cap is what really limits it.

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
6. **Reward.** Is the next real level 2R or more away (the aim)? TP1 goes just in front of it. Under 2R: show the R and flag it — his call.
7. **Data and red-folder days.** No new entry within 2 hours of major US data (CPI, FOMC, jobs, ISM). On a CPI, FOMC or jobs-report (NFP) day (Moonbag's econ_days, Phoenix date) only A+ keeps full risk; every other grade is HALF its usual risk (Stavros, 2026-10-14).
8. **Grade and risk.** If the Moonbag desk has a live signal on this coin, use its grade and the table above. If it has none, Grok does not score it: treat it as B (1% on BTC/ETH, 0.5% on any other coin). Halve it after 2 losses in a row.
9. **Size.** Coins = risk $ ÷ |entry − stop|. Notional = coins × entry.
10. **Leverage.** Lowest whole number with margin at or under half the balance, inside the ceiling. Check liquidation is 1.25× the stop distance past entry; if not, cut leverage or size. Rough liquidation: entry × (1 − 1 ÷ leverage) for a long, entry × (1 + 1 ÷ leverage) for a short. BloFin's own number is the one to trust.

**Output, always in this form. The first three lines are the plan; if any of them can't be filled honestly, it is NO TRADE (Stavros, 2026-10-14):**

```
Bias: <long|short> because <the level / trend in one line>
Entering when: <the exact trigger or limit price>
Wrong if: <the price or event that kills the idea = the stop>
<COIN> <Long|Short> · Entry <price> (<market|limit>) · SL <price> (<x.x>%) · TP1 <price> (<x.x>R, half) · TP2 <price>
Size <qty> <COIN> (≈ $<notional>) · Leverage <x>x isolated · Margin $<m> · Risk $<r> (<p>% of $<balance>) · Liq ≈ <price>
Why: <the level and the 1h close, one line> · Skip if: <what cancels it>
```

**Worked example** ($250 balance, desk grade A, BTC): long 83,000, stop 82,300 under the 4h support (0.84%). Risk 2% = $5. Size = 5 ÷ 700 = 0.0071 BTC = $593. Leverage 5x, margin about $119, liquidation near 66,400. TP1 must be 84,400 or higher. With no desk grade the same trade is 1% = $2.50, 0.0036 BTC, 3x.

**NO TRADE** when: no level, no 1h close, coin cooling, no risk budget, 4% daily drawdown hit, or data within 2 hours. Say it in one line with the price that would change it.

**LIMIT ORDERS (2026-10-12, §3.12).** Same levels, entered by a resting limit instead of at market: put the limit half a 1h ATR *through* the level (below the support for a long, above the resistance for a short) so it only fills on a sweep; level 0.15–2 daily ATRs from price, on the side of the daily 50 EMA; stop and minimums as above; TP1 the next opposite level, at least 2R (aim 3R); stop to entry at +1.5R; cancel after 24 hours or if price reaches TP1 first. A DCA ladder shares one stop and the 2% is for all rungs together. Grok records every resting limit in Moonbag (POST /limits) so it gets a TradingView alert and a line under "Open limits".

### 0.2b The open plan (weekdays, before the US open)

Stavros, 2026-10-15: "i want to go into open everyday with a clear strategy. if we can position and have a good win rate against market open i wont have to trade as much throughout the day."

- **5:15 AM Phoenix, Monday to Friday** (the open is 6:30 AM Phoenix in summer, 7:30 AM in winter). The open planner grades yesterday's plan: was the bias right, did the levels hold, did the open instruction make money, plus a one-line lesson. It then writes today's plan for BTC, ETH and SOL: bias and confidence, the 3-line plan, overnight and previous-day highs and lows, the long and short limit plans, and ONE instruction for the open. The plan sits at the top of the leverage page and goes to his phone.
- **Confidence is calibrated.** It is capped at 70% until 20 plans are graded. After that, it stays within 10 points of the real 30-day hit rate.
- **What the open backtest found** (2026-10-15, fees on; research/open). The classic opening-range breakout loses on crypto: −0.15R on 15m bars and −0.11R over 1,166 trades on 1h bars from January to October. The failed-breakout fade (−0.15 / −0.22R) and the overnight-range sweep (−0.05R) lose too. The previous-day high/low sweep came out +0.22R, but one half lost (−0.53R), so it is unstable. One candidate survived: **OPEN DRIVE**. If BTC/ETH/SOL move at least one 1h ATR in the first 30 minutes, go with the move. The stop goes 0.25 ATR beyond the open price, the target is 2R, and the trade is flat by 4 PM New York. Result: +0.26R over 53 trades, 51% win rate, both halves and all three coins positive. It is fragile: the 15- and 45-minute versions were flat, and the 60-minute version lost over 9 months. So it is PAPER: the Desk Lead checks it at 10:00 New York, records it in the plan and sends a half-risk card. It goes live only after 20+ tracked trades average more than +0.1R.

### 0.2c Secure 2R, fast inputs and the desk journal (2026-10-18)

**SECURE 2R (Stavros, 2026-10-18: "lets always try to secure 2r minimum on moonbag trades even if you think there is a 4+r opportunity").** When the first real level is 2R or more away, TP1 = exactly 2R (take 70%, stop to entry) and that level becomes TP2, the runner. When a level sits before 2R, TP1 goes just in front of it and the card flags the R ("under your 2:1 aim — your call"). This overrides the "TP1 = next real level" wording in 0.2 step 5 and the checklist step 6 whenever the level is 2R+ away. A+ grade = 3R+ of room to the level. A+ setups push to TradingView, with an "A+ NEAR — set the limit now" alert as price approaches (0.6% BTC/ETH, 1.2% alts).

**FAST INPUTS (Stavros, 2026-10-18: "i need grok to give me fast inputs for trades - price was at 80.9 and climbing").** "Long BTC?" with no numbers → GET /quick?coin=BTC&side=long with NO entry/stop: entry = the BloFin live price now, stop just past the nearest structure + ½ 1h ATR, secure-2R targets, size and leverage. Never take an entry from the open plan, the Woods machine, a limit or /levels for a "now" question. His own numbers → GET /quick with entry and stop.

**DESK JOURNAL (Stavros, 2026-10-18: "I need you and grok to lock in and work together to improve our execution and communication ... all three of us contribute and work off it ... i may like moonbag limits or trade better").** One shared journal: Stavros (through Grok), Grok and Moonbag/Claude. Page moonbag.ai/dashboard/journal; API GET/POST /desk-journal (AGENT_API.md "DESK JOURNAL").
- Every trade idea he sends Grok → POST /desk-journal kind "idea" (his words verbatim, his numbers, Grok's own take). Moonbag replies instantly with MOONBAG VIEW: its lean, his version, Moonbag now (market), Moonbag's limit, and WHERE WE'RE OFF. Grok relays it word for word under the /quick card.
- His choice ("mine" / "moonbag limit" / "moonbag now" / "skip" + why) → kind "decision". Execution and communication feedback → kind "lesson", word for word. Close → kind "outcome".
- Grok reads GET /desk-journal?days=3 at the start of each chat day.
- **Grok ↔ Claude, daily (2026-10-19: "can you check that daily and respond to grok directly ill have grok check daily as well").** Grok posts anything for Claude as kind "note" starting "FOR CLAUDE"; the daily cycle (5:50 AM Phoenix) answers each one as author claude starting "FOR GROK — re #id". Code changes get logged for a Cowork session; anything touching risk, guardrails or holds goes to Stavros. Ops calls inside the strategy are settled between Grok and Claude here, not by Stavros.
- **Mentor/caller calls** (Woods, Eliz, Johnny/Sage) give entry + stop (+ sometimes risk), never leverage: log THEIR numbers as the idea and get the inputs from GET /quick with &risk= (caller's risk can only lower the house risk, never raise it).

**LIQUIDITY BANDS (Stavros, 2026-10-19: "i want you to be looking at and using liquidity levels as well, test thesis to see what makes the most sense").** An estimated liquidation heatmap from OKX perpetual open interest, rebuilt hourly (liq_refresh at :07): each hour's new OI opens at that hour's price across 10x/25x/50x/100x, a band disappears once price trades through it; liq_snap keeps the 6 biggest bands above and below price. Tested on Aug 28 → Oct 16 (BTC/ETH/SOL, fees on):
- Bands are **not magnets** — the bigger band was hit first no more often than distance alone predicts. Rejected.
- Trading a **break** through a band: −0.24R. Rejected.
- A 1h **close-back sweep** of a band: ≈ 0R (a plain 24h-high/low sweep: −0.25R) — better levels, still not a trade on its own.
- A **resting fade limit at the biggest band** (house stop, TP 2R): +0.08R vs −0.16R for a small band → **LIQ✓ paper flag, 0 points**, scored weekly (Weekly 4f). Promote only on evidence (+0.15R over 10+ resolved).
- How we use them now: display + notes on every card — entry at a band (LIQ✓), stop parked inside a band (sweep risk: put it beyond), TP1 just past a band (put it in front). They never change size, stop or grade.
- Scorecard: 72h after each idea every version is played out on 15m bars (TP1 = +R, stop = −1R, open = marked at 72h, unfilled limits excluded) by desk_journal_score(); the Saturday review reports it (Weekly 4e). Rules change only with his OK.

### 0.3 LONG-TERM HOLDS — Robinhood + Coinbase (the simple version, 2026-10-18)

Stavros: "i want a simple long term investment strategy as well - just like we simplified lev strat ... buy and hold space and government stocks ... spacex and tesla should never sell, if anything we buy dip ... buy dips on news events ... part can go into etfs ... im looking at coinbase and robinhood as 10+ year holds."

**The whole strategy in five rules**
1. **Buy and hold for 10+ years.** Nothing in Robinhood or Coinbase is ever sold automatically. A sale happens only when Stavros says so in chat. SpaceX and Tesla are never sold.
2. **Buy every week.** Each Monday, cash goes to the holdings furthest below their target weight (8-week ramp from 2026-10-19, then every new deposit).
3. **Buy the dip on news.** When a space or government name drops 7%+ in a day, or 5%+ after its earnings or a big headline, Grok buys an extra week's slice that day (once per name per week, buys only). A name 15%+ below its 26-week high gets a double weekly buy.
4. **Grow the list slowly.** New space / government-stake names start on the watchlist; the Saturday review proposes promotions; Stavros approves. The GraniteShares "American Stakes" ETF (government-owned stocks; filed, not yet listed) gets considered once it trades.
5. **Balance with ETFs.** A quarter of Robinhood sits in ETFs so one bad headline can't sink the account.

**Robinhood (100% long-term; the trading sleeve is retired)**

| Bucket | Target | Names |
|---|---|---|
| Never sell: SpaceX + Tesla | 40% | SPCX 22 · TSLA 18 |
| Government-stake stocks | 25% | INTC 8 (US owns ~10%) · MP 7 (DoD ~15%) · LHX 5 · GFS 5 |
| ETFs | 25% | UFO 10 (space ETF, holds SpaceX) · VOO 8 (S&P 500) · ITA 7 (defense) |
| Gold / silver | 10% | GLD 6 · SLV 4 |
| Keep, no new buys | — | NVDA, PLTR |

- News-dip buys: SPCX, TSLA, UFO, INTC, MP, LHX, GFS. Never metals, VOO, ITA, or the keep-only names.
- Caps unchanged: one name at most 30%, SPCX + TSLA at most 45%. Robinhood's VRF/no-crypto block stays.
- **Market-dip buys (CR-12, Stavros 2026-10-24: "Approve dip-buy rule and move EOD to 12:45"; 10/23: "Make sure we are DCA when market dips like last two days").** On a broad dip — SPY down ≥ 1.5% on the day, or QQQ down ≥ 2.0%, or SPY ≥ 4% below its 20-day high (the first day it gets there) — buy **$3** split over the 1–2 most-underweight holds (gap ÷ target), min $1 an order, at most **2 dip days a week ($6)**. Checked in RockBot's 6:35 AM run (prior close) and the 12:45 PM run (same day, before the 1:00 PM Phoenix close). The dollars come out of the remaining 8-week ramp (it front-loads the ramp — no extra money), and cash never goes below a **$10 reserve**. On top of the single-name news-dip rule (rule 3), which stays. Buys only; SPCX/TSLA never sold.

**Coinbase (10+ year BTC/ETH hold)**
- Every Monday: cash (minus a $5 reserve) ÷ remaining weeks of an 8-week ramp from 2026-10-19, split **BTC 70 / ETH 30**; then new deposits the same way. Cash held by working dip-ladder limits counts as already allocated, and ladder fills count toward the ramp — so the Monday buy = (free cash − $5) ÷ remaining weeks (Grok/Claude, desk journal #31, 2026-10-19).
- Double that week's buy when BTC is in Eliz's weekly buy zone or 15%+ below its 26-week high. The working dip-ladder limits stay.
- **Market-dip buys (CR-12, 2026-10-24).** The working dip-ladder limits ARE the Coinbase dip buys. Extra, checked in the 5:41 PM run: when BTC is down ≥ 4% over 24h or ETH ≥ 6%, and free cash after the $5 reserve is ≥ $2, buy $2–4 split BTC 70 / ETH 30, at most 2 a week. Buys only.
- The old trend book (cb_run) keeps paper-tracking only; it never buys or sells live.

**Scored against:** the same dollars put into VOO on the same dates, reported every Saturday.

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
- **Goal: $10M** (Stavros, 2026-10-15). Leverage milestones: $240 → $1k → $10k → $100k → $1M → $10M. Deposits (e.g. his $1k BloFin top-up) are recorded in account_flows, so trading P&L stays honest.
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
- **Aim for 2R to TP1** (Stavros, 2026-10-10: "i want 2:1 r:r"); no hard minimum since 2026-10-16 (Stavros: "no minimum r - but i will always aim for 2:1"). Under 2R is shown and flagged, never blocked.
- Isolated margin. Margin at most half the account.
- **Leverage ceiling:** 150x on every coin (Stavros 2026-10-16: "raise to 150x since that is what exchange allows"; database-enforced), or BloFin's max for the coin if lower, never above the liquidation safe cap.
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
| Reward : risk to TP1 | 20: 2R = 12; 2.5R = 16; 3R+ = 20 (under 2R = 0 points, flagged; no hard minimum since 2026-10-16) |
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
| A+ (5) | 150x | 150x |
| A (4) | 150x | 150x |
| B (3) | 150x | 150x |

(Since 2026-10-16 every grade shares the 150x ceiling; the liquidation safe cap — liq ≥ 1.25 × stop distance — sets the real limit per trade.)

**The ceiling is halved when the market is hot:** 1h ATR% is more than 1.5× its 30-day average, funding is extreme, or major data is due within 24h.

**The pick, in order:**

1. **Floor:** the lowest leverage that keeps margin within half the account.
2. **Default:** the floor, rounded up to a whole number.
3. **Range:** Stavros may go anywhere from the floor up to the ceiling. The order card shows the range.
4. **Safety check, always:** liquidation must sit at least 1.25× the stop distance beyond entry. If it doesn't, size comes down.

**Learning loop:** the Auditor tracks leverage used vs outcome, slippage and liquidation proximity. It adjusts the ceilings only on evidence, never above Stavros's 150x.

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
5. **R:R — aim for 2:1** from entry to TP1 against entry to stop; no minimum since 2026-10-16. If the next level is closer than 2R, say so, name the entry where it would reach 2R, and flag "under your 2:1 aim — your call".
6. **Risk at most 2% of the BloFin balance**, using the §3.2 table, and stop for the day at a 4% drawdown:
   - BTC/ETH: A+/A 2%, B 1%.
   - Other coins: A+ 2%, A 1%, B 0.5%.
   - Half risk after 2 losses in a row, until the next win.
   - One trade per coin, and all open trades together risk at most 15%.
   - If unsure of the grade, use the lower one.
7. **No chase.** If the coin is cooling (§3.1: 10%+ off its 3-day low or high, or more than 2 daily ATRs from its daily 20 EMA), there is no trade. Wait for a base.
8. **Size (the amount).** Coins = risk $ ÷ |entry − stop|. Notional = coins × entry.
9. **Leverage.** Use the lowest whole leverage that keeps margin at or below half the balance, within the ceiling (150x on every coin since 2026-10-16, capped so liquidation stays ≥ 1.25 × the stop distance away).
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
| R:R to target 1: 2R+ = 2; under 2R = 0 (aim 2:1; no hard minimum since 2026-10-16) | 2 |
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

## 6b. New strategy ideas — the workflow (Stavros, 2026-10-14)

Stavros: "I don't want you to blindly change anything we have live — but backtest and layer into our existing strategy anything that makes sense ... have a section where it logs changes to strategy. Make this the workflow for all strategy ideas that I send."

1. **Log it.** Every idea he sends (posts, videos, guides, his own) gets a row in `strategy_ideas` with the raw text and a short summary.
2. **Split it into parts.** Entry model, levels, filters, management, risk rules and process rules are judged separately — an idea is rarely all good or all bad.
3. **Test each testable part against what we run live**, on our coins and our fees, with honest rules: no look-ahead, both halves of the period, core and alts, sample size stated. Parts that change something we already do (a management rule, extra levels, a filter) are tested as overlays on the live recipe, so the comparison is always "better or worse than what we have".
4. **Verdict per part:** adopted (beats the live version on both halves), already ours, keep testing (too few trades — re-tested monthly), proposed (sensible but not backtestable — needs his OK), or rejected.
5. **Change log.** Every adoption, rejection and proposal goes into `strategy_changes` with the reason and the evidence, and anything adopted also gets a new strategy-doc version. Nothing live changes on an idea alone.
6. **Report back** in a few lines: what was tested, the numbers, what changed (usually nothing), what is waiting for his OK.

The Strategy lab page (moonbag.ai/dashboard/lab) shows the ideas, every part's verdict, the change log and the strategy league.

## 7. Change log

- **2026-10-24 (v41):** CR-12 standing market-dip buys for the long-term books (Robinhood $3 on SPY −1.5% / QQQ −2% / SPY 4% under its 20-day high, max 2 a week, from the ramp, $10 reserve; Coinbase $2–4 on BTC −4% / ETH −6% in 24h, max 2 a week); CR-9 BTC-line anchor is a warning on alt longs, not a block (hard stops unchanged).
- **2026-10-19 (v40):** Liquidity bands — estimated liquidation heatmap (OKX OI model, hourly), four theses tested (magnet ✗, break ✗, sweep ≈0, biggest-band fade limit +0.08R → LIQ✓ paper flag, Weekly 4f), shown on /quick, /levels and the MOONBAG VIEW; Grok ↔ Claude daily journal loop (FOR CLAUDE / FOR GROK, Daily step 0); caller calls logged with their numbers and &risk=; Coinbase ramp counts ladder-held cash as allocated; live prices on /levels and the /quick anchor (stale > 45 min flagged).
- **2026-10-18 (v39):** Secure 2R written into the playbook (TP1 = 2R when the level is 2R+ away, level = runner; A+ = 3R+ room; A+ NEAR alerts); fast inputs with no numbers = live BloFin card (GET /quick without entry/stop); the DESK JOURNAL — one shared journal for Stavros, Grok and Moonbag with an instant side-by-side MOONBAG VIEW and a 72h scorecard (§0.2c, Weekly 4e).
- **2026-10-18 (v38):** Long-term simplified — Robinhood 100% long-term (trading sleeve retired), space + government stocks + ETFs, weekly buys, automatic news-dip buys, never auto-sell; Coinbase BTC 70 / ETH 30 weekly DCA with dip double.
- **2026-10-17 (v37):** Market context tracked — TOTAL, USDT.D, ETH/BTC: risk-on/off read in woods_scan, CTX✓ paper flag, Market line on the Woods machine, Monday lens item 7b, weekly CTX✓ test.
- **2026-10-17 (v36):** Mentor X adopt — time levels (yearly/monthly/weekly open, prev month H/L, Monday H/L) and fib 0.75–0.786 in woods_scan, EMA200 paper flag, confidence out of 130; weekly bias (Monday Mentor Lens draft → Stavros confirms) scored in the machine and graded Saturdays; weekly X scrape; $1k deposit no longer double-counted.
- **2026-10-16 (v35):** The mentor library — Eliz (macro) + Woods (micro): verbatim posts, principles, graded calls, questions to ask them, succession mode; Eliz wk10 levels on the Woods map and a macro score in woods_scan (confidence now out of 110, scaled to 100); POST/GET /mentors for Grok; intake in the open planner (v6) and the Saturday review (v19); nightly daily-candle sync + call grading (pg_cron).
- **2026-10-16 (v34):** System audit + the Woods machine — own BloFin candle feed every 5 min (pg_cron), woods_scan every 15 min with limits + confidence (woods_machine, woods_events, paper woods_limit), data timestamps on every card/ticket/plan and fast inputs, TradingView alerts Woods-only, Desk Lead keeps working when TradingView is down (v31), weekly SYSTEM + ATTENTION audit (v18), intraday check no longer auto-sells Robinhood, "watch late" flag fixed.
- **2026-10-16 (v33):** The feedback loop — 72h update on every BloFin trade (Coach v9, trade_review_72h, lev_trade_72h), weekly scorecard with six KPIs and one focus a week (Weekly v17 PART A0, lev_scorecard, lev_score_week, v_lev_focus), the focus applied by Desk Lead v30 and open planner v4, and a "Getting better?" card on the trade tracker.
- **2026-10-16 (v32):** POSITIVE R ONLY — negative-record setups retired (sweep_reclaim, breakout_close, lower_high_fade, trend_pullback); their open plays invalidated; paper-limit cards muted while their record is ≤ 0R; Desk Lead v29 and Weekly v16 enforce it. Woods stays the main strategy on Stavros's live record.
- **2026-10-16 (v31):** Leverage ceiling raised to 150x on every coin (Stavros 2026-10-16: "raise to 150x since that is what exchange allows"). Database cap (lev_universe ≤ 150, risk_config 150) and the card ceiling updated; the liquidation safe cap (liq ≥ 1.25 × stop distance) still decides the real maximum for each trade. Dollar risk is unchanged — leverage never changes it.
- **2026-10-16 (v30):** No minimum R:R (Stavros: "yes i want no minimum r - but i will always aim for 2:1"). The database 2R gate is off; cards, fast inputs and the Desk Lead (v28) show the R and flag anything under 2R as "under your 2:1 aim — your call". Woods TP1 = the first pop (first level ≥ 1R, 70%).
- **2026-10-16 (v29):** §0.00 — the Woods framework (Stavros's mentor) becomes the MAIN leverage strategy; house risk rules unchanged, cross margin by default with the stop on the exchange. New: woods_levels map + GET/POST /woods, daily Woods map in the open plan, WOODS A+ trigger + flip watch in the Desk Lead, Woods lines in fast inputs (anchor, no-man's land, hedge, 70/30). TP1 keeps the 2R house minimum. Mechanical test: −0.12R (all four legs) / +0.05R (without divergence) — live tracking decides.
- **2026-10-15 (v28):** §0.0 The trader's code (Stavros's text, docs/TRADER_CODE.md) — the psychology the rules already enforce, plus two small additions: no same-session re-entry after a stop-out without a fresh setup and 3-line plan; "Clear head?" check after two losses in a day. One line of the code shows under the desk title each day.
- **2026-10-15 (v27):** Fib 0.75 tested (research/fib, Stavros's idea): on ordinary swings every fib level loses (0.75: −0.24R over 1,187 trades; 0.5–0.786 the same). On BIG 1h legs (≥ 7 × ATR) running with the 200 EMA, the 0.75 limit made +0.24R over 53 trades (both halves positive) and beat 0.618 — adopted to PAPER as playbook fib_75 (lev_fib_plan() on each 4h LIMIT DESK run, messaged as "FIB 0.75 SETUP (paper stage — half risk)" for BTC/ETH/SOL and in-play coins). Caveat: the edge sits mostly in the alts so far.
- **2026-10-15 (v26):** Stavros's divergence idea tested (research/div): RSI divergence, Woods-style divergence combos (TOTAL/TOTAL2/TOTAL3/USDT.D/USDC.D/BTC/ETH), RSI heatmap OB/OS and USDT.D direction have no edge as entries after fees (−0.06 to −0.25R); USDT.D mirrors BTC on the same bar (−0.98) and doesn't lead it. HTF combo + 1h confirmation (+0.37R, 9 trades) is paper-tracked. Today's 80.1k→82.1k move was caught by the existing limit recipe (BTC long 79,910 under the PDL → TP1 81,721, +2.2R); the open plan now names BOTH limits when bias is neutral. Leverage: up to 100x allowed, capped by the liquidation safety rule (liquidation ≥ 1.25 × stop distance; ≈65x on a 0.8% BTC stop); isolated by default, cross only on A/A+ with the stop on the exchange; the database coin caps (BTC/ETH 20x, alts 10x) stay until Stavros approves raising them. FAST INPUTS: GET /quick returns the full card from his entry + side + stop.
- **2026-10-15 (v25):** North star and $10M goal (§0). Long-term holds (Coinbase, Robinhood) are separated from strict-R:R leverage trading. New weekday open plan (§0.2b: lev_open_plan, graded daily, calibrated confidence). US-open strategies tested: opening-range breakout, fade, overnight sweep and previous-day sweep all rejected; Open Drive 30m is paper. Deposits are tracked.
- **2026-10-15 (v24):** Coinbase and Robinhood switch to buy-and-hold (§0.3, §0.4). This came after ETH's 2,330 Coinbase stop filled on a 1-hour wick to 2,313 that closed back at 2,377. Holds sell only on a daily close below the bear line (Coinbase) or the thesis stop (Robinhood). The BTC hold's exchange stop-limit (74,600) and its TP1 bracket are cancelled. A dip ladder spreads the Coinbase cash over BTC and ETH. Stavros approved the larger worst case (about 10% of the Coinbase account). BloFin leverage is unchanged. Change 14 in the strategy lab.
- **2026-10-14 (v23):** Stavros approved both proposals from the X pre-market post, with one change: on CPI / FOMC / jobs-report (NFP) days A+ setups keep full risk and every other grade trades at HALF risk (instead of A+ only); still no new entry within 2 hours of a release. The daily task marks those days in econ_days and the desk halves risk on them. Every input card (Grok and the desk) now starts with the 3-line plan: Bias because / Entering when / Wrong if. Changes 12 and 13 in the strategy lab.
- **2026-10-14 (v22):** §6b: the workflow for new strategy ideas (log → split → test against live → verdict per part → change log → report). First two ideas from X tested: VWAP pullback (+0.01R, no edge), 50% off at 1R (cut the limit recipe from +0.12R to +0.02R), Asia/London day profiles (−0.15R and −0.12R), session levels (−0.01R) — none adopted. Proposed for his OK: A+ only on CPI/FOMC/NFP days; the 3-line plan (bias because / entering when / wrong if) at the top of every input card.
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
