# Moonbag Holdings — Long-Term Thesis

Version 2 · 2026-10-09 · Owner: Stavros · Maintained by Claude
Robinhood Agentic account (ending 0349) · long-term sleeve = 25% of the account, DCA'd weekly over 8 weeks from 2026-10-09.

The idea is a Berkshire for the AI era. AI does the research, AI checks the research, and a database enforces the rules. Every buy, hold, avoid and "we were wrong" is recorded so it can be graded.

Analysis, not financial advice. Stavros decides; Grok executes inside database-enforced limits.

---

## 1. The outlook — three sources, one view

**1. Rich Dad (Kiyosaki).** He sees the dollar system as debt that can only be serviced by printing more of it. Savers and wage earners lose; owners of real assets and cash-flowing businesses win.

- He has been warning of "the biggest crash in history" through 2026. He buys gold, silver and bitcoin, and owns gold mines.
- He expects AI to eliminate jobs, and with them demand for office and residential real estate.
- His key habit for us: **crashes are sales on assets you already wanted.** That is why we DCA and buy harder into fear, but only in businesses whose thesis is intact.

**2. The Entropy Trap (Mickey M. Maini).** Complex systems look stronger as they add layers: more credit, more intervention, more workarounds. But each layer costs more to maintain, and each policy rescue buys less time.

- Stress builds out of sight. Prices can rise while the system weakens.
- Risk migrates from banks to nonbanks: private credit, BDCs, nonbank mortgages and commercial real estate.
- Gold is the structural core because it has no counterparty. Silver is the higher-beta version.
- The book's own warning: in 1933 the diagnosis was right but the gold was confiscated. **Being right about the regime matters more than the timing, and no single asset is safe.**

**3. Where the US government is putting its own money.** Since January 2025 the government has made about 39 equity or warrant investments, worth about $27.7B. They are in chips (Intel ~10%), rare earths and magnets (MP Materials 15%, USA Rare Earth), lithium (Lithium Americas), copper exploration (Trilogy Metals), foundries and quantum (GlobalFoundries, IBM, D-Wave, Rigetti) and munitions (L3Harris rocket motors). A government shareholder brings price floors, offtake, cheap capital and fast permits, so it backstops the downside of strategic businesses.

**Our synthesis.** We are in a regime transition, not a normal cycle. AI is the accelerant: it creates winners faster and destroys incumbents faster. In the transition:

1. **Own the builders of the new system.** These are the companies vertically integrating the physical AI economy: launch, connectivity, compute, robotics and energy.
2. **Own assets that don't need the old system to survive.** That means gold, silver, and the strategic supply chains the government is underwriting.
3. **Avoid, and paper-short, the businesses the new system makes obsolete.** They are often ones nobody expects. The live example: on Oct 8–9, 2026, SpaceX bought about $8B of 800 MHz spectrum and the FCC ruled it needs no carrier leasing deals. Verizon fell 11%, AT&T 10.8% and T-Mobile 13.2% in a day (about $39B wiped out), while tower owners rose 7–12%. A pre-mortem on the Musk thesis would have flagged those telcos in advance.
4. **Get paid for assets, not labor.** Musk's view, as reported in February 2026, is that AI and robots automate white-collar work first and physical work within about 3 to 7 years. If so, income shifts from wages to owning things that earn: equity, rent, royalties, protocol yield. Every holding should either compound in value or pay us, and preferably both.
5. **Expect AI FUD.** Each scare that sells off the builders without breaking their thesis is a buying opportunity. The rules below make this mechanical, not emotional.

## 2. The holdings (core) — target weights inside the sleeve

| Theme | Name | Target | FUD boost | Why |
| --- | --- | --- | --- | --- |
| Musk stack | **SpaceX (SPCX)** | 25% | yes | Launch, Starlink, direct-to-phone mobile with owned spectrum, and xAI compute (merged Feb 2026) |
| Musk stack | **Tesla (TSLA)** | 20% | yes | Autonomy, robotics and energy on the EV base |
| AI compute | NVIDIA (NVDA) | 10% | yes | The compute layer every AI-first company is short of |
| Hard money | Gold (GLD) | 12% | no | The Entropy Trap's structural core |
| Hard money | Silver (SLV) | 8% | no | Monetary plus industrial demand; higher beta |
| Hard money | Gold miners (GDX) | 5% | no | Operating leverage to gold |
| Sovereign industrial | Intel (INTC) | 8% | no | US government owns about 10%; the domestic leading-edge fab |
| Sovereign industrial | MP Materials (MP) | 7% | no | Department of Defense owns 15%, plus a price floor and offtake on rare earths |
| Sovereign industrial | Freeport (FCX) | 5% | no | Copper, the bottleneck metal; a likely next government target |

- **SpaceX and Tesla are capped at 45% combined**, and **no single name above 30%** of the sleeve. You said you can't own enough of SPCX and TSLA, but you still want to diversify; the cap protects the sleeve from one bad Musk headline.
- **Theme mix:** Musk 45% · hard money 25% · sovereign industrial 20% · AI compute 10%.
- **Today's numbers.** The sleeve is about $25 now. Each name's dollar target and gap update in `v_lt_sleeve` every time the account equity changes.

## 3. How we buy — DCA rules (database-enforced)

1. **Pace.** The sleeve is split evenly over 8 weekly buys, starting 2026-10-09 and then every Monday. Each week's money goes to the names furthest below target, at least $1 per order (Robinhood fractional minimum). A name with less than $2 left to its target gets one order for the rest.
2. **Orders.** Fractional orders are market-only, with a price cap. Grok buys only if the price is at or below the cap (the reference price + 1.5%); otherwise it waits for its next check. Never chase.
3. **FUD boost** (SPCX, TSLA and NVDA only). If a name closes the week 15% or more below its 26-week high and its thesis is intact, that week's buy is doubled, borrowed from future weeks so the total stays the same.
   - Backtest: the boost improved weekly DCA on TSLA (+2.5 pts over 1 year, +5.6 over 3 years) and SPCX (+2.1 since its IPO).
   - It made silver worse (-1.5 over 1 year, -14 over 3 years), so **metals don't get a boost.** Silver also skips a week after a weekly close below the prior week's low.
4. **Separate rules from the trading sleeve.** Long-term buys don't count toward the 2 fills a week, one symbol a day, A-setups only or the $12 loss box.
   - They have no hard stops. Exits happen only on a written **thesis break** (each name's `break_rule`), confirmed by the weekly review.
   - Account-wide limits still apply: the $90 soft halt, 80% gross exposure and the blocked list (VRF, no crypto).
   - The trading sleeve's 8% drawdown breaker does **not** stop the DCA. Buying fear is the point.
5. **After the 8 weeks.** The sleeve is fully deployed. New deposits are split 25% long-term (same weights, same DCA) and 75% trading. The weights are rebalanced quarterly, by new money only and never by selling winners, unless a thesis breaks.

## 4. Watchlist — buy only after promotion

Government-backed or on-thesis, but not yet proven enough to own: USA Rare Earth, Lithium Americas, Trilogy Metals, GlobalFoundries, IBM, L3Harris (watch the rocket-motor spin-off, where the government's stake becomes common equity), Kratos, AeroVironment, Huntington Ingalls, Cameco, D-Wave and silver miners (SIL).

**Promotion** happens at the weekly review only. It needs the add-rule met (for example, production started, or the stock reclaimed its 200-day average) plus a written reason. Promotion re-balances the targets. The evidence so far: most of the small government-backed names are down 38–71% over 12 months. **A government stake has not protected the share price**, which is why they start on the watchlist.

## 5. Avoid list — the entropy losers (paper shorts)

The account is long-only, so these are **avoided**, and each is tracked as a **paper short** (stop +20%, target −30%, 26-week horizon). That grades whether the thesis is right.

| Mechanism | Names (paper short entry, 2026-10-09) |
| --- | --- |
| Starlink becomes a mobile and broadband carrier | VZ 41.26 · T 22.18 · TMUS 148.63 · CMCSA 20.56 · CHTR 103.09 |
| Nonbank credit is where the next stress spreads (Entropy Trap) | BDC ETF (BIZD) 12.17 · Blue Owl (OWL) 9.64 · regional banks ETF (KRE) 69.08 |
| AI job loss hits office demand (Kiyosaki) | SLG 48.51 |
| Robotaxi cost curve vs legacy auto | F 12.18 |

**Entropy scan, weekly.** For every new move by a core holding (a SpaceX launch, spectrum, a product or contract; a Tesla robotaxi city; an NVIDIA platform), the review asks: **who just lost pricing power?** New losers are added to this list with their mechanism.

## 6. Feedback loop — AI evaluating AI

| When | What | Changes allowed |
| --- | --- | --- |
| Every Monday (daily cycle) | Issue the week's DCA handoffs from `v_lt_sleeve` gaps; apply the FUD boost or silver skip | none (mechanical) |
| Every Saturday (weekly review) | Sleeve vs SPY over the same dates · DCA vs lump-sum · FUD boost vs plain DCA per name · paper-short scorecard for the avoid list · entropy scan · watchlist add-rules · thesis-break check per name | Promote or demote a watchlist name; flag a thesis break (Stavros confirms any sell) |
| Monthly (ownership review) | "What do we own now that we didn't 30 days ago?" by theme | Propose weight changes (Stavros approves) |
| Quarterly | Full thesis rewrite: does each theme's "what would break it" read truer than its evidence? | New version of this file |

**Rules for changing the rules:**
- Weight changes need at least 8 weeks of data, or a broken thesis.
- No weight goes up just because the price went up.
- Every week the review writes down the strongest evidence **against** each theme.

## 6b. The whole balance sheet — real estate and DeFi

The Robinhood sleeve is only one part of what Stavros owns. The thesis is judged on the **whole balance sheet** (`v_balance_sheet`), and each part is labelled as either paying us or not.

**Real estate (US and Greece; rentals and personal)**
- Each property is one row in `real_assets`. Stavros gives only the address and whether it is a rental or personal. Claude researches an estimated value, and Stavros fills in what only he knows: mortgage balance, rate and payment, monthly rent and costs. Greek properties are in EUR and converted using `fx_rates`.
- **Rentals** count as income-producing assets. They are tracked for equity, debt as a share of value, net rental yield and annual cash flow.
- **Personal homes** count toward net worth and the hard-asset share, but **not** toward yield. A home you live in doesn't pay you. It saves rent and protects against inflation, so it's kept separate rather than left out.
- **Monthly review** (`v_real_estate`):
  - Refresh any value older than 6 months and the EUR rate.
  - Flag any rental earning less than its mortgage rate (that property is losing money on borrowed money).
  - Report real assets (property + gold/silver + Musk/strategic equity) as a share of net worth.
- Addresses stay in the database only. They never go into posts, messages or memory.

**DeFi yield (crypto capital only — nothing moves until Stavros has deployable crypto)**
- **One-time scan on 2026-10-09** (`defi_scans`), sorted into tiers:
  - **Cash-like.** Aave USDC about 6% and Morpho curated vaults about 6%, though part of Morpho's is fading token rewards. Sky/Spark savings at 3.75% is rejected: it's below the Treasury benchmark.
  - **Real-world yield — candidates.** USD.AI sUSDai about 6.9% (stablecoins funding loans backed by GPUs, which fits the AI thesis) and Centrifuge about 6.2% (tokenized T-bills and credit).
  - **Real-world yield — watch.** Re reUSD about 7.0% and OnRe ONyc about 11% (both reinsurance-backed).
  - **Structured — watch.** Ethena (yield from perp funding, which goes to zero in risk-off markets) and Pendle fixed-rate positions.
  - **Rejected.** Emission-driven farms (e.g. a 16% Yearn CRV vault).
  - **Benchmark.** The median stablecoin pool above $100M in deposits paid about 4.0%.
- **Rules before any money moves:**
  1. The yield must come mostly from real cash flow, not token rewards.
  2. At least $100M deposited and at least 12 months live, with audits.
  3. It must beat Treasuries by 1.5 points or more.
  4. No more than 25% of the crypto sleeve in any one protocol.
  5. A known way to withdraw.
- **Entropy warning.** The Trap names nonbank credit as where stress spreads next, and much of DeFi yield *is* nonbank credit. So the DeFi bucket stays small, prefers T-bill-backed and AI-compute-backed yield, and is cut first if credit stress shows up.
- **Monthly re-scan** (1st of each month, ownership review): refresh the tiers, record new rows, check for hacks or depegs, and say plainly "nothing worth the risk" when that's the answer.

## 7. Evidence against (read before adding)

- **Valuations already price in a lot of success.** SPCX is about $2.2T after a 50% post-IPO swing; TSLA is down 11% over 12 months and below its 200-day; NVDA is about $5.5T.
- **The metals blow-off may be behind us.** Silver is down about 41% from its January peak, and gold is about 8% below its 200-day. Weekly DCA into silver over the past year lost about 9%.
- **Government backing ≠ returns.** MP is down 38%, USAR 57% and LAC 71% over the year. Policy can also reverse.
- **Crash calls have a long record of being early.** Kiyosaki has warned of a crash for over a decade, and the S&P is near all-time highs (SPY 778).
- **Concentration.** 45% in two companies run by one person is key-person risk by design.

## 8. Change log

- **2026-10-09 v2:** Added the labor-to-assets principle, the real-estate ledger (rentals pay; personal homes count for net worth only), the whole-balance-sheet view, and the DeFi yield scan (first scan done; monthly from Nov 1; no money moves until crypto is deployable).
- **2026-10-09 v1:** Created.
  - Sleeve set at 25%, 8-week weekly DCA.
  - Themes activated: musk_stack, hard_money, sovereign_industrial, ai_infrastructure_core. entropy_losers set to watch.
  - Lists: 9 core names, 12 watchlist names, 10 avoid names (paper shorts opened).
  - Week 1 buys: SPCX, TSLA, GLD.
