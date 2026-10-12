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
export type LossPattern = { tag: string; times: number; losses: number; cost_usd: number; last_seen: string; latest_check: string | null };

export const LOSS_FIELDS = [
  "kind", "trade_id", "trade_date", "venue", "symbol", "direction", "pnl", "r_multiple",
  "what_happened", "why_lost", "mistake_tags", "lesson", "check_rule", "source", "status",
] as const;

const money = (v: unknown) => (v == null ? "—" : `${Number(v) < 0 ? "−" : ""}$${Math.abs(Number(v)).toFixed(2)}`);

export async function getLossJournal(limit = 30) {
  const db = supabaseAdmin();
  const [entries, patterns] = await Promise.all([
    db.from("loss_journal").select("*").order("created_at", { ascending: false }).limit(limit),
    db.from("v_loss_patterns").select("*"),
  ]);
  if (entries.error) throw new Error(entries.error.message);
  if (patterns.error) throw new Error(patterns.error.message);
  const E = (entries.data ?? []) as LossEntry[];
  const P = (patterns.data ?? []) as LossPattern[];

  // Fixed-format text: the pre-trade checks first (what to look for), then the entries.
  const L: string[] = [];
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
  return { text: L.join("\n"), entries: E, patterns: P };
}
