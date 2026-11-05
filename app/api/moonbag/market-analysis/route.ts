import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { ANALYSIS_FIELDS, listByDay, phxToday, upsertDay, validDay } from "@/lib/moonbag/dayCards";

export const dynamic = "force-dynamic";

/**
 * DAILY MARKET ANALYSIS (CR-58). One row per Phoenix day.
 * GET  ?day= | ?days=14 (default today)
 * POST {day?, regime, btc_bias: long|short|neutral, conf_pct, drivers:[{factor, read, weight}], levels{}, formulas{name: value}, summary}  upserts on day
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(q.get("days") ?? 0) || 0));
  const day = q.get("day") ? validDay(q.get("day")) : days ? null : phxToday();
  return json({ ok: true, analysis: await listByDay("market_analysis", day, days || 1) });
});

export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  const day = body.day ? validDay(body.day) : phxToday();
  return json({ ok: true, analysis: await upsertDay("market_analysis", day, pick(body, ANALYSIS_FIELDS), agent) }, 201);
});
