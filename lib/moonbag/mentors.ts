// THE MENTOR LIBRARY (Stavros, 2026-10-16: "i really like eliz on macro and woods on micro - i follow them both closely ...
// pretend this is their last cycle and lets get as much knowledge about how they think so we can keep it going when they
// are gone"). Every post is kept verbatim (mentor_posts); Claude distils it into principles (how they think, in their words),
// levels (woods_levels, source 'eliz' / 'woods') and testable calls (mentor_calls, graded daily against price).
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Mentor = "eliz" | "woods";
export const MENTORS: Record<Mentor, { name: string; role: string; layer: string }> = {
  eliz: { name: "Eliz", role: "Macro", layer: "Weekly structure — WHERE: the range, the buy zone, the level that changes the structure, the macro resistance." },
  woods: { name: "Woods", role: "Micro", layer: "Execution — WHEN: BTC anchor, sweep → close back → 4H divergence → 1H trigger, limits at edges, 70% at the first pop." },
};

export type MentorPost = { post_id: number; mentor: Mentor; posted_at: string | null; received_at: string; kind: string; title: string | null; raw_text: string; source: string | null; processed_at: string | null };
export type Principle = { principle_id: string; mentor: Mentor; category: string; statement: string; quote: string | null; how_moonbag_applies: string | null; times_seen: number; last_seen: string; status: string };
export type MentorCall = { call_id: number; mentor: Mentor; made_at: string; asset: string; call: string; horizon_days: number; status: string; grade_note: string | null; graded_at: string | null };
export type MentorRecord = { mentor: Mentor; graded: number; right_n: number; hit_pct: number | null; open_n: number; last_call: string | null; last_post: string | null };
export type MentorQuestion = { q_id: number; mentor: Mentor; question: string; why: string | null; priority: number; status: string };
export type MentorLevel = { level_id: number; coin: string; kind: string; low: number | null; high: number | null; timeframe: string | null; note: string | null; source: string; updated_at: string };

export async function getMentorLibrary() {
  const db = supabaseAdmin();
  const [posts, principles, calls, record, levels, questions] = await Promise.all([
    db.from("mentor_posts").select("*").order("received_at", { ascending: false }).limit(30),
    db.from("mentor_principles").select("*").eq("status", "active").order("mentor").order("category").order("principle_id"),
    db.from("mentor_calls").select("*").order("made_at", { ascending: false }).limit(40),
    db.from("v_mentor_record").select("*"),
    db.from("woods_levels").select("*").eq("active", true).in("source", ["eliz", "woods"]).order("low", { ascending: false }),
    db.from("mentor_questions").select("*").in("status", ["open", "asked"]).order("priority").order("q_id"),
  ]);
  return {
    posts: (posts.data ?? []) as MentorPost[],
    principles: (principles.data ?? []) as Principle[],
    calls: (calls.data ?? []) as MentorCall[],
    record: (record.data ?? []) as MentorRecord[],
    levels: (levels.data ?? []) as MentorLevel[],
    questions: (questions.data ?? []) as MentorQuestion[],
  };
}

/** Plain-text playbook Grok relays word for word. */
export function playbookText(lib: Awaited<ReturnType<typeof getMentorLibrary>>, only?: Mentor) {
  const L: string[] = [];
  for (const m of (only ? [only] : (["eliz", "woods"] as Mentor[]))) {
    const rec = lib.record.find((r) => r.mentor === m);
    L.push(`${MENTORS[m].name.toUpperCase()} (${MENTORS[m].role}) — ${MENTORS[m].layer}`);
    if (rec) L.push(`Calls graded ${rec.graded} · right ${rec.right_n}${rec.hit_pct != null ? ` (${rec.hit_pct}%)` : ""} · open ${rec.open_n} · last post ${rec.last_post ? new Date(rec.last_post).toISOString().slice(0, 10) : "—"}`);
    const lv = lib.levels.filter((l) => l.source === m);
    if (lv.length) L.push(`Levels: ${lv.map((l) => `${l.coin} ${l.kind} ${l.low === l.high || l.high == null ? l.low : `${l.low}–${l.high}`} (${l.timeframe ?? "?"})`).join(" · ")}`);
    for (const p of lib.principles.filter((x) => x.mentor === m)) L.push(`• [${p.category}] ${p.statement}`);
    const q = lib.questions.filter((x) => x.mentor === m).slice(0, 3);
    if (q.length) L.push(`Ask ${MENTORS[m].name} next: ${q.map((x) => x.question).join(" | ")}`);
    L.push("");
  }
  return L.join("\n").trim();
}
