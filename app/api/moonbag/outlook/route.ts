import { withAgent, json, readJson, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { getOutlooks, OUTLOOK_FIELDS, outlookText, postOutlook } from "@/lib/moonbag/outlook";

export const dynamic = "force-dynamic";

/**
 * MY OUTLOOK (CR-77). Stavros's view, any coin, any time, same structure.
 * GET  /outlook[?scope=BTC]  → his active views (MARKET first) + `text` to relay word for word. `stale` = older than 7 days.
 * POST /outlook {"scope":"BTC"|"ETH"|…|"MARKET", "htf_bias":"bullish|bearish|neutral", "htf_note", "ltf_bias", "ltf_note",
 *   "macro_note", "flip":<his line, above = bullish>, "invalidation", "levels":[{"px":66000,"label":"weekly open"}],
 *   "long_plan", "short_plan", "indicators":"EMA/RSI notes", "chart_note", "his_words":<verbatim>}
 *   Replaces his previous view for that coin. Updates the levels page, the TradingView flip line and (MARKET/BTC) the weekly bias.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const scope = new URL(req.url).searchParams.get("scope")?.trim().toUpperCase();
  const all = await getOutlooks().catch((e) => { throw new BadRequest(e instanceof Error ? e.message : String(e)); });
  const rows = (scope ? all.filter((o) => o.scope === scope) : all).sort((a, b) => (a.scope === "MARKET" ? -1 : b.scope === "MARKET" ? 1 : a.scope.localeCompare(b.scope)));
  const text = rows.length ? rows.map(outlookText).join("\n\n") : `No view on file${scope ? ` for ${scope}` : ""} yet — ask Stavros for his outlook.`;
  return json({ ok: true, outlooks: rows, text });
});

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = pick(await readJson(req), OUTLOOK_FIELDS);
  if (!body.scope) throw new BadRequest("scope is required: a coin (BTC, ETH, SOL …) or MARKET.");
  const row = await postOutlook(body, agent).catch((e) => { throw new BadRequest(e instanceof Error ? e.message : String(e)); });
  return json({ ok: true, outlook: row, text: `Saved. ${outlookText({ ...row, age_days: 0, stale: false })}\nLevels page and TradingView flip line updated.` });
});
