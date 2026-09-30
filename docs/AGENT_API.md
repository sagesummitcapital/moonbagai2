# Moonbag Agent API — how Claude and Grok share one brain

Base URL: `https://moonbag.ai/api/moonbag`
Auth header on every call: `Authorization: Bearer <key>`

- `MOONBAG_CLAUDE_API_KEY` → Claude (strategy layer: full read/write)
- `MOONBAG_GROK_API_KEY` → Grok (reads theses/handoffs, answers handoffs, records Robinhood trades)

Chat history is never the source of truth. These records are (spec §15, §25).

## Endpoints

| Method & path | Who | Purpose |
| --- | --- | --- |
| `GET /today` | both | System state, active theses, pending handoffs, live alerts, open trades, latest report |
| `GET /yesterday[?date=YYYY-MM-DD]` | Claude | Yesterday's theses + evaluations + trades + everything still ungraded |
| `GET /theses?date=&status=&asset=` | both | List theses |
| `POST /theses` | Claude | Publish a thesis (IDs/timestamps assigned by DB) |
| `GET /theses/{thesis_id}` | both | One thesis |
| `PATCH /theses/{thesis_id}` | Claude | Status only: `expired` / `invalidated` / `cancelled` |
| `POST /evaluations` | Claude | Grade a thesis (immutable). Recomputes System Confidence |
| `GET /evaluations` | both | Graded history with thesis context |
| `POST /alerts` · `PATCH /alerts/{alert_id}` | Claude | Record TradingView alerts / link `tv_alert_id` / mark triggered or cancelled |
| `GET /handoffs?status=pending` | both | Grok's inbox |
| `POST /handoffs` | Claude | Create a Robinhood handoff for Grok |
| `PATCH /handoffs/{handoff_id}` | Grok | `acknowledged` / `executed` / `rejected` + `status_reason`, `grok_response` |
| `POST /trades` · `PATCH /trades/{trade_id}` | both | Record / open / manage / close executions (Grok: Robinhood fills + BloFin trades Stavros reports) |
| `GET /system-state` · `POST /system-state` | both / Claude | Read or recompute confidence (+ `current_regime`, `risk_environment`) |
| `POST /reports` · `GET /reports` | Claude / both | Save/read the MOONBAG DAILY markdown |
| `POST /size` | Claude | Position sizing (leverage last) → `TRADE_PLAN` or `NO_TRADE` |

Errors come back as `{ "ok": false, "error": "…" }`. Immutability violations are `400` with a clear message.

## Rules the database enforces

- One **active** thesis per asset per day. To change it: `POST /theses` with `supersedes` + `change_reason`.
  The old version becomes `superseded`; its live alerts become `stale` (cancel them in TradingView, then
  `PATCH /alerts/{id} {"status":"cancelled"}`) and its open handoffs become `cancelled`.
- Theses cannot be edited or deleted. Evaluations cannot be edited or deleted.
- Trade plan fields (entry, original `stop`, targets, risk, size, leverage, exit, P&L) are **write-once**.
  Use `current_stop` for trailing stops. `r_multiple` is computed from the original stop.
- `risk_percent` above 5 is rejected.
- Alerts and handoffs can only be created for an **active** thesis.

## Daily cycle (Claude)

1. `GET /yesterday` → grade every ungraded thesis with `POST /evaluations`
   (component scores 0–100: direction, levels, setup, invalidation, target; null = not applicable).
2. Analyze current market (TradingView MCP + macro).
3. `POST /system-state` with `current_regime`, `risk_environment`.
4. `POST /theses` for MASTER, BTC, ETH, equities (or `supersedes` for material changes).
5. Create TradingView alerts via MCP → `POST /alerts` with the returned `tv_alert_id`.
6. `POST /handoffs` for Robinhood opportunities; `POST /size` for BloFin setups.
7. `POST /reports` with the MOONBAG DAILY markdown.

## Paste this into Grok's instructions

```
You are Grokbot, Moonbag's Robinhood execution layer. Claude is the canonical strategy layer.
Never rely on chat history; use the Moonbag API.
Base URL: https://moonbag.ai/api/moonbag   Header: Authorization: Bearer <MOONBAG_GROK_API_KEY>

1. GET /handoffs?status=pending  — your inbox. Each handoff has handoff_id, thesis_id, symbol,
   direction, entry_condition, invalidation, target_framework, position_guidance, conditions_to_cancel.
2. Before acting, GET /theses/{thesis_id}. If its status is not "active", do not trade.
3. When you start working a handoff: PATCH /handoffs/{handoff_id} {"status":"acknowledged"}.
   If you disagree or conditions fail: {"status":"rejected","status_reason":"…"}.
4. When you fill: POST /trades {"thesis_id","handoff_id","venue":"robinhood","symbol","direction",
   "entry","quantity","position_value","portfolio_percent","stop","target","status":"open"}
   then PATCH /handoffs/{handoff_id} {"status":"executed"}.
5. When you exit: PATCH /trades/{trade_id} {"exit_price","realized_pnl","return_percent",
   "holding_period","status":"closed","execution_notes"}.
6. Never change entry, stop or targets after they are recorded. Use "current_stop" for stop moves.
7. Flag thesis conflicts in grok_response instead of creating your own thesis.

BLOFIN LEVERAGED TRADES (Stavros executes manually on BloFin and tells you):
8. Find the thesis: GET /theses?status=active&asset=BTC (or ETH) → use its thesis_id.
9. When he opens: POST /trades {"thesis_id","venue":"blofin","symbol":"BTC" or "ETH","direction",
   "account_equity","entry","stop","tp1","tp2","tp3","quantity","position_notional","margin",
   "leverage","risk_dollars","risk_percent","status":"open"}. Ask him for any value he didn't give;
   never guess entry or stop.
10. When he moves his stop: PATCH /trades/{trade_id} {"current_stop": X}. Never change "stop".
11. When he closes (fully): PATCH /trades/{trade_id} {"exit_price","realized_pnl","fees","status":"closed",
   "execution_notes"}. If he only took partial profit, put it in execution_notes and keep status "open".
12. Moonbag watches open BloFin trades and switches his TradingView alerts from entry triggers to
    next-level alerts (next target / stop) at its next check.
```
