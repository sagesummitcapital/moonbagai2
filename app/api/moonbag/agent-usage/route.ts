import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAgentUsage } from "@/lib/moonbag/usage";

export const dynamic = "force-dynamic";

/**
 * AGENT USAGE (CR-51, Stavros 2026-11-01: "I want you and Claude to have agents and weekly usage on the Moonbag agents page").
 * POST {week_start: "YYYY-MM-DD", source: "grok"|"claude", agent, share_pct?, limit_used_pct?, tokens?, cost_usd?, runs?, notes?}
 *      Upserts on week_start + source + agent. Grok posts weekly from the Friday token rollup; use agent "ALL" for the limit used.
 *      Also accepts {rows: [ … ]} (≤ 50).
 * GET  ?weeks=8 → { usage (posted rows), claude (runs per agent per week from agent_runs) }. Grok % of limit and Claude runs are
 *      different measures — never put them on one chart.
 */
const NUMS = ["share_pct", "limit_used_pct", "tokens", "cost_usd", "runs"] as const;

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  const list = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [body];
  if (!list.length || list.length > 50) throw new BadRequest("send 1–50 rows");
  const rows = list.map((b) => {
    requireFields(b, ["week_start", "source", "agent"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.week_start))) throw new BadRequest("week_start must be YYYY-MM-DD");
    if (b.source !== "grok" && b.source !== "claude") throw new BadRequest('source must be "grok" or "claude"');
    const r: Record<string, unknown> = { week_start: b.week_start, source: b.source, agent: String(b.agent).slice(0, 80), notes: b.notes == null ? null : String(b.notes).slice(0, 500), submitted_by: agent };
    for (const f of NUMS) if (b[f] != null) { const v = Number(b[f]); if (!Number.isFinite(v)) throw new BadRequest(`${f} must be a number`); r[f] = v; }
    return r;
  });
  const up = await supabaseAdmin().from("agent_usage").upsert(rows, { onConflict: "week_start,source,agent" }).select("week_start, source, agent");
  if (up.error) throw new BadRequest(up.error.message);
  return json({ ok: true, saved: up.data?.length ?? 0 }, 201);
});

export const GET = withAgent(["grok", "claude"], async (req) => {
  const weeks = Math.min(26, Math.max(1, Number(new URL(req.url).searchParams.get("weeks") ?? 8)));
  return json({ ok: true, ...(await getAgentUsage(weeks)) });
});
