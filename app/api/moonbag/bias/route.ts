import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Monday of the current week in Phoenix (YYYY-MM-DD). */
function phoenixMonday(d = new Date()) {
  const day = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(d)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/**
 * Stavros's weekly bias (2026-10-16: "i can just put my thoughts in for macro / weekly on mondays, and then strategy is
 * already as automated as possible from there").
 * GET  → this week's row: Moonbag's draft and his confirmed call, with a `text` to relay word for word.
 * POST {"bias":"long"|"short"|"neutral"|"range","conviction":1-5,"thoughts":<his words, verbatim>,
 *       "levels"?:{"buy_zone":[lo,hi],"sell_zone":[lo,hi],"line":x,"invalidation":x}, "accept_draft"?:true}
 *      Saves HIS call for the week. "accept_draft": true with no bias = take Moonbag's draft as is.
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const wk = phoenixMonday();
  const { data } = await supabaseAdmin().from("weekly_bias").select("*").eq("week_start", wk).maybeSingle();
  const row = data as { bias: string | null; conviction: number | null; thoughts: string | null; levels: unknown; draft: Record<string, unknown> | null } | null;
  const d = row?.draft as { bias?: string; confidence?: number; why?: string[] } | null | undefined;
  const text = !row
    ? `No weekly bias yet for the week of ${wk}. Moonbag's draft lands Monday 5:15 AM.`
    : row.bias
      ? `Your bias for the week of ${wk}: ${row.bias.toUpperCase()} (conviction ${row.conviction ?? "?"}/5). ${row.thoughts ?? ""}`.trim()
      : `Moonbag's DRAFT for the week of ${wk}: ${String(d?.bias ?? "?").toUpperCase()} (${d?.confidence ?? "?"}%) — ${(d?.why ?? []).join(" · ")}. Reply "accept" or give your own bias.`;
  return json({ ok: true, week_start: wk, row, text });
});

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  const wk = phoenixMonday();
  const db = supabaseAdmin();
  const { data: cur } = await db.from("weekly_bias").select("draft").eq("week_start", wk).maybeSingle();
  const draft = (cur as { draft: { bias?: string; levels?: unknown } | null } | null)?.draft ?? null;
  let bias = body.bias == null ? null : String(body.bias).toLowerCase();
  if (!bias && body.accept_draft) bias = draft?.bias ? String(draft.bias) : null;
  if (!bias || !["long", "short", "neutral", "range"].includes(bias)) throw new BadRequest('bias must be "long", "short", "neutral" or "range" (or accept_draft: true when a draft exists).');
  const conviction = body.conviction == null ? null : Math.max(1, Math.min(5, Math.round(Number(body.conviction))));
  const row = {
    week_start: wk,
    bias,
    conviction,
    thoughts: body.thoughts == null ? null : String(body.thoughts).slice(0, 4000),
    levels: body.levels ?? (body.accept_draft ? draft?.levels ?? null : null),
    confirmed_at: new Date().toISOString(),
    confirmed_by: `stavros via ${agent}`,
    updated_at: new Date().toISOString(),
  };
  const r = await db.from("weekly_bias").upsert(row, { onConflict: "week_start" }).select("week_start, bias, conviction").single();
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, bias: r.data, text: `Locked in: ${bias.toUpperCase()} for the week of ${wk}${conviction ? ` (conviction ${conviction}/5)` : ""}. The Woods machine, the morning plans and the desk now trade around it.` }, 201);
});
