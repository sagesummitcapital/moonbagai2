import { withAgent, json, readJson, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { LIMIT_PATCH } from "@/lib/moonbag/limits";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUSES = ["working", "touched", "filled", "cancelled", "expired"];

/** Update a resting limit: moved price/stop/TP, cancelled, or filled (fill_price + trade_id). */
export const PATCH = withAgent(["grok", "claude"], async (req, _agent, ctx) => {
  const id = ctx.params.id;
  const body = await readJson(req);
  const patch = pick(body, LIMIT_PATCH) as Record<string, unknown>;
  if (patch.status && !STATUSES.includes(String(patch.status))) throw new BadRequest(`status must be one of ${STATUSES.join(", ")}`);
  if (patch.status === "filled" && patch.filled_at == null) patch.filled_at = new Date().toISOString();
  if (patch.status === "cancelled" || patch.status === "expired") (patch as Record<string, unknown>).resolved_at = new Date().toISOString();
  if (!Object.keys(patch).length) throw new BadRequest("Nothing to update.");
  const db = supabaseAdmin();
  const cur = await db.from("limit_orders").select("origin").eq("limit_id", id).single();
  if (cur.error) throw new BadRequest(`Unknown limit ${id}`);
  if (cur.data.origin === "paper") throw new BadRequest("Paper limits are managed by Moonbag only.");
  const up = await db.from("limit_orders").update(patch).eq("limit_id", id).select("*").single();
  if (up.error) throw new BadRequest(up.error.message);
  return json({ ok: true, order: up.data });
});
