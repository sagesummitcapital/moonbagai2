import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDeskJournal, moonbagView } from "@/lib/moonbag/deskJournal";

export const dynamic = "force-dynamic";

/**
 * DESK JOURNAL — the shared journal Stavros, Grok and Moonbag all write in (Stavros, 2026-10-18). He writes through Grok.
 * GET  /desk-journal[?days=7]  → recent threads + scorecard, with a `text` digest.
 * POST /desk-journal           → log an entry. kind "idea" returns Moonbag's instant side-by-side view (relay `text` word for word).
 */
export const GET = withAgent(["grok", "claude"], async (req) => {
  const days = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 7));
  const { threads, tally } = await getDeskJournal(days);
  const L = [`DESK JOURNAL — last ${days} days · ${threads.length} threads`];
  for (const t of threads.slice(0, 12)) {
    const r = t.root;
    const dec = t.replies.filter((x) => x.kind === "decision").pop();
    L.push(`#${r.id} ${r.kind}${r.coin ? ` ${r.coin} ${r.side ?? ""}` : ""} — ${(r.body ?? "").slice(0, 140)}${dec ? ` → ${dec.body}` : ""}`);
  }
  const sc = Object.entries(tally).map(([k, v]) => `${k} ${v.n} trades ${v.r >= 0 ? "+" : ""}${v.r.toFixed(1)}R`).join(" · ");
  if (sc) L.push(`Scorecard: ${sc}`);
  return json({ ok: true, text: L.join("\n"), threads, tally });
});

const KINDS = ["idea", "grok_view", "decision", "note", "lesson", "outcome"] as const;
const n = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Body: {kind, text, author?, coin?, side?, entry?, stop?, tp1?, tp2?, thread_id?, trade_id?, grok_take?:{entry,stop,tp1,tp2,text}}
 * - kind "idea": a trade he's thinking about (his words verbatim in text). entry/stop optional (none = at market now).
 *   grok_take = Grok's own numbers, if Grok gave any. Moonbag replies instantly with its view + WHERE WE'RE OFF.
 * - kind "decision": thread_id + text = "mine" | "moonbag limit" | "moonbag now" | "skip" (+ why). Add trade_id once he's in.
 * - kind "note" / "lesson" / "outcome": anyone; thread_id optional.
 */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const b = await readJson(req);
  const kind = String(b.kind ?? "");
  if (!(KINDS as readonly string[]).includes(kind)) throw new BadRequest(`kind must be one of ${KINDS.join(", ")}`);
  const text = b.text != null ? String(b.text).slice(0, 8000) : "";
  const author = ["stavros", "grok", "claude"].includes(String(b.author)) ? String(b.author) : kind === "grok_view" ? "grok" : kind === "idea" || kind === "decision" ? "stavros" : agent;
  const db = supabaseAdmin();
  const threadId = n(b.thread_id);

  if (kind !== "idea") {
    if ((kind === "decision" || kind === "grok_view" || kind === "outcome") && threadId == null) throw new BadRequest("thread_id is required for this kind");
    if (!text) throw new BadRequest("text is required");
    const ins = await db.from("desk_journal").insert({
      kind, author, recorded_by: agent, thread_id: threadId, body: text,
      coin: b.coin ? String(b.coin).toUpperCase() : null, side: b.side === "long" || b.side === "short" ? b.side : null,
      entry: n(b.entry), stop: n(b.stop), tp1: n(b.tp1), tp2: n(b.tp2), trade_id: b.trade_id ? String(b.trade_id) : null,
    }).select("id").single();
    if (ins.error) throw new BadRequest(ins.error.message);
    return json({ ok: true, id: ins.data.id, text: `Logged in the desk journal (#${ins.data.id}).` });
  }

  // IDEA → thread + instant Moonbag view
  const coin = String(b.coin ?? "").toUpperCase().replace(/USDT.*$/, "");
  const side = String(b.side ?? "").toLowerCase();
  if (!coin) throw new BadRequest("coin is required");
  if (side !== "long" && side !== "short") throw new BadRequest('side must be "long" or "short"');
  const entry = n(b.entry), stop = n(b.stop), tp1 = n(b.tp1);
  const view = await moonbagView(coin, side, { entry, stop, tp1 });
  const atMarket = entry == null;
  const live = view.refs.live;
  const idea = await db.from("desk_journal").insert({
    kind: "idea", author, recorded_by: agent, coin, side, body: text || null,
    entry: entry ?? live?.entry ?? null, stop: stop ?? (atMarket ? live?.stop ?? null : null), tp1: tp1 ?? (atMarket ? live?.tp1 ?? null : view.refs.mine?.tp1 ?? null),
    tp2: n(b.tp2), at_market: atMarket, price_at: view.price,
  }).select("id").single();
  if (idea.error) throw new BadRequest(idea.error.message);
  const id = idea.data.id as number;
  const gt = (b.grok_take ?? null) as Record<string, unknown> | null;
  if (gt && (gt.entry != null || gt.text)) {
    const ge = n(gt.entry), gs = n(gt.stop), g1 = n(gt.tp1);
    await db.from("desk_journal").insert({ kind: "grok_view", author: "grok", recorded_by: agent, thread_id: id, coin, side, entry: ge, stop: gs, tp1: g1, tp2: n(gt.tp2),
      rr1: ge != null && gs != null && g1 != null && ge !== gs ? Math.abs(g1 - ge) / Math.abs(ge - gs) : null, body: gt.text ? String(gt.text).slice(0, 4000) : null, price_at: view.price });
  }
  await db.from("desk_journal").insert({ kind: "moonbag_view", author: "moonbag", recorded_by: agent, thread_id: id, coin, side, body: view.text, refs: view.refs, price_at: view.price,
    entry: live?.entry ?? null, stop: live?.stop ?? null, tp1: live?.tp1 ?? null, tp2: live?.tp2 ?? null, rr1: live?.rr1 ?? null, at_market: true });
  return json({ ok: true, thread_id: id, text: `Desk journal #${id}\n${view.text}`, live_card: view.liveCard, refs: view.refs });
});
