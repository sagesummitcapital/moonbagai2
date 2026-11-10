import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * CORRECTIONS (CR-66, Stavros 11/9: "Yes, results only"). Fixes a LOGGING MISTAKE in a trade's result fields, on open or closed
 * trades, with an audit row per changed field (trade_corrections). The plan stays write-once for everyone: entry, original stop,
 * targets, size, risk, leverage can never be changed here.
 * GET  → the corrections recorded on this trade.
 * POST {fields, reason, exit_id?}
 *   - no exit_id → fields may hold opened_at, closed_at, exit_price, realized_pnl, fees
 *   - exit_id    → fields may hold price, pnl, fee, exited_at for that fill; the trade's P&L and size-weighted exit price are re-summed
 *   - reason     → what was wrong and the source ("BloFin order history screenshot 11/9 9:36 PM"), 15+ characters
 */
export const GET = withAgent(["claude", "grok"], async (_req, _a, { params }) => {
  const r = await supabaseAdmin().from("trade_corrections").select("*").eq("trade_id", params.id).order("correction_id");
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, corrections: r.data ?? [] });
});

export const POST = withAgent(["claude", "grok"], async (req, agent, { params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  requireFields(body, ["fields", "reason"]);
  if (typeof body.fields !== "object" || body.fields === null || Array.isArray(body.fields)) throw new BadRequest("fields must be an object.");
  const r = await supabaseAdmin().rpc("mb_trade_correct", {
    p_trade_id: params.id,
    p_fields: body.fields,
    p_reason: String(body.reason),
    p_by: agent,
    p_exit_id: body.exit_id ? String(body.exit_id) : null,
  });
  if (r.error) throw new BadRequest(r.error.message);
  return json(r.data);
});
