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
