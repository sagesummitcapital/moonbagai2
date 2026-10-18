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

(none yet)
