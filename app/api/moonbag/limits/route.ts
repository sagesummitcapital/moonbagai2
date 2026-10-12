import { withAgent, json, readJson, requireFields, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { getLimits, limitsText, LIMIT_WRITE } from "@/lib/moonbag/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Open limit orders (his + Moonbag paper), the last 30 resolved ones and the scoreboard. `text` is relayed word for word. */
export const GET = withAgent(["claude", "grok"], async () => {
  const L = await getLimits();
  return json({ ok: true, text: limitsText(L.open), ...L });
});

/**
 * Record one resting limit order, or several (a DCA ladder) as {"orders":[...]} — each needs symbol, direction,
 * limit_price and stop. Stavros's own orders are origin "own" (default); Moonbag's suggestions he placed are "moonbag".
 */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  const list = Array.isArray(body.orders) ? (body.orders as Record<string, unknown>[]) : [body];
  if (!list.length || list.length > 10) throw new BadRequest("Send 1-10 orders.");
  const rows = list.map((o, i) => {
    requireFields(o, ["symbol", "direction", "limit_price"]);
    if (o.direction !== "long" && o.direction !== "short") throw new BadRequest('direction must be "long" or "short"');
    const r = pick(o, LIMIT_WRITE) as Record<string, unknown>;
    if (r.origin === "paper" && agent !== "claude") throw new BadRequest("Only Moonbag writes paper limits.");
    r.origin = r.origin ?? "own";
    r.source = r.source ?? agent;
    if (list.length > 1) { r.group_id = r.group_id ?? body.group_id ?? `${String(o.symbol).toUpperCase()}-ladder-${Date.now()}`; r.rung = r.rung ?? i + 1; }
    return r;
  });
  const db = supabaseAdmin();
  const ins = await db.from("limit_orders").insert(rows).select("*");
  if (ins.error) throw new BadRequest(ins.error.message);
  return json({ ok: true, orders: ins.data }, 201);
});
