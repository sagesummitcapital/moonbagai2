# The Mentor Library — Eliz (macro) + Woods (micro)

Stavros, 2026-10-16: "i really like eliz on macro and woods on micro - i follow them both closely - maybe i can send you their updates and you fold them in? we should log updates to strategy but i do think they have good and have been trading successfully for a while. i want you to pretend this is their last cycle and lets get as much knowledge about how they think so we can keep it going when they are gone."

This file explains how Moonbag captures how they think and keeps trading their way. The live library is in the database and on moonbag.ai/dashboard/mentors.

Analysis, not financial advice. Stavros places every BloFin order, and his risk rules always win.

---

## 1. Who does what

| | Eliz | Woods |
|---|---|---|
| Layer | **Macro: WHERE** | **Micro: WHEN** |
| Timeframe | Weekly structure | 4H setup, 1H/15m entry |
| Gives us | The weekly range, the buy zone, the level that changes the structure, the macro resistance, the invalidation | The BTC line in the sand, the flip, demand/supply/liquidity, the four-part trigger, the management |
| In Moonbag | `woods_levels` source `eliz` (1w). Her macro line plus a 10-point macro score in the Woods machine | `woods_levels` source `woods`. The anchor, the four checklist legs, limits, and 70% at the first pop |

**How they combine:**
1. Eliz decides where it is worth trading: near support in her range, never chasing mid-range or the top.
2. Woods decides when, using the sweep → close back → 4H divergence → 1H trigger. That trigger is Eliz's "wait for a reaction, a recovery, or a valid trigger".
3. When both agree, the ticket scores highest. A Woods long inside Eliz's buy zone gets the full macro score. A long that chases her range top gets none.

## 2. The pipeline (every post they make)

1. **Capture, word for word.** Stavros forwards the post to Grok, or pastes it to Claude. It goes to `POST /api/moonbag/mentors {"mentor":"eliz"|"woods","raw_text": …}` and is stored in `mentor_posts`. Raw text is never edited.
2. **Distil, within a day.** The 5:15 AM open planner does this on weekdays, and the Saturday review catches weekend posts such as Eliz's Fridays. Each post produces four things:
   - **levels** go to `woods_levels`, and a new map replaces that mentor's old one;
   - **principles** go to `mentor_principles` (the rule, their quote, and where Moonbag applies it), with repeats counted and contradictions marked superseded;
   - **calls** go to `mentor_calls`: testable statements with a condition (zone hold, reclaim, reject, hold level, reach) and a time limit;
   - **questions** go to `mentor_questions`: gaps in how they decide.
3. **Log it.** Every update writes a `strategy_changes` row. Levels, principles and calls are adopted at once. A change to a Moonbag rule (risk, sizing, the trigger, stops, targets) is only proposed, and needs Stavros's OK.
4. **Use it.** `woods_scan()` re-runs right away, so the Woods machine shows the new levels and Eliz's macro line within 15 minutes.
5. **Grade it.** `mentor_grade_calls()` runs nightly on daily and 4H candles, marking each call right, wrong or void. `v_mentor_record` shows each mentor's hit rate, so we learn whose read to weight in which market.

## 3. "When they are gone": succession mode

If a mentor hasn't posted for 14 days, the Saturday review writes Moonbag's own map **in their style**, using only their active principles and current price:
- **Eliz-style weekly map:** range, buy zone with confirmation, reclaim level, macro resistance, invalidation.
- **Woods-style daily map:** line in the sand, flip, demand/supply, liquidity pools.

These maps are saved as posts with source `moonbag-succession` and are clearly labelled "Moonbag, <Name>-style". Moonbag never pretends a map is theirs. The calls they generate are graded like everyone else's, so the succession map has to earn trust too.

## 4. Ask them while you can

The library is only as good as the parts of their thinking we can't see in a post. `mentor_questions` holds the open gaps, ranked by priority. They're shown on the Mentors page and in `GET /mentors`. The first set:

**Eliz**
- How the weekly range is drawn, and when it's redrawn.
- What "confirmation" at the buy zone is, exactly.
- What "a clear break below the lower weekly structure" is in numbers.
- Which macro inputs she weights.
- How she scales into a zone.
- How she rebuilds the structure after a breakout.
- Her biggest misses.

**Woods**
- How he picks the order block that matters.
- How the line in the sand is set and moved.
- Which two lows the RSI divergence compares, and what oversold means to him. This was the weakest leg in our mechanical test.
- What a valid 1H/15m trigger is: on the close, or on a retest.
- Where the first pop is.
- Hedge size and timing.
- Which sessions he trades.
- Common student mistakes.

When they answer, send the answer like any post. It becomes a principle and closes the question.

## 5. What's on file (2026-10-16)

- **Eliz — Fundamental Fridays, Week 10** (post #1, verbatim):
  - Levels: BTC 70–74k buy zone, with confirmation only; 87–88k range top, where a weekly close above shifts the structure; 97–100k macro resistance and decision zone.
  - 10 principles.
  - 4 graded calls.
- **Woods — strategy run-down + the 10/15 map** (post #2):
  - **Reconstructed** from Stavros's relay; his exact words weren't kept. Stavros: please resend the original.
  - 12 principles: one strategy; BTC anchor; top-down; levels; no-man's land; the four-part trigger; news; limits at edges; stop past the wick; 70% at the first pop; hedge; flip only on acceptance.
  - 2 graded calls.
  - Levels: line in the sand 82,400–82,800, flip 82,800, demand 79,710–80,000.
- **X digests, posts #3 (Eliz) and #4 (Woods):** scraped 2026-10-16 and reviewed by Stavros on 2026-10-17. What he adopted is listed in section 6.

## 6. What they look at, so we can look at it ourselves (adopted 2026-10-17)

Stavros: "meshing the minds to create a super trader".

**Both of them watch the same short list:**
- ranges, and the middle of the range as no-man's land;
- time levels;
- sweep → reclaim → retest (SFP);
- demand zones and order blocks;
- the 0.75 / 0.786 retracement;
- a Monday plan, with limits at levels;
- take half off, then go risk-free.

| Adopted | Where it lives |
|---|---|
| Monday high/low | woods_scan pool, 15 pts (WOODS-MONDAY-01) |
| Yearly open, monthly open, previous month H/L, weekly open | woods_scan pools: 20, 18, 18, 12 pts (ELIZ-TIME-01) |
| Fib 0.75–0.786 of the last 4H impulse leg | woods_scan `fib`, 10 pts, `FIB✓` on limits (ELIZ-FIB-01, WOODS-FIB-01) |
| EMA200 on 4H | **Paper only.** A flag with 0 pts; the Saturday review proposes 10 pts if limits flagged EMA200✓ beat the rest by ≥ 0.15R on 10+ resolved (WOODS-EMA200-01) |
| Mentor Lens checklist | Monday open planner (v7). 8 points: weekly 3 boxes, time levels, zones, liquidity, trigger state, momentum/fib/EMA200, news week, mentors. Produces Moonbag's **weekly bias draft** |
| Weekly bias | `weekly_bias`. Stavros confirms or overrides it on Monday through Grok (`POST /api/moonbag/bias`). It scores 10 pts in the Woods machine, and on Saturday his call and the draft are graded separately |
| Market context: TOTAL, USDT dominance, ETH/BTC (added by Stavros 2026-10-17) | The Woods machine's Market line. USDT.D down + TOTAL up = risk-on, the mirror = risk-off; ETH/BTC up = alts leading. **Paper only:** CTX✓ on limits with 0 pts, tested Saturdays (ELIZ-CONTEXT-01) |
| Weekly X scrape | Saturdays 6:15 AM, using the built-in browser on Stavros's computer. It keeps trade and macro posts word for word, drops promos, and saves them to `mentor_posts` for the 6:59 review intake |

**Not adopted:** a post-CPI wait card.

**Can't be copied:** Woods' paid bot. About half of his feed is promotion and is ignored.
