import { withAgent, json, readJson, requireFields, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { INTAKE_FIELDS } from "@/lib/moonbag/dayCards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * TRADE INTAKES (CR-58). Every idea he brings goes in as a draft BEFORE the order (his voice answers: coin+side, bias + invalidation,
 * trigger, entry, stop + structure, TP1/TP2 + exit plan, risk %, leverage, own/moonbag/caller, feeling). Grok's flags go in `checks`
 * as [{level: "hard"|"soft", text}]. It becomes a trade only after his screenshot: PATCH /trade-intakes/{id} {action:"confirm", trade_id}.
 * GET ?day=YYYY-MM-DD | ?days=7 [&status=draft|confirmed|skipped|cancelled] → intakes + `expectancy` (v_intake_expectancy)
 * POST {venue: blofin|breakout, prop_account_id (breakout), symbol, side, ...INTAKE fields} → draft
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const db = supabaseAdmin();
  let s = db.from("trade_intakes").select("*").order("created_at", { ascending: false }).limit(200);
  if (q.get("day")) s = s.eq("day", q.get("day")!);
  else s = s.gte("created_at", new Date(Date.now() - Math.min(90, Number(q.get("days") ?? 7) || 7) * 86400_000).toISOString());
  if (q.get("status")) s = s.eq("status", q.get("status")!);
  const [r, e] = await Promise.all([s, db.from("v_intake_expectancy").select("*")]);
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, intakes: r.data ?? [], expectancy: e.data ?? [] });
});

export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["venue", "symbol", "side"]);
  if (body.venue === "breakout") requireFields(body, ["prop_account_id"]);
  const r = await supabaseAdmin().from("trade_intakes").insert({ ...pick(body, INTAKE_FIELDS), written_by: agent, status: "draft" }).select().single();
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, intake: r.data }, 201);
});
