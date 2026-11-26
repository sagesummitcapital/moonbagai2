import { withAgent, json, readJson, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { getPlans, PLAN_FIELDS, planLine, planRecord, postPlan } from "@/lib/moonbag/plans";

export const dynamic = "force-dynamic";

/**
 * YOUR PLANS (CR-96). Stavros's conditional setups — structure, not predictions.
 * GET  /plans[?days=30]  → open and recent plans, how each one ended, his record by setup, `text` to relay word for word.
 * POST /plans {"coin":"BTC","side":"short","setup":"deviation"|"hold"|"breakout","zone_lo":64500,"zone_hi":65500,
 *   "confirm_tf":"15m"|"1h"|"4h" (defaults: hold 15m, deviation 1h, breakout 4h), "retest":true|false,
 *   "stop":<his stop, optional>, "target":<his target, optional; else 2R>, "valid_until":<ISO, default 7 days>,
 *   "name":"range high deviation", "his_words":<verbatim>, "source_note":<journal id>}
 * POST /plans {"cancel":<plan_id>, "reason":"..."}  → cancels an open plan.
 * One plan per setup. Moonbag fires it only when the structure confirms, sends it like any prop trade, and grades it whether he takes it or not.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30));
  const plans = await getPlans(days).catch((e) => { throw new BadRequest(e instanceof Error ? e.message : String(e)); });
  const open = plans.filter((p) => ["watching", "armed", "reclaimed"].includes(p.status));
  const done = plans.filter((p) => !["watching", "armed", "reclaimed"].includes(p.status));
  const record = planRecord(plans);
  const text = [
    `YOUR PLANS — ${open.length} open`,
    ...open.map(planLine),
    done.length ? `\nLast ${days} days:` : "",
    ...done.slice(0, 15).map(planLine),
    record.length ? `\nYour record: ${record.map((r) => `${r.setup} ${r.n} trades ${r.avg_r > 0 ? "+" : ""}${r.avg_r}R avg, ${r.win_pct}% wins`).join(" · ")}` : "",
  ].filter(Boolean).join("\n");
  return json({ ok: true, open, recent: done, record, text });
});

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = pick(await readJson(req), PLAN_FIELDS);
  const row = await postPlan(body, agent).catch((e) => { throw new BadRequest(e instanceof Error ? e.message : String(e)); });
  const msg = body.cancel != null ? `Plan #${row.plan_id} cancelled.` : `Saved as plan #${row.plan_id}. Moonbag is watching it every 15 minutes and fires it only when the structure confirms.`;
  return json({ ok: true, plan: row, text: msg });
});
