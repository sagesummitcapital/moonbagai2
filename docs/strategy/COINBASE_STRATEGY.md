# Moonbag — Book 3: Coinbase crypto trend book

*Version 1.0 · 2026-10-10 · owner: Claude (strategy), Grok (execution), Stavros (risk limits, final say)*
*Analysis, not financial advice. Machine form: `risk_config` (venue `coinbase`), `cb_universe`, `cb_backtest()`.*

## 1. What this book is

Stavros connected Coinbase to Grokbot on 2026-10-10. The setup:

- **Account:** the agentic Coinbase account (an isolated agent portfolio), funded with $100.
- **Venue:** spot crypto only, so every position is long or cash (USDC). No leverage, no margin, no perps.
- **Workflow:** the same as Robinhood. Moonbag decides, Grok executes and reports back, and every trade, stop and exit is recorded in Moonbag and shown on `/dashboard/coinbase`.

How it fits with the other books:

| Book | Venue | Job | Crypto? |
|---|---|---|---|
| 1 | Robinhood (Grok) | Long-term thesis plus a small A-setup trading sleeve | **Never.** That rule stands. |
| 2 | BloFin (Stavros) | Leveraged intraday/swing perps, 1h levels | Yes, perps |
| **3** | **Coinbase (Grok)** | **Spot trend-following on BTC/ETH/SOL, daily bars, R-based** | **Yes, spot only** |

Book 3 is where the long-term thesis's "hard money" view gets real BTC exposure, but only while the trend is up. The Robinhood no-crypto rule is unchanged.

## 2. Coinbase + Grok: what the tools can do (researched 2026-10-10)

**Tools.** Grok trades through the Coinbase for Agents remote MCP:

- **Orders:** `orders_preview`, `orders_create`, `orders_edit`, `orders_cancel`, `orders_list`, `orders_fills`.
- **Account:** `balance`, `portfolios_*`.
- **Data and costs:** `products_candles`, `fees`.

**Products.** Agent (isolated) portfolios are spot-only. Futures exist, but only in the default portfolio, and this book does not use them.

**Order types.**

- **Documented for agents:** market and limit. Market buys take `quote_size` in USD; sells take `base_size` in coins.
- **In the Advanced Trade API itself:** stop-limit (`stop_limit_stop_limit_gtc`) and bracket / attached take-profit + stop-loss (`trigger_bracket_gtc`). Grok must check with `orders_preview` whether its connector accepts these.
  - If it does, stops sit on the exchange.
  - If it does not, Moonbag runs **soft stops**: it checks every hour and issues a `close` handoff.

**Fees (Advanced, under $10k of 30-day volume).**

- 0.40% maker / 0.60% taker, so about 1.2% for a taker round trip.
- That is too expensive for intraday scalps on $100. The book therefore trades daily bars:
  - trades last weeks;
  - stops are about 7–11% wide;
  - fees come to roughly 0.1–0.15R per trade, and every backtest below includes them.

**Idle cash** sits in USDC. Coinbase pays variable USDC rewards on it, which the backtests do not count.

## 3. Macro read (BTC, 2026-10-10) — and why we don't trade it as truth

| Measure | Value |
|---|---|
| Price | 82,752 |
| All-time high | 126,296 (6 Oct 2025) → −34.5% |
| Cycle low so far | 57,718 (1 Jul 2026) — −54.3%, 268 days after the peak; bounce +43% |
| 200-day SMA | 71,917 and rising (+2% in 20 days); Mayer multiple 1.15 |
| 50-day SMA | 80,804 (above the 200-day) |
| Weekly 20 EMA / 50-week SMA / 200-week SMA | 75,622 / 77,097 (reclaimed 20 Sep) / 66,511 |
| 2026 high | 97,964 (14 Jan) — the lower high below the breakdown zone |
| System regime (200D hysteresis) | **BULL since 20 Aug 2026** (flipped at 73,012) |

**Two honest readings:**

1. **The low is in (Jul 2026, −54%).**
   - This is a shallower bear than 2018 (−84%) and 2022 (−78%), which fits an ETF-era market with fewer forced sellers.
   - Price has reclaimed the 200-day and the 50-week, and the 200-day is turning up.
   - That looks like 2019 and 2023, when the first post-bottom rally ran a long way.
2. **Cycle timing says be careful.**
   - The last two bear-market bottoms came 363 and 376 days after the peak. Today is day 369.
   - A final leg down into Q4 2026 cannot be ruled out.
   - In that case a relief rally into heavy supply would fail.

**Stavros's view: 100–105k is the top, then the bias flips bearish.**

- 100–105k is a sensible resistance zone. It sits above the January 2026 lower high (97.9k), and it is where the trend broke in November 2025: the regime flipped bear at 106.5k.
- We use it as a **profit-taking zone, not a forecast**:
  - If BTC breaks out from about 87.4k, the system's own first target lands at about 105.6k (3R). The rules sell half right where he expects the top.
  - Once BTC trades above 100k with a position open, the runner's trail tightens from the 20-day low to the 10-day low.
  - That tightening is an overlay. It is tagged in `cb_signals` (kind `trail`, note `overlay 100-105k`) so the weekly review can measure whether it helped.

**When the bias flips bearish (rule, not opinion).**

- **Flip:** a daily close below **0.97 × 200-day SMA** turns that coin bearish: exit, hold USDC, no new longs. Today that is 69,759 for BTC, and the line rises with the average.
- **Back to bullish:** a daily close above **1.02 × 200-day SMA**.
- **History:**
  - flipped bear on 3 Nov 2025 at 106,558, 16% below the top, which avoided the fall to 57.7k;
  - flipped bear on 31 Dec 2021 at 46.2k and went back bull on 13 Jan 2023 at 19.9k;
  - flipped bear in Mar 2018 at 8.2k and went back bull in Apr 2019 at 4.9k.
- **Early warning (information only):** a weekly close below the 20-week EMA (75,622 today).
  - It turned down earlier at the 2025 top (19 Oct, 108.7k).
  - As a hard gate, though, it whipsawed: return fell from 29.6% to 16.9% a year and the worst drawdown rose from −19% to −36.5% (2021–26). So it is a dashboard flag, not a rule.

## 4. The system (v1)

Universe (v1): `cb_universe` = BTC-USD, ETH-USD, SOL-USD. **Superseded by v2 (§4b): the universe is now open — 36 coins, with alts earning live status from their paper record.**

**Regime, per coin, on the daily close:**

- **BULL:** close above 1.02 × 200-day SMA.
- **BEAR:** close below 0.97 × 200-day SMA.
- **In between:** the previous regime holds.

**Entry, on the daily close (00:00 UTC), BULL coins only:** the close is above the highest high of the prior 55 days.

- Market buy right after the close.
- Grok never pays more than 1% above the price Moonbag hands off. That keeps it close to the tested fill (close + 0.05%) without skipping strong breakout days.

**Initial stop:** entry − 3 × ATR(14). It sits as an exchange stop if Coinbase allows one, otherwise as a soft stop.

**Size:**

- Risk is **2% of Coinbase equity** per trade (Stavros, 2026-10-11; was 5%), measured to the stop and including about 1.2% of fees. That works out to roughly 15–25% of the account per position at today's volatility.
- A trade's size is also capped by the open-risk budget left, cash, and 100% of equity (no margin).

**Take profit (TP1):**

- Sell half at entry + 3R with a GTC limit order (maker fee).
- Then move the stop on the rest to entry + 1.2% so it can't lose.
- Then trail the runner under the prior 20-day low on each daily close (10-day low once BTC trades above 100k).

**Exit everything in a coin** if:

- the stop is hit;
- the regime turns BEAR (exit on the daily close); or
- Stavros overrides.

**Portfolio limits:**

- one position per coin, at most 3;
- **15% max combined open risk** (a risk-free runner counts 0);
- risk per trade halves after 3 straight losses;
- new entries pause if equity is 20% below its 30-day peak, until Stavros reviews.

**Today's triggers (if the daily close is above):**

| Coin | Trigger | Planned stop | TP1 (3R) | Approx. position at 2% risk on $100 |
|---|---|---|---|---|
| BTC | 87,397 | 81,331 | 105,594 | $24 |
| ETH | 2,807 | 2,575 | 3,503 | $21 |
| SOL | 124.93 | 111.31 | 165.80 | $16 |

The backtest system is already long all three, in its paper record: ETH and SOL since 19 Aug, BTC since 21 Sep, with SOL past TP1. The live account starts flat and only takes fresh signals. Chasing old entries was not part of the test.

## 4b. v2 — Open universe, earned live status (2026-10-10)

Stavros: *"i dont want coinbase to be limited to just 3 coins - open it up to the entire system - goal is increasing r:r"*.

**What the backtest said first.** We pulled Coinbase daily history for 36 USD pairs — today's leaders and coins that faded
(MANA, SAND, AXS, ALGO, FIL, ICP, DOT, ATOM, CRV…) to limit survivorship bias — and ran the same rules over all of them
(`research/coinbase/uni.py`, fees + 0.3% alt slippage).

| 2021-01 → 2026-10 | Trades | Win % | Avg R | Profit factor | CAGR | Worst DD |
|---|---|---|---|---|---|---|
| v1: BTC/ETH/SOL | 29 | 52% | **+1.15R** | 2.65 | 29.8% | −18.9% |
| All 36 coins, same rules, full risk | 76 | 26% | +0.30R | 1.14 | 10.7% | **−64.0%** |
| **v2: all 36 scanned, alts earn live status** | 32 | 47% | +1.10R | 2.57 | 29.9% | −20.4% |

| 2023-01 → 2026-10 | Avg R | CAGR | Worst DD |
|---|---|---|---|
| v1 | +1.02R | 32.6% | −18.9% |
| v2 | +1.09R | **37.8%** | −19.1% |

From mid-2024 on, v2 averaged +0.63R vs +0.36R for v1 (CAGR 21.7% vs 14.5%). The alt trades v2 let through averaged
+0.37R to +0.64R in every window tested.

**Opening the universe naively lowers R:R.** Most alts don't trend cleanly enough for a 55-day breakout: per coin, the alts
averaged about +0.3R against about +1.1R for BTC/ETH/SOL, with many more stop-outs and deeper gap losses. So v2 scans
everything but only trades what has proven itself.

**v2 rules (in `cb_run()` and the database gate):**

1. **Scan and paper-trade every coin.** All 36 coins in `cb_universe` run the exact v1 rules on paper in `cb_paper`, every
   day, with no portfolio limits. The paper book was seeded with each coin's backtest record (311 trades through 2026-10-09)
   and continues live from there.
2. **Core coins trade live:** BTC, ETH, SOL, at full risk (2% since 2026-10-11).
3. **An alt goes live only when its own paper record earns it:** 4+ closed paper trades averaging **+0.5R or better**.
   It drops back to paper automatically if its average falls below that. (Tested thresholds: +0.3R and +0.5R held in every
   window; +0.75R and +1.0R were worse.)
4. **Alts trade at half risk** (1% — `cb_universe.risk_mult` 0.5) and **only while BTC's regime is bull**.
5. **Priority when several coins break out on the same day:** core coins first, then alts by 90-day strength vs BTC.
6. **Unchanged:** 15% max open risk, max 3 positions, one per coin, losing-streak halving, 20% drawdown pause, the 1% price gate,
   stops/TP1/trail/regime exits.

**Update 2026-10-10 (later): Stavros switched alts OFF for live trading** ("not too keen on alts myself for the agentic trading" — he trades alts on BloFin). `risk_config.alts_live = false`: only BTC/ETH/SOL trade live; all 36 coins keep their paper record, and the weekly review reports which alts would have qualified. Flip `alts_live` to true to re-enable rule 3.

Would have been live at the start (2026-10-10): BTC, ETH, SOL + 13 alts — ADA, ARB, AVAX, DOGE, GRT, INJ, MANA, NEAR, SAND, SHIB, SUI, XLM, XRP.
Paper only: AAVE, ALGO, APT, ATOM, AXS, BCH, CRV, DOT, ENA, ETC, FIL, HBAR, ICP, LINK, LTC, ONDO, OP, RENDER, SEI, UNI.

**Honest limits.** The live rule was picked on the same history it was tested on, the alt samples are small (5–10 trades
over 4 years), and coins that were delisted aren't in the data. That's why alts trade at half risk, why the rule is
re-checked every Saturday, and why a coin can lose live status as fast as it earned it.

**Adding coins.** Any Coinbase USD pair Moonbag tracks elsewhere (Scout rotation, BloFin trades) can be added to
`cb_universe` with a 300-bar daily backfill. It starts paper-only, with its backtest record seeding `cb_paper`.

## 5. Backtests (Coinbase daily data, fees and slippage included)

Research code is in `research/coinbase/` (Python). The same rules run in the database as `select public.cb_backtest(...)`, which matched the Python results trade-for-trade on BTC+ETH from 2024-09 to 2026-10: 6 trades, +5.6R, 18.5% a year, −15.8% worst drawdown.

**Portfolio, 5% risk per trade, 15% max open risk:**

| Universe · period | CAGR | Max drawdown | Trades | Win % | Avg R | Total R |
|---|---|---|---|---|---|---|
| BTC+ETH+SOL · 2021–2026 | **29.6%** | **−18.9%** | 29 | 52% | 1.15 | +33.3 |
| BTC+ETH · 2017–2020 | 91.9% | −44.2% | 16 | 50% | 4.66 | +74.6 |
| BTC+ETH · 2017–2026 | 47.5% | −44.2% | 37 | 54% | 3.12 | +115.6 |
| *BTC buy-and-hold · 2021–2026* | *19.6%* | *−76.7%* | | | | |
| *BTC weekly DCA · 2021–2026* | *+92% on money in* | *−55% at worst* | | | | |

**Risk per trade (BTC+ETH+SOL, 2021–26):**

| Risk per trade | CAGR | Max drawdown |
|---|---|---|
| 3% | 19.4% | −13.1% |
| **5% (start)** | **29.6%** | **−18.9%** |
| 7.5% | 33.8% | −24.8% |
| 10% | 41.9% | −29.5% |

**Robustness:**

- I tested 36 variants: lookback 40/55/70 days × stop 2.5/3/3.5 ATR × TP1 at 2R/3R.
- All 36 made money in both periods.
- For 2021–26 their CAGR ranged from 13.7% to 29.6%, with worst drawdowns from −18% to −38.6%.
- The chosen setting (55 days / 3 ATR / 3R) was the best out of sample but not the best in sample, so it was not picked by curve-fitting one window.
- Breakouts beat pullback entries on robustness. A full-size regime-only core (no R sizing) beat buy-and-hold but kept drawdowns of 50–65%, so it was rejected as "automating losses".

**What would have hurt:**

- Losing trades cost about −1R each, including fees.
- Long chop inside the regime gives up to 3–4 losses in a row, which is why risk halves after 3 straight losses.
- A crash that gaps through a soft stop would lose more than 1R.

## 6. Who does what

| Step | Claude / Moonbag | Grok |
|---|---|---|
| Daily, 5:50 AM Phoenix | **Strategist** (head of both agentic books): reviews the Coinbase book — signals, fills vs plan, paper moves, promotions, desk health. Can pause a coin for a written reason (delisting, exploit, depeg, regulatory action). Never changes risk. | — |
| Daily, 00:32 UTC (5:32 PM Phoenix) | Coinbase desk (the Strategist's arm): stores closed daily candles for all coins, runs `cb_run()` — regime, paper book, live status, entries. Updates `cb_universe` (regime, trigger, stops). Logs every decision in `cb_signals`. On a signal: sizes the trade and creates a handoff (`broker: coinbase`). | — |
| Entry | — | Polls `GET /handoffs?status=pending&broker=coinbase`. Previews, then market-buys the quote amount. Places a TP1 limit sell for half, plus a stop or bracket if the connector supports it. `POST /trades` (venue `coinbase`). Marks the handoff executed. `POST /accounts` (venue `coinbase`). |
| Every hour, :32 | Stop / TP1 / regime / trail checks on open Coinbase trades. Issues `close`, `trim` or `adjust_stop` handoffs. Updates `current_stop`. | Executes them and records every fill with `POST /trades/{id}/exits`. |
| Every 3 hours | Coach: 24-hour lookback on each closed trade (all venues). | — |
| Weekly (Sat) | Auditor: re-runs `cb_backtest` baseline plus one variant; compares the live record with `cb_signals` (missed signals, slippage, fees); runs R:R buckets; keeps or changes the rules (evidence needed: 20+ backtest trades that hold on both halves or 2+ coins). Never changes risk %. | — |

Grok posts a Coinbase account snapshot at least daily. Without one under 2 days old, the database refuses new entries.

## 7. Risk ladder (Stavros decides; agents only propose)

- Now at **2% risk per trade, 4% daily drawdown stop, 15% max open risk** (Stavros, 2026-10-11).
- **Proposal at 15 closed live trades:**
  - if average R ≥ +0.5 and live results track the backtest within 1R in total, consider 3% per trade;
  - if average R < 0, go to 1% and review.
- Gains compound automatically because size is a percentage of current equity.
- Adding more money is Stavros's call. The system re-sizes from the next account snapshot.

## 8. Change log

- **2026-10-11 v2.3:** Stavros's zone buys. Stavros can call an accumulation zone himself (first one: BTC from ~83k to 79k, invalid below 75k; ETH stop 2,330 under its 30-day low). Claude turns it into a normal Coinbase open handoff (`setup_type` `cb_zone_buy`, market buy with a price gate, stop under the structure he names, TP1 at 2R for half). The same 2% risk, one position per coin and every other limit apply, and `cb_run()` manages the trade exactly like a breakout trade (stop, TP1, trail, regime exit).

- **2026-10-11 v2.2:** risk per trade 5% → 2% and a 4% daily drawdown stop (Stavros, all books). The backtest at 3% risk returned 19.4%/yr with a −13% worst drawdown, so 2% means lower returns and shallower drawdowns.
- **2026-10-10 v2.1:** alts off for live trading (Stavros); paper tracking continues.
- **2026-10-10 v2.0:** open universe (§4b). 36 coins scanned and paper-traded; alts trade live only after 4+ paper trades averaging +0.5R, at half risk, while BTC is bull; core coins first. Strategist now heads Book 3 (with Robinhood); Grok executes both.
- **2026-10-10 v1.0:** book created. Research covered Coinbase capabilities, macro, and 36-variant backtests on BTC/ETH/SOL from 2016–2026.
