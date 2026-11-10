# Moonbag design log

The weekly design pass reads this file first. It lists each pass, Stavros's reactions to it, and his requests for the next pass.

## PRIORITY for the next pass — Stavros, 2026-10-18

"any A+ moonbag limit setups for btc eth sol or top 5 ... on site during next weekly update make sure its prominent"

- **What to build:** a prominent "A+ setups" strip at the top of the leverage desk, also mirrored on /dashboard. It shows every working A+ Moonbag limit setup for BTC, ETH, SOL and the rotation top 5: coin, side, limit, SL, TP1 and TP2, plus the data time.
  - TP1 is 2R (take 70%, then stop to entry).
  - TP2 is the runner.
- **When there are no A+ setups,** show one quiet line: "No A+ setups right now".
- **Data:** the setups come from limit_orders where grade = 'A+' and status = 'working' (setup_id woods_limit / limit_sweep / fib_75).
  - Use the loaders already on the page. If none exposes these rows, list the gap here so Claude can add it. Data and loader changes are outside the design pass.
- **Context:** from 2026-10-18, every A+ setup secures 2R at TP1 (TP1 = exactly 2R and the level becomes the runner). Show both targets clearly.
  - Stavros: "if i put tp at 2r i would have secured, i think you were shooting for 5r? runners are great but if we can shoot to secure 2r+ on all A+ limit setups - that would be great"

## PRIORITY — Stavros, 2026-11-09 (replaces the 10/18 priority above once done)

"Design wise, i want this to be as refined and futuristic as possible. this is the future of ai and trading - lets own this lane. 72 hour review here as well."
"We should be printing cash together, that is your main mission, anything else that doesnt work towards that is noise to me."

- **Direction:** a calm, precise, near-black instrument panel — the feel of a trading terminal built by a design studio, not a dashboard template. One accent (the existing green) used sparingly for money and "act now"; cyan for information; rose for loss/short; amber for caution. Thin 1px hairlines, generous spacing, mono numerals, real hierarchy: one hero number per page. Motion only where it carries meaning (a live price tick, a stale-data pulse). No decoration that isn't data.
- **Order of work:** (1) Command page — the 3-second read: today's BloFin result, prop room, what needs him now. (2) Leverage desk — one clear "what to do" zone, everything else one tap away. (3) Prop page. (4) A shared look for every ticket (the phone alert, the A+ card and the open-trade tile should read as the same object). (5) The rest.
- **Rules that stay:** every hard rule in the design-pass prompt; timestamps and stale warnings always visible; no copy buttons; nothing removed from a trade ticket; 375px phone; 40px taps. The tool is his: no mentor names in labels (use "Sweep machine", "Level map", "RSI bot", "macro read").
- **Cadence:** every 3 days from 11/9. Each pass: one theme, 3–8 finished improvements, log it here.

## Passes

## 2026-10-25 — A+ setups first (leverage desk)
- New "A+ setups" strip at the very top of the leverage desk: every working A+ limit on BTC/ETH/SOL + rotation top 5, one BloFin-style ticket each (limit, stop with % away, TP1 take 70% then stop to entry, TP2 runner, R:R, setup name, who placed it, cancel-by time, invalid-if, reasoning). No copy buttons.
- Each A+ ticket shows full inputs: size / leverage / margin / risk from the row, or the page's existing size / leverage / margin / risk / liquidation estimate when unsized.
- Data time always on the strip: header stamp (newest row), per-ticket "setup · updated" stamp, repeats the stale-market-data warning when the BloFin feed is red, amber line if the limit orders failed to load.
- Quiet state: one line, "No A+ setups right now".
- Paper A+ limits follow the same rule as "Needs you now" — muted while the paper limit record is negative, with a one-line count of how many were muted.
- "Needs you now": no longer repeats paper A+ limits already in the strip (badge still counts all), cards gained TP2 + data stamp, 2-up on phones.
- Open limits table: added TP2 column and a grade badge (A+/A/B) next to each coin.
- Files: app/dashboard/_components/APlusStrip.tsx (new), app/dashboard/leverage/page.tsx, app/dashboard/_components/Attention.tsx, app/dashboard/_components/Board.tsx
- Data gap (for Claude, outside the design pass): /dashboard can't mirror the strip yet — it doesn't call getLimits() or getBoard(). Add those loaders there, then drop in <APlusStrip rows={aplusRows(limits.open, board?.movers.map(r => r.asset))} .../>.
- Not shown on purpose: per-target quantities on the strip — limitInputs splits 50/50 while the 2026-10-18 rule is 70/30; the "Trade inputs" expander still shows them. Worth aligning limitInputs to 70/30 (lib change, outside design pass).
- Live site asked for a sign-in in the Claude browser, so this pass was reviewed from code only. npm registry was blocked in the sandbox, so the typecheck used shim types (no new errors vs baseline), not a full next build.
- Stavros's reaction: (pending)

## 2026-11-01 — Open trades first (leverage desk)
- Stale-market-data warning (red flag) now sits at the very top of "Needs you now", above the open-trade tiles, so it can't fall below the fold on a phone.
- Open-trade tile header reads like the A+/Woods tickets: big coin, ▲ LONG / ▼ SHORT in green/rose, leverage, risk-free / pending badges, plan R:R.
- Price rail gained a "+1R" mark (one original risk past entry — where the stop goes to entry), beside stop / entry / TP / live price.
- Live "how far" line under the rail: % from the live price to the stop and to TP1.
- Trade facts split into two labelled rows: LEVELS (Stop — "moved, was X" when moved — Entry, +1R, TP1, TP2, TP3 if any, each with its R) and POSITION (Size, Lev · margin, Liq ≈ with "beyond 1.25× stop / too close", Open for). Nothing removed.
- Trade tile footer adds "record <time>" (when the trade row was last updated).
- Your own resting BloFin limits show as BloFin-style tickets at the top of "Open limits" (limit, stop, TP1 · R:R, TP2 runner, size·lev, margin, risk, cancel-by, live price + distance to limit, invalid-if, touched time, order-updated stamp, id). Full table with paper rows unchanged below.
- Woods machine on a quiet day (all sides blocked, no trigger): Macro / divergence-combo / market-context banners fold behind one tap; anchor, weekly bias, feed stamps and stale warning stay visible. Fold toggles are 40px tap targets.
- Files: app/dashboard/_components/Attention.tsx, app/dashboard/_components/LivePrice.tsx, app/dashboard/_components/WoodsMachine.tsx, app/dashboard/leverage/page.tsx
- Note: since the 2026-10-30 edit, leverage/page.tsx no longer mounts APlusStrip.tsx — A+ cards show only inside "Needs you now". Left as is (not re-wired). If you want the strip back on top, say so.
- Reviewed from code only (live site asked for a sign-in in the Claude browser). npm registry blocked in the sandbox, so typecheck used shim types: no new errors vs baseline. 233 changed lines.
- Stavros's reaction: (pending)

## 2026-11-08 — Quiet hours: honest clocks, calm desk (leverage desk)
- Per-coin data clocks (BTC, ETH, SOL) under the "data" badge in the leverage desk header: bar time, age, green/rose from the feed's own ok/fresh flags, so a red page says which coin is behind.
- The same clocks sit right under the red "Market data is stale" alarm in "Needs you now".
- Woods machine on a quiet day leads with a "Nothing to place" status tile and the scan time; the how-it-works sentence moved to the footnote.
- Every Woods ticket has its own footer clocks: the coin's bar feed, the bar the scan read, and scan time. The stale banner lists the per-coin clocks too.
- "Needs you now" says it in one line when only the open trade is there: nothing else needs you, next hourly check at :25.
- A plan that isn't today's (weekends, evenings) folds to one line with its date, bias and the "not today's"/red-folder badges. Nothing inside was removed; one tap opens it. Today's plan is unchanged.
- Phone tap targets: the shared Expander header, "risk rules & milestone ladder" and "by account" are now 40px taps, no visual height change.
- Files: app/dashboard/_components/FeedStamps.tsx (new), app/dashboard/_components/Attention.tsx, app/dashboard/_components/WoodsMachine.tsx, app/dashboard/_components/OpenPlan.tsx, app/dashboard/_components/ui.tsx, app/dashboard/leverage/page.tsx
- Notes: the per-coin chips show the bar's own time (bar open, same as the Board's "bar" stamp); the page badge shows bar close, so they can read 15 min apart. Page-wide verdict is still feedHealth(), unchanged. APlusStrip still unmounted, awaiting Stavros.
- Reviewed from code only (live site asked for a sign-in in the Claude browser). npm registry blocked in the sandbox, so typecheck used shim types: no new errors vs baseline. 154 changed lines.
- Stavros's reaction: (pending)

## 2026-11-09 — Full-project audit (Claude in Cowork, at Stavros's request: "find everything that's broken, inconsistent, inefficient ... also make improvements to UI/UX")
Not a weekly design pass, but it touched the dashboard, so future passes should keep these:
- Command strip: money first. Today's BloFin result is the biggest number; the prop account has its own tile (balance, room today, room to floor, snapshot time); environment chips moved below; "red-folder" now reads "big-news day (red folder)".
- Leverage desk: restored what an earlier Claude edit had dropped — TP2 and the data time on A+ cards, and the TP2 column, grade badge and "Updated" time on Open limits. Copy now says the true schedule (Desk Lead every hour, Woods machine every 15 minutes); "late" means no run for 3 hours. The page's seven loaders now run together (faster open).
- Prop page: snapshot time on the balance tile; trades and daily log directly under the four tiles; rules, sizing, notes and Grok's instructions fold away; side badges and signed R like the rest of the site; stepper stacks on phones.
- Prop trades no longer leak into the Tracker's long-term tab or the Performance totals (real money only); Positions and the P&L calendar know the prop venue.
- Phone: "as of" time visible; nav tabs, sub-tabs, Refresh, "Open →" links and calendar toggles are 40px taps; Range board prices wrap 2-up instead of overlapping.
- Consistency: range low is green and range high is rose everywhere (Morning brief had them reversed); plain-English labels for SFP / 4H div / 1H trig / O/N / HTF / g4; null guards on gauge, mentors, entropy, board.
- Removed dead CSS (glass, conic-border, accent-underline, bg-dots, mask-bottom-fade, animated gradient) — nothing used it.
- Still unmounted, awaiting Stavros: APlusStrip.tsx. Unused: CopyButton.tsx (he banned copy buttons) — both can be deleted from the folder.
- Reviewed from code only (no npm in the sandbox; typecheck against the shim baseline shows no new errors).
