import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { checkPropTrade, checkText, getPlanState } from "@/lib/moonbag/propPlan";

export const dynamic = "force-dynamic";

/**
 * PROP PLAN CHECK (CR-73). Run it BEFORE every prop trade and relay `text` word for word.
 * GET /prop/check?account_id=BRK-PRO-10K-1                                    → today's plan state (OPEN / LOCKED, room, allowed risk)
 * GET /prop/check?account_id=…&coin=BTC&side=long&entry=…&stop=…[&qty=…][&leverage=…] → PASS or BLOCK + reasons + max size
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const account = q.get("account_id")?.trim() || "BRK-PRO-10K-1";
  const coin = q.get("coin")?.trim().toUpperCase();
  if (!coin) {
    const state = await getPlanState(account);
    const text = state.status === "OPEN"
      ? `PROP PLAN — OPEN. Risk allowed on the next trade: $${state.allowed_risk}. ${state.trades_left} trade(s) and ${state.losses_left} loss(es) left today.`
      : `PROP PLAN — LOCKED: ${state.locks.join("; ")}.`;
    return json({ ok: true, text, state });
  }
  const side = (q.get("side") ?? "").toLowerCase();
  const entry = Number(q.get("entry"));
  const stop = q.get("stop") != null && q.get("stop") !== "" ? Number(q.get("stop")) : null;
  if (side !== "long" && side !== "short") throw new BadRequest("side must be long or short.");
  if (!Number.isFinite(entry) || entry <= 0) throw new BadRequest("entry is required.");
  const qty = q.get("qty") ? Number(q.get("qty")) : null;
  const leverage = q.get("leverage") ? Number(q.get("leverage")) : null;
  const check = await checkPropTrade({ account, coin, side, entry, stop, qty, leverage });
  return json({ ok: true, text: checkText(check, coin, side), ...check });
});
