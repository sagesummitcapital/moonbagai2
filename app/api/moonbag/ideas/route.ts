import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Strategy ideas (Stavros, 2026-10-14). Grok submits any strategy idea Stavros shares (post, video, guide, his own);
 * Claude tests it part by part against the live strategy and logs the verdict (moonbag.ai/dashboard/lab).
 * GET returns the queue and recent verdicts with a fixed `text` to relay.
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const db = supabaseAdmin();
  const r = await db.from("strategy_ideas").select("idea_id,received_at,source,title,summary,verdict,status,next_test,submitted_by").order("received_at", { ascending: false }).limit(20);
  if (r.error) throw new Error(r.error.message);
  type Row = { idea_id: string; received_at: string; source: string | null; title: string; summary: string | null; verdict: string | null; status: string; next_test: string | null; submitted_by: string | null };
  const ideas = (r.data ?? []) as Row[];
  const L = ["MOONBAG STRATEGY LAB"];
  const queue = ideas.filter((i) => i.status === "received" || i.status === "testing");
  L.push(queue.length ? `In the queue (${queue.length}): ${queue.map((i) => `${i.title} [${i.idea_id}]`).join(" · ")}` : "Nothing waiting to be tested.");
  for (const i of ideas.filter((x) => x.verdict).slice(0, 5)) L.push(`• ${i.title} — ${i.status.replace("_", " ")}: ${i.verdict}`);
  L.push("Full results and the change log: moonbag.ai/dashboard/lab");
  return json({ ok: true, text: L.join("\n"), ideas });
});

/** Submit an idea: {"title","raw_text" (paste it word for word),"source" (e.g. "X post", "YouTube", "Stavros"),"note" (what he wants from it)}. */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["title", "raw_text"]);
  const raw = String(body.raw_text);
  if (raw.length > 20000) throw new BadRequest("raw_text is limited to 20,000 characters.");
  const db = supabaseAdmin();
  const ins = await db.from("strategy_ideas").insert({
    title: String(body.title).slice(0, 200),
    raw_text: raw,
    source: body.source ? String(body.source).slice(0, 200) : null,
    note: body.note ? String(body.note).slice(0, 2000) : null,
    submitted_by: agent,
    status: "received",
  }).select("idea_id,title,status,received_at").single();
  if (ins.error) throw new BadRequest(ins.error.message);
  return json({ ok: true, idea: ins.data, text: `Saved to the Strategy lab as ${ins.data.idea_id}. Claude will test each part against the live strategy and log the verdict at moonbag.ai/dashboard/lab — nothing changes live until then.` }, 201);
});
