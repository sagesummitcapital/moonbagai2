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

## 2026-11-10 — Command page: the 3-second read
- Today's BloFin result is the one hero number: about twice the size of anything else on the page (40px phone, up to 56px desktop), with a thin green/rose/grey bar beside it for up/down/flat.
- Month, prop, on-plan and discipline became one instrument row next to the hero, split by hairlines instead of four boxes. Same numbers, same links.
- Prop room reads as numbers: "room today", "to floor" and "to pass" on their own lines under the balance; whichever has run out turns rose. Snapshot time stays underneath.
- "Right now" card is titled "Needs you now" or "Nothing needs you". A small green dot pulses only when a trade is open or a desk alert is live. The all-clear sentence is shorter and quieter; coin names on the tiles are a bit larger.
- Data age row is a full 40px tap with a green/amber dot ("all feeds on time" / "N late"). It still opens by itself when anything is late.
- Green means one thing on the page: the Leverage book card no longer turns green alongside "Needs you now". The three book balances and the market bias drop from 26px to 20px so they sit below the hero.
- Retail / News / Weekend chips are hairline chips with no fill unless they are an amber warning, in the strip's footer.
- Headline numbers use an instrument style (fixed-width digits, slashed zero, new `.fig` class). A red (stale) data stamp's dot now pulses gently — site-wide, since it lives in the shared stamp; off under reduced-motion.
- Files: app/dashboard/_components/Command.tsx, app/dashboard/_components/RightNow.tsx, app/dashboard/_components/ui.tsx, app/dashboard/page.tsx, app/globals.css
- Notes: nothing removed (every field, stamp, link and warning condition kept); no loader, query or formula touched. tailwind.config.js decorative tokens left in place. APlusStrip still unmounted, awaiting Stavros.
- Reviewed from code only (live site asked for a sign-in in the Claude browser). npm registry blocked in the sandbox, so typecheck used tsc 7 with shim types: no new errors vs baseline. ~141 changed lines.
- Stavros's reaction: (pending)

## 2026-11-16 — Leverage desk: the 3-second status read, and one ticket look
- "Needs you now" opens with a one-line verdict in large type: whichever of these is true first: "Data is stale — don't trade", "N open trade — manage it", "limit touched — check BloFin", "Sweep trigger — ticket ready", "N A+ setups ready to place", or "Nothing to place — stand down". A thin coloured bar and dot (rose / green / amber / grey) sit beside it. The dot pulses only for stale data or an open trade. Display only: it names a state the page already shows and decides nothing.
- Four instrument numbers under the verdict replace the two small grey badges: In the market (count + open risk), Ready to place (A+ count, Sweep machine "X of Y sides tradable" + scan time), Resting limits (yours, or "touched — filled?"), Day stop 2% in dollars (same figure the account card prints).
- One ticket look: the open-trade tile, A+ card, Sweep-machine ticket and resting-limit ticket share a header (COIN ▲ LONG, badges, R:R on the right), hairline fields with instrument numerals, labelled ORDER / LEVELS / POSITION rows and a footer for clocks and ids. These are the new shared Ticket parts in ui.tsx. The Tracker's open leverage trades pick this up too, since they use the same tile.
- Your own resting BloFin limits show as tickets at the top of "Open limits" again (logged 11/1, then lost from the page). Each ticket has limit, stop, TP1 with R, TP2 runner, size, leverage, margin, risk, "Cancel if", the order-updated stamp, cancel-by, touched time and id. A touched one turns amber. Unsized rows show the page's suggested inputs, marked "suggested — see Trade inputs". The full table with paper rows is unchanged below.
- A+ card reads like an order form: "Buy limit / Sell limit", "Stop loss", plan R:R in the header, data stamp leading the footer.
- Mentor names out of visible copy: "WOODS TRIGGER" → "SWEEP TRIGGER"; the journal's line-filter rows no longer print a name before the rule.
- Files: app/dashboard/_components/ui.tsx, app/dashboard/_components/Attention.tsx, app/dashboard/_components/WoodsMachine.tsx, app/dashboard/leverage/page.tsx
- Held back (needs Stavros's OK, it would be a new warning, which is outside a design pass): two amber cautions under the verdict. The first: "Your last two BloFin trades were losses — two losses = done" (from sizing.lossStreak, which only means the last two closed trades lost, not "today"). The second: "Big-news day (red folder) — no fill within 2h of the release" (sizing.redDay). Say yes and the next pass adds them.
- Data gaps (for Claude, outside the design pass): there is no "BloFin paused" field, so the verdict can't say "paused". The day-stop figure is the page's existing 2%, but risk_config.daily_loss_stop_pct exists and recent runs mention a 4% daily stop, so check which one is right.
- Reviewed from code only (live site asked for a sign-in in the Claude browser). npm registry blocked in the sandbox, so typecheck used tsc 7 + shim types: no new errors vs baseline. ~344 changed lines. Built on Fable.
- Stavros's reaction: (pending)

## 2026-11-19 — Prop page: the 3-second read
- One panel at the top answers "can I trade, and how much?": the hero is the most you can risk on the next trade (big, green). When the plan is locked it reads LOCKED in rose, with the lock reasons under it.
- An out-of-date balance says so: when the plan's status is stale, the hero reads "OUT OF DATE — no new trades until a fresh snapshot" with a pulsing rose dot, instead of a plain LOCKED. Same state, same lock reasons.
- Snapshot time sits in the panel's top line ("balance snapshot · taken … (Xh ago)", green/amber/red by age) and stays on the Balance number too.
- Firm limits are one instrument row with thin meters: Room today, To the floor, To pass, Balance. Room turns amber when thin and rose when nearly gone (same thresholds). Balance is white, with "+/−$ since start" in green/rose under it.
- Your plan today is a second instrument row: Trades left, Losses left, Today's result (pnl_today, already loaded), To day stop, To floor (plan, counts open trades at stops) and Open risk at stops. The rules are one short line, with the full 11/13 rules text one tap away, word for word. The 11 checks are a 40px tap and still open by themselves when the plan is open.
- Open prop trades use the shared ticket look: coin, ▲ LONG / ▼ SHORT, risk, risk % of start, leverage, opened time, firm-flag badge, note and id. A flagged one turns amber.
- Phone: the 10-column trades table becomes a three-line row per trade under 640px, with every column kept; the desktop table is unchanged. The Daily log fits 375px.
- Less noise: the three "Evaluation → Passed → Funded" boxes are one slim line, and "What your BloFin data says" folds away with the rules and sizing. The breached note moved to just under the page title.
- Files: app/dashboard/prop/page.tsx
- Held back (needs Stavros's OK): a "plan didn't load" notice (today the panel quietly falls back to Balance as the hero); plain-English rewording of raw lock reasons; a tighter snapshot freshness window than 24h while a trade is open.
- Data gaps (for Claude, outside the design pass):
  - PropTrade (v_prop_adherence) has no entry, stop, target, size or live price, so the prop ticket says "read them on Breakout". Add those columns to the view and the type.
  - Firm "to floor" (snapshot) and plan "to floor" (counts open trades at stops) are both shown and labelled; confirm the difference is intended.
  - GROK_PROP_PLAYBOOK in lib/moonbag/prop.ts names mentors in item 5c, and it shows in the "How Grok handles this account" fold. That file is read-only for the design pass.
  - Rule numbers ($100, $50 inside $200, 2 trades) are hard-coded in the copy, while p.rules carries live values.
- Reviewed from code only (the live site asked for a sign-in in the Claude browser). The npm registry was blocked, so the typecheck used global tsc 7 without packages: no new real errors, and only missing-package/key-prop noise vs the baseline. 301 changed lines. Built on Fable.
- Stavros's reaction: (pending)
