import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * ROI LEDGER (CR-25, Stavros 2026-10-29: "there must be ROI" — AI tool costs vs P&L; approved 10/30).
 * GET  ?weeks=N → weekly realized P&L by venue · source (moonbag / caller:woods / caller:eliz / caller:johnny / own), the tool cost,
 *      net and cumulative net, 1R in $ on BloFin and the R per month needed to cover the cost. Computed from trades (v_roi_weekly).
 * POST {"week_start"?: "YYYY-MM-DD", "notes"?: text, "monthly_cost_usd"?: number, "tool_costs"?: {...}} → saves a week note and/or the cost.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const weeks = Math.min(52, Math.max(1, Number(new URL(req.url).searchParams.get("weeks") ?? 8)));
  const db = supabaseAdmin();
  const r = await db.from("v_roi_weekly").select("*").order("week_start", { ascending: false }).limit(weeks);
  if (r.error) throw new BadRequest(r.error.message);
  const rows = (r.data ?? []) as { week_start: string; realized_usd: number; cost_usd: number; net_usd: number; cumulative_net_usd: number; blofin_r_usd: number | null; breakeven_r_per_month: number | null }[];
  const last = rows[0];
  const text = last
    ? `ROI — week of ${last.week_start}: realized $${Number(last.realized_usd).toFixed(2)} vs tools $${Number(last.cost_usd).toFixed(2)} → net $${Number(last.net_usd).toFixed(2)} · cumulative net $${Number(last.cumulative_net_usd).toFixed(2)} · 1R on BloFin ≈ $${Number(last.blofin_r_usd ?? 0).toFixed(2)}, so covering the tools takes ~${last.breakeven_r_per_month ?? "—"}R a month at this size.`
    : "ROI — no closed trades yet.";
  return json({ ok: true, text, weeks: rows });
});

export const POST = withAgent(["claude", "grok"], async (req) => {
  const body = await readJson(req);
  const db = supabaseAdmin();
  const out: Record<string, unknown> = {};
  if (body.monthly_cost_usd != null || body.tool_costs != null) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.monthly_cost_usd != null) {
      const v = Number(body.monthly_cost_usd);
      if (!Number.isFinite(v) || v < 0 || v > 100000) throw new BadRequest("monthly_cost_usd must be a number 0–100000");
      patch.monthly_cost_usd = v;
    }
    if (body.tool_costs != null) patch.tool_costs = body.tool_costs;
    const u = await db.from("roi_settings").update(patch).eq("id", 1).select("*").single();
    if (u.error) throw new BadRequest(u.error.message);
    out.settings = u.data;
  }
  if (body.week_start != null) {
    const wk = String(body.week_start);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wk)) throw new BadRequest("week_start must be YYYY-MM-DD (the Monday)");
    const n = await db.from("roi_notes").upsert({ week_start: wk, notes: body.notes == null ? null : String(body.notes).slice(0, 4000), updated_at: new Date().toISOString() }).select("*").single();
    if (n.error) throw new BadRequest(n.error.message);
    out.note = n.data;
  }
  if (!Object.keys(out).length) throw new BadRequest("send monthly_cost_usd / tool_costs and/or week_start + notes");
  return json({ ok: true, ...out }, 201);
});
