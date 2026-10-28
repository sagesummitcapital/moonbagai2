// Loss journal (Stavros, 2026-10-12). One shared record of every losing trade and every near-miss
// mistake, so Grok, the Desk Lead and the Coach all check new trade inputs against the same history.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LossEntry = {
  entry_id: number;
  created_at: string;
  kind: "loss" | "near_miss";
  trade_id: string | null;
  trade_date: string | null;
  venue: string;
  symbol: string | null;
  direction: string | null;
  pnl: number | null;
  r_multiple: number | null;
  what_happened: string;
  why_lost: string | null;
  mistake_tags: string[];
  lesson: string | null;
  check_rule: string | null;
  source: string;
  status: string;
};
export type MistakeRow = { pattern: string; label: string; rule: string; times: number; losses: number; r_total: number; r_cost: number; last_7d: number; before_7d: number; trend: string; last_seen: string | null; cost_rank: number };
export type FilterScore = { filter_id: number; mentor: string; kind: string; rule: string; level_lo: number | null; level_hi: number | null; active_from: string; active_to: string | null; n_followed: number; r_followed: number | null; n_ignored: number; r_ignored: number | null };
export type LossPattern = { tag: string; times: number; losses: number; cost_usd: number; last_seen: string; latest_check: string | null };

export const LOSS_FIELDS = [
  "kind", "trade_id", "trade_date", "venue", "symbol", "direction", "pnl", "r_multiple",
  "what_happened", "why_lost", "mistake_tags", "lesson", "check_rule", "source", "status",
] as const;

const money = (v: unknown) => (v == null ? "—" : `${Number(v) < 0 ? "−" : ""}$${Math.abs(Number(v)).toFixed(2)}`);

export async function getLossJournal(limit = 30) {
  const db = supabaseAdmin();
  const [entries, patterns, mistakes, filters] = await Promise.all([
    db.from("loss_journal").select("*").order("created_at", { ascending: false }).limit(limit),
    db.from("v_loss_patterns").select("*"),
    db.from("v_mistake_summary").select("*").order("cost_rank"),
    db.from("v_filter_score").select("*").neq("kind", "manual").is("active_to", null),
  ]);
  if (entries.error) throw new Error(entries.error.message);
  if (patterns.error) throw new Error(patterns.error.message);
  const E = (entries.data ?? []) as LossEntry[];
  const P = (patterns.data ?? []) as LossPattern[];

  // Fixed-format text: the pre-trade checks first (what to look for), then the entries.
  const M = (mistakes.error ? [] : mistakes.data ?? []) as MistakeRow[];
  const F = (filters.error ? [] : filters.data ?? []) as FilterScore[];
  const L: string[] = [];
  // CR-20 (Stavros 10/27: "Have Claude make that part of trade journal. Still should have detail but also summary"): the running
  // summary of what keeps repeating sits ON TOP; the per-trade detail stays below.
  L.push("MOONBAG TRADE JOURNAL — SUMMARY (every closed BloFin trade, recomputed as trades close)");
  if (M.length) {
    L.push("TOP 3 TO WORK ON:");
    M.slice(0, 3).forEach((m, i) => L.push(`  ${i + 1}. ${m.rule}`));
    L.push("WHAT KEEPS REPEATING (costliest first):");
    for (const m of M) L.push(`  • ${m.label} — ${m.times}x (${m.losses} losses) · cost ${Number(m.r_cost).toFixed(2)}R · this week ${m.last_7d} vs ${m.before_7d} before → ${m.trend}`);
  } else L.push("  no closed trades yet");
  if (F.length) {
    L.push("CALLER FILTERS — followed vs ignored:");
    for (const f of F) L.push(`  • ${f.mentor}: ${f.rule} — followed ${f.n_followed} (${Number(f.r_followed ?? 0).toFixed(2)}R) · ignored ${f.n_ignored} (${Number(f.r_ignored ?? 0).toFixed(2)}R)`);
  }
  L.push("");
  L.push("MOONBAG LOSS JOURNAL — check every new trade against these before placing it");
  L.push("");
  L.push("PRE-TRADE CHECKS (from repeated mistakes, most frequent first)");
  if (P.length) {
    for (const p of P) L.push(`  • ${p.tag} — ${p.times}x${p.losses ? `, ${p.losses} loss${p.losses > 1 ? "es" : ""} ${money(p.cost_usd)}` : ""} · check: ${p.latest_check ?? "—"}`);
  } else L.push("  none yet");
  L.push("");
  L.push("ENTRIES (newest first)");
  for (const e of E) {
    const head = `${e.trade_date ?? e.created_at.slice(0, 10)} ${e.kind === "loss" ? "LOSS" : "NEAR-MISS"} ${e.symbol ?? ""}${e.direction ? ` ${e.direction}` : ""}${e.pnl != null ? ` ${money(e.pnl)}` : ""}${e.r_multiple != null ? ` (${Number(e.r_multiple).toFixed(2)}R)` : ""}`;
    L.push(`  ${head.replace(/\s+/g, " ").trim()} [${e.mistake_tags.join(", ") || "untagged"}]`);
    if (e.why_lost) L.push(`    why: ${e.why_lost}`);
    if (e.lesson) L.push(`    lesson: ${e.lesson}`);
  }
  return { text: L.join("\n"), entries: E, patterns: P, mistakes: M, filters: F };
}
