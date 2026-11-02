import { supabaseAdmin } from "@/lib/supabase/admin";

/** Weekly agent usage (CR-51, Stavros 2026-11-01: "I need to see usage across agents"). Grok = share / % of his limit; Claude = runs. */
export type UsageRow = { week_start: string; source: "grok" | "claude"; agent: string; share_pct: number | null; limit_used_pct: number | null; tokens: number | null; cost_usd: number | null; runs: number | null; notes: string | null };
export type ClaudeRuns = { week_start: string; agent: string; runs: number; errors: number; last_run: string };

export async function getAgentUsage(weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 86400_000).toISOString().slice(0, 10);
  const db = supabaseAdmin();
  const [u, c] = await Promise.all([
    db.from("agent_usage").select("week_start, source, agent, share_pct, limit_used_pct, tokens, cost_usd, runs, notes").gte("week_start", since).order("week_start", { ascending: false }),
    db.from("v_claude_runs_weekly").select("week_start, agent, runs, errors, last_run").gte("week_start", since).order("week_start", { ascending: false }),
  ]);
  if (u.error) throw new Error(u.error.message);
  if (c.error) throw new Error(c.error.message);
  return { usage: (u.data ?? []) as UsageRow[], claude: (c.data ?? []) as ClaudeRuns[] };
}
