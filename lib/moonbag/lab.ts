// Strategy Lab (Stavros, 2026-10-14): every strategy idea he sends is logged, backtested against our live rules, and
// either layered in, kept testing or rejected — with a change log of every strategy change and why.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type IdeaElement = { element: string; n?: number; avg_r?: number; note?: string; result?: string; verdict: string };
export type Idea = {
  idea_id: string; received_at: string; source: string | null; title: string; summary: string | null;
  elements: IdeaElement[]; verdict: string | null; status: string; next_test: string | null;
};
export type Change = {
  change_id: number; created_at: string; book: string; change: string; reason: string | null; evidence: string | null;
  idea_id: string | null; applied_to: string; status: string; strategy_doc_version: number | null;
};
export type LeagueRow = { week: string; strategy: string; n: number; avg_r: number | null; total_r: number | null; win_pct: number | null };

export async function getLab() {
  const db = supabaseAdmin();
  const [ideas, changes, league] = await Promise.all([
    db.from("strategy_ideas").select("*").order("received_at", { ascending: false }).limit(30),
    db.from("strategy_changes").select("*").order("created_at", { ascending: false }).order("change_id", { ascending: false }).limit(60),
    db.from("v_strategy_league").select("*").limit(40),
  ]);
  for (const r of [ideas, changes]) if (r.error) throw new Error(r.error.message);
  return { ideas: (ideas.data ?? []) as Idea[], changes: (changes.data ?? []) as Change[], league: (league.data ?? []) as LeagueRow[] };
}
