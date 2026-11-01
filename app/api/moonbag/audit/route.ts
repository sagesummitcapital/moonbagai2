import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * MONTHLY DESK AUDIT (CR-34, Stavros 2026-11-01 in Cowork). Runs itself on the first Saturday of each month for the month before.
 * Per BloFin trade: loss inside the declared stop, risk ≤ 2%, combined open risk ≤ 15%, half risk on red-folder days, stop vs the
 * Moonbag plan, exit fills logged; plus own vs Moonbag setups, weekend vs weekday, the long-term books, the rules added that month with a
 * keep / review recommendation, and anything unmonitored. Read-only: recommendations only — rule changes still need Stavros's OK.
 * GET ?month=YYYY-MM (default: the latest report) → { text (relay word for word), report }
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const m = new URL(req.url).searchParams.get("month");
  let s = supabaseAdmin().from("desk_audits").select("month, created_at, text, report").order("month", { ascending: false }).limit(1);
  if (m) {
    if (!/^\d{4}-\d{2}$/.test(m)) throw new BadRequest("month must look like 2026-10");
    s = supabaseAdmin().from("desk_audits").select("month, created_at, text, report").eq("month", `${m}-01`).limit(1);
  }
  const r = await s;
  if (r.error) throw new BadRequest(r.error.message);
  const row = (r.data ?? [])[0] as { month: string; created_at: string; text: string; report: unknown } | undefined;
  if (!row) return json({ ok: true, text: m ? `No desk audit for ${m} yet.` : "No desk audit yet.", report: null });
  return json({ ok: true, month: row.month, created_at: row.created_at, text: row.text, report: row.report });
});
