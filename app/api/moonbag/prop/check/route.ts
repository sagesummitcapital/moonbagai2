import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";

const asBad = (e: unknown) => new BadRequest(e instanceof Error ? e.message : String(e));
import { checkPropTrade, checkText, checklistText, getPlanState, PRE_TRADE_CHECKLIST } from "@/lib/moonbag/propPlan";

export const dynamic = "force-dynamic";

/**
 * PROP PLAN CHECK (CR-73). Run it BEFORE every prop trade and relay `text` word for word.
 * GET /prop/check?account_id=BRK-PRO-10K-1                                    → today's plan state (OPEN / LOCKED, room, allowed risk)
 * GET /prop/check?account_id=…&coin=BTC&side=long&entry=…&stop=…[&qty=…][&leverage=…][&grade=A+] → PASS or BLOCK + reasons + max size
 * STALE = the last firm balance is older than the last prop fill, or 4h+ with a trade open: post a fresh snapshot first.
 * grade below A (or missing) is a warning, not a block.
 * CR-74: every answer carries his 11-item pre-trade checklist (`checklist`, and in `text`) — reminders only, never a block.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const account = q.get("account_id")?.trim() || "BRK-PRO-10K-1";
  const coin = q.get("coin")?.trim().toUpperCase();
  if (!coin) {
    const state = await getPlanState(account).catch((e) => { throw asBad(e); });
    const text = state.status === "OPEN"
      ? `PROP PLAN — OPEN. Risk allowed on the next trade: $${state.allowed_risk}. ${state.trades_left} trade(s) and ${state.losses_left} loss(es) left today.`
      : `PROP PLAN — ${state.status}: ${state.locks.join("; ")}.`;
    return json({ ok: true, text: state.status === "OPEN" ? `${text}\n${checklistText()}` : text, state, checklist: PRE_TRADE_CHECKLIST });
  }
  const side = (q.get("side") ?? "").toLowerCase();
  const entry = Number(q.get("entry"));
  const stop = q.get("stop") != null && q.get("stop") !== "" ? Number(q.get("stop")) : null;
  if (side !== "long" && side !== "short") throw new BadRequest("side must be long or short.");
  if (!Number.isFinite(entry) || entry <= 0) throw new BadRequest("entry is required.");
  const qty = q.get("qty") ? Number(q.get("qty")) : null;
  const leverage = q.get("leverage") ? Number(q.get("leverage")) : null;
  const grade = q.get("grade")?.trim() || null;
  const check = await checkPropTrade({ account, coin, side, entry, stop, qty, leverage, grade }).catch((e) => { throw asBad(e); });
  return json({ ok: true, text: checkText(check, coin, side), ...check, checklist: PRE_TRADE_CHECKLIST });
});
