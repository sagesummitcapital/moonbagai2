import { withAgent, json, readJson, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { INTAKE_FIELDS } from "@/lib/moonbag/dayCards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PATCH /trade-intakes/{id}
 *   {action:"confirm", trade_id}   → only after his screenshot: screenshot_confirmed + status confirmed + linked trade (log the trade via POST /trades first)
 *   {action:"skip", notes?}        → he passed on it (skipped ideas are scored too)
 *   {action:"cancel"}              → logged by mistake
 *   otherwise: edit draft fields (not once confirmed)
 */
export const PATCH = withAgent(["claude", "grok"], async (req, _agent, { params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw new BadRequest("Bad intake id.");
  const body = await readJson(req);
  const db = supabaseAdmin();
  const cur = await db.from("trade_intakes").select("status").eq("intake_id", id).maybeSingle();
  if (!cur.data) throw new BadRequest(`No intake ${id}.`);
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (body.action === "confirm") {
    if (!body.trade_id) throw new BadRequest("confirm needs trade_id (log the trade with POST /trades after his screenshot).");
    patch = { status: "confirmed", screenshot_confirmed: true, confirmed_at: now, trade_id: String(body.trade_id) };
  } else if (body.action === "skip") patch = { status: "skipped", ...(body.notes ? { notes: String(body.notes) } : {}) };
  else if (body.action === "cancel") patch = { status: "cancelled" };
  else {
    if ((cur.data as { status: string }).status === "confirmed") throw new BadRequest("Confirmed intakes are locked.");
    patch = pick(body, INTAKE_FIELDS);
  }
  const r = await db.from("trade_intakes").update({ ...patch, updated_at: now }).eq("intake_id", id).select().single();
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, intake: r.data });
});
