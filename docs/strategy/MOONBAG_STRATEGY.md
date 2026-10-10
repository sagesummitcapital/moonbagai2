# Moonbag Strategy — Source of Truth

Version 7 · 2026-10-10 · Owner: Stavros · Maintained by Claude

This file is the one place the Moonbag strategy is written down. Every agent works from it.
When it changes, the same text is saved in three places: this file in the repo
(`docs/strategy/MOONBAG_STRATEGY.md`), the claude.ai project, and the database (`strategy_doc`,
read by the scheduled agents and by Grok through `GET /api/moonbag/strategy`). The database
tables (`lev_strategy`, `risk_config`, `lev_universe`) hold the same rules in machine form. If they
ever disagree with this file, this file wins, and Claude fixes the tables.

Analysis, not financial advice. Stavros decides every trade.

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
| **Strategist** (research + Robinhood) | Publisher · Level Watch · Executor (Grok/RockBot) | Daily cycle (5:50 AM) · Intraday check (6:45 / 9:45 / 1:45) |
| **Auditor** (feedback loops) | Coach | Weekly reviews (Sat 6:29 / 6:59) · 24h lookback (every 3h) |
| **Stavros** | — | Places every BloFin order; also takes his own calls |

| Agent | Tasks |
| --- | --- |
| Scout | Rank ~25 coins vs BTC · pick the top 5 rotation coins (daily close) · pick up to 2 in play (every 4h) |
| Cartographer | Each coin's two lines: range high + range low · one TradingView alert per line carrying the play |
| Gate | Check validation on closed 1h candles · score 0–100 + 8-point checklist · TAKE TRADE NOW or NO TRADE |
| Risk Officer | Size to the risk tier and open-risk budget · leverage inside the ceiling · BloFin order card |
| Exit Clerk | Swap a coin's lines to stop + target when a trade opens · TP1 → breakeven, trail · 72h · restore lines after close |
| Publisher | Morning-brief X post · trade opened / closed X posts (templates, filled by the website) |
| Level Watch | Robinhood levels during market hours — messages only when something changed |
| Executor | Robinhood orders inside the limits · records fills and BloFin trades · posts the X posts |
| Coach | 24h lookback on every close · scores Stavros's own calls |
| Auditor | C-setup review · weekly strategy review · R:R, leverage, rotation, agent health · writes strategy changes here |

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
- **Seed list (2026-10-09), 1M vs BTC:** NEAR +102%, ENA +30%, SUI +25%, AAVE +24%, AVAX +24%. Bench: LTC, SOL.
- Live list: `lev_universe` and the dashboard Agents tab.

### 3.2 Hard rules (do not bend)

- **One trade per coin, no cap on the number of open trades, combined risk to the stops ≤ 15% of the account** (Stavros, 2026-10-09; 2-trade cap removed 2026-10-10). A trade on one coin never changes another coin's lines. Each extra trade is sized to fit what is left of the 15% (below 1% left = NO TRADE). Risk on a trade drops to 0 once its stop is at or past entry.
- Hold 72 hours maximum (time stop).
- Stavros places every order.
- Stop beyond real structure and at least 0.5% from entry (0.8% for rotation coins). The stop must sit inside 80% of the distance to liquidation.
- Reward to TP1 at least 1.5R. Prefer 2R+.
- Isolated margin. Margin at most half the account.
- **Leverage ceiling:** 20x for BTC/ETH, 10x for rotation coins (database-enforced).
- **Risk tiers by account size:**

  | Account | Grade 5 (A+) | Grade 4 (A) | Grade 3 (B starter) |
  | --- | --- | --- | --- |
  | Under $1k | 10% | 5% | 1% |
  | Under $10k | 5% | 2.5% | 1% |
  | Above $10k | 2% | 1% | 0.5% |

- Rotation coins take **one grade lower size** (an A on SUI is sized like a B), until 10 resolved alt signals show positive average R.
- After 2 losses in a row: half risk until the next win. Down 15% from the peak: trade alerts pause, research only, until the Saturday review.
- No daily trade or loss limit (removed 2026-10-08). A loss doesn't end the day.

### 3.3 The two lines per coin (Cartographer) — TradingView = Moonbag home page

**No open trade on the coin.** It has exactly two lines, each one a TradingView alert:

- **RANGE HIGH**: the nearest real 4h/daily level above that capped price.
- **RANGE LOW**: the nearest real level below that held.

They bracket price. The same two numbers show on the Moonbag home page (morning brief coin card, "TradingView lines"), in the morning brief text and in the X post. Each alert message carries the play:

| 4h trend | At the range high | At the range low |
| --- | --- | --- |
| Down | Primary: rejection SHORT · Alt: breakout LONG on a close above + hold | Primary: breakdown SHORT · Alt: sweep-and-reclaim LONG |
| Up | Primary: breakout LONG · Alt: rejection SHORT | Primary: reclaim LONG · Alt: breakdown SHORT |
| Range | Primary: rejection SHORT | Primary: reclaim LONG |

**Validation** (never enter on the touch or a wick):

- **Breakout / breakdown:** a 1h candle closes beyond the line and the next 1h candle doesn't close back through it, or a retest holds.
- **Rejection / reclaim:** price sweeps beyond the line, then a 1h candle closes back inside.

**After the 1h close** the Gate answers:

- **TAKE TRADE NOW:** the full BloFin order card.
- **NO TRADE:** one line saying why.

If the range held, the line is re-armed. If it broke, the box is redrawn.

**A trade is open on the coin**, whether a Moonbag trade or Stavros's own: that coin's two lines become **STOP** (live `current_stop`) and the **next target** (TP1, then TP2). Other coins keep their range lines. When Stavros moves his stop or target, the lines follow at the next hour. When the trade closes, the range lines come back.

Lines come from price alerts. The connector can't draw permanent chart drawings, so the line shows on the chart while its alert is active. A fired alert is re-armed by the next hourly run.

### 3.4 Confidence score (Gate) — 0 to 100

| Part | Points |
| --- | --- |
| Structure & level | 25: a 4h/daily level touched 2+ times = 15; + clean invalidation = 5; + confluence = 5 |
| Higher-timeframe alignment | 20: with the 4h trend = 20; range edge = 12; counter-trend after a 1h reclaim = 6; counter-trend with no reclaim = 0, plus a −15 penalty |
| Reward : risk to TP1 | 20: 1.5R = 8; 2R = 12; 2.5R = 16; 3R+ = 20 |
| Trigger | 15: scored when validation prints. 1h close through the level = 10; follow-through or volume = +5 |
| Regime fit | 10: right regime for the setup = 10; mixed = 5; wrong = 0 |
| Evidence | 10: forward results for this setup. Unproven = 5; 3+ positive = 8; 10+ with avg > 0.3R = 10; 10+ negative = 0 (retired) |

- **Penalties:** chasing more than half an ATR past the level −10; CPI/FOMC/jobs/ISM within 2 hours −10.
- **Rotation coins:** add **"leading vs BTC"** to regime fit (full 10 only while the coin is in the top 2 by relative strength).

| Score | Grade | Label | What happens |
| --- | --- | --- | --- |
| 85+ | 5 (A+) | DESK ALERT | TAKE TRADE NOW any time |
| 70–84 | 4 (A) | DESK ALERT | TAKE TRADE NOW any time |
| 55–69 | 3 (B) | DESK ALERT (starter) | TAKE TRADE NOW in core hours (Mon–Fri 5 AM–2 PM Phoenix) |
| 40–54 | 2 (C) | RESEARCH ONLY | Paper-tracked; reviewed Saturday |
| Under 40 | 1 | PASS | Logged |

**DESK ALERT checklist** (all must be yes):

1. Coin is core or in play, no open trade on this coin, and at least 1% of the 15% open-risk budget left.
2. R:R at TP1 is at least 1.5.
3. Stop is beyond structure and far enough from entry.
4. Leverage is within the coin's cap and the stop is inside 80% of the liquidation distance.
5. The trade is with the 4h trend, at a range edge, or counter-trend only after a reclaim.
6. The plan fits within 72h.
7. No major US data release within 2h.
8. The setup is not retired.

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

### 3.6 Order card (Risk Officer → Stavros)

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

- **Entry:** market if price is within a quarter of the 1h ATR of the planned entry. Otherwise a limit order at the level. If a market entry drops TP1 below 1.5R, the card switches to the limit order.
- **NO TRADE:** a one-line NO TRADE closes the loop when a level is hit but the setup fails.

### 3.7 Trade management (Exit Clerk) — runner rule

1. TP1 is a limit order for half the position. Let it fill; don't close by hand in front of it.
2. When TP1 fills, move the stop on the rest to entry.
3. Trail the runner behind the last 1h swing until it is +3R, then behind the last 4h swing.
4. TP2 is the next 4h/daily level. Exit at TP2, the trailed stop, or 72 hours.
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

- Minimum 1:1.5, prefer 2+.
- **Every Saturday the Auditor:**
  1. groups results into 1.5–2R, 2–3R and 3R+ buckets;
  2. checks how far stopped trades ran in our favour first;
  3. checks how often winners reached 3R;
  4. moves the minimum once there are 10+ results per bucket.
- Never below 1.5 without Stavros.

### 3.9 Stavros's own calls

- Stavros still takes trades from his own read. Every BloFin trade is tagged `moonbag` or `own`.
- The Coach scores own trades with the same rubric after the fact.
- The Auditor compares the two. If own trades that score under 55 keep winning, the rubric is missing something, and that becomes a tested rule.

---

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
| R:R to target 1: 2R+ = 2; 1.5R = 1 | 2 |
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
- **Coins.** BTC-USD, ETH-USD, SOL-USD. New coins need their own backtest first.
- **Regime, per coin.**
  - **BULL:** a daily close above 1.02 × 200-day SMA.
  - **BEAR:** a daily close below 0.97 × 200-day SMA. That means exit, cash, no longs.
  - This is the "flip bearish" rule. Stavros's 100–105k BTC top is used as a profit-taking zone, not as a forecast.
- **Entry.** A BULL coin closes above its prior 55-day high. Market buy after the 00:00 UTC close; Grok never pays more than 1% above the handed-off price.
- **Stop.** 3 × ATR(14) below entry.
- **Take profit and trail.** TP1 sells half at 3R. Then the stop on the rest goes to entry + 1.2%, and the runner trails the prior 20-day low (the 10-day low once BTC trades above 100k).
- **Risk.**
  - 5% of equity per trade, including fees.
  - 15% max open risk; one position per coin, max 3.
  - Risk halves after 3 straight losses.
  - New entries pause if equity is 20% below its 30-day peak.
  - The database enforces all of this (`moonbag_check_handoff_coinbase`).
- **Why this system.** On Coinbase data with fees, 2021–26, it returned 29.6% a year with a −18.9% worst drawdown, against 19.6% a year and −76.7% for buy-and-hold. All 36 parameter variants tested were profitable in both 2017–20 and 2021–26.
- **Separate from Book 1.** The Robinhood no-crypto rule stands. Coinbase is the only place Moonbag owns spot crypto.

---

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

**Changes on evidence only:** 10+ resolved results, or a backtest that holds on two coins. Risk %, the 20x ceiling, the 2-trade / 15% open-risk limit and the 72h limit change only when Stavros says so.

---

## 7. Change log

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
