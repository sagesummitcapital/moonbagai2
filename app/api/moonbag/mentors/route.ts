import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { getMentorLibrary, playbookText, type Mentor } from "@/lib/moonbag/mentors";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The mentor library (Stavros, 2026-10-16: "i really like eliz on macro and woods on micro ... maybe i can send you their
 * updates and you fold them in? we should log updates to strategy").
 * GET  ?mentor=eliz|woods → the playbook (principles, levels, call record) as `text` to relay word for word.
 * POST {"mentor":"eliz"|"woods","raw_text": <their post, WORD FOR WORD>, "posted_at"?, "kind"?, "title"?, "source"?}
 *      Saves it verbatim. Claude distils it (levels, principles, calls) within a day and logs any strategy change.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const m = q.get("mentor");
  const only = m === "eliz" || m === "woods" ? (m as Mentor) : undefined;
  // CR-24: ?status=open|filled|closed|no_fill|invalidated → their calls graded as trades, plus the scoreboard
  const st = q.get("status");
  if (st) {
    const db = supabaseAdmin();
    let s = db.from("mentor_calls").select("call_id, mentor, made_at, asset, call, side, entry, stop, targets, trade_status, result_r, exit_price, closed_at, caught, caught_ref").order("made_at", { ascending: false }).limit(200);
    if (only) s = s.eq("mentor", only);
    if (st !== "all") s = s.eq("trade_status", st);
    const [calls, score] = await Promise.all([s, db.from("v_caller_call_scores").select("*")]);
    if (calls.error) throw new BadRequest(calls.error.message);
    return json({ ok: true, calls: calls.data ?? [], scoreboard: score.data ?? [] });
  }
  const lib = await getMentorLibrary();
  return json({ ok: true, text: playbookText(lib, only), ...lib });
});

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["mentor", "raw_text"]);
  const mentor = String(body.mentor).toLowerCase();
  if (mentor !== "eliz" && mentor !== "woods") throw new BadRequest('mentor must be "eliz" or "woods".');
  const raw = String(body.raw_text);
  if (raw.trim().length < 20) throw new BadRequest("raw_text looks empty — paste their post word for word.");
  if (raw.length > 30000) throw new BadRequest("raw_text is limited to 30,000 characters — split it.");
  const kinds = ["weekly_map", "daily", "trade", "lesson", "q_and_a", "update"];
  const kind = kinds.includes(String(body.kind)) ? String(body.kind) : "update";
  const posted = body.posted_at ? new Date(String(body.posted_at)) : null;
  const db = supabaseAdmin();
  const ins = await db.from("mentor_posts").insert({
    mentor,
    raw_text: raw,
    kind,
    title: body.title ? String(body.title).slice(0, 200) : null,
    source: body.source ? String(body.source).slice(0, 200) : null,
    posted_at: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    submitted_by: agent,
  }).select("post_id, mentor, kind, received_at").single();
  if (ins.error) throw new BadRequest(ins.error.message);
  const name = mentor === "eliz" ? "Eliz" : "Woods";
  return json({ ok: true, post: ins.data, text: `Saved ${name}'s ${kind.replace("_", " ")} word for word (#${ins.data.post_id}). Claude folds it in — new levels on the Woods map, principles in the playbook, calls graded against price — and logs any strategy change. moonbag.ai/dashboard/mentors` }, 201);
});
