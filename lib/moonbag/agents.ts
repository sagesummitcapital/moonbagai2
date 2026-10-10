// The Moonbag agent map: who does what, when, and what each one did last.
// Registry = `agents` table. Activity = `v_agent_activity` (built from the records each agent writes,
// so no extra logging is needed). Rotation coins = `lev_universe`. Strategy file = `strategy_doc`.

import { supabaseAdmin } from "@/lib/supabase/admin";

export type AgentRow = {
  agent_id: string;
  name: string;
  role: string;
  book: "leverage" | "robinhood" | "coinbase" | "both";
  cadence: string;
  runs_in: string;
  inputs: string | null;
  outputs: string | null;
  sort: number;
  parent_id: string | null;
  tasks: { task: string; when: string }[];
  scheduled_task: string | null;
};

export type AgentRun = { agent_id: string; started_at: string; mode: "quiet" | "work" | "error"; coins: string[] | null; summary: string | null; handed_to: string[] | null };

export type AgentEvent = { agent_id: string; at: string; subject: string | null; detail: string };

export type UniverseRow = {
  asset: string;
  tier: "core" | "rotation" | "bench";
  tv_symbol: string;
  blofin_symbol: string;
  max_leverage: number;
  rank: number | null;
  rs_1m_vs_btc: number | null;
  rs_3m_vs_btc: number | null;
  in_play: boolean;
  reason: string | null;
  updated_at: string;
};

export type StrategyDoc = { version: number; markdown: string; change_reason: string | null; created_at: string };

/** How often each agent is expected to leave a trace. null = event-driven (only acts when something happens). */
export const EXPECTED_HOURS: Record<string, number | null> = {
  desk_lead: 2,
  publisher: null,
  strategist: 26,
  scout: 5,
  cartographer: 6,
  gate: null,
  risk_officer: null,
  exit_clerk: null,
  level_watch: null,
  executor: null,
  coach: null,
  auditor: 24 * 8,
  stavros: null,
};

/** The pipelines, in the order the work flows. Agent ids refer to the `agents` table. */
export const PIPELINES: { when: string; steps: string[]; note: string }[] = [
  { when: "Every 4h close", steps: ["scout", "desk_lead", "cartographer"], note: "Re-rank coins → the Desk Lead redraws each coin's range high / low lines and alerts" },
  { when: "Every 1h close", steps: ["desk_lead", "gate", "risk_officer", "stavros"], note: "Cheap check first — only if a line was hit: validation → score → order card → you place it" },
  { when: "Trade opened", steps: ["stavros", "executor", "publisher", "exit_clerk"], note: "You tell Grok → trade recorded → X post queued → that coin's 2 lines become stop + target" },
  { when: "Daily 5:50 AM", steps: ["strategist", "publisher", "executor"], note: "Theses + morning brief → X post → Grok posts it; Robinhood handoffs" },
  { when: "24h after a close", steps: ["coach"], note: "Lookback, Moonbag vs your call" },
  { when: "Saturday", steps: ["auditor"], note: "C setups, backtests, R:R, leverage, rotation → strategy file" },
];

export async function getAgentsBoard() {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [agents, events, universe, doc, runs] = await Promise.all([
    db.from("agents").select("*").order("sort"),
    db.from("v_agent_activity").select("*").gte("at", since).order("at", { ascending: false }).limit(400),
    db.from("lev_universe").select("*").order("tier").order("rank", { ascending: true, nullsFirst: true }),
    db.from("strategy_doc").select("version, markdown, change_reason, created_at").eq("status", "active").maybeSingle(),
    db.from("agent_runs").select("agent_id, started_at, mode, coins, summary, handed_to").gte("started_at", since).order("started_at", { ascending: false }).limit(500),
  ]);
  for (const r of [agents, events, universe, doc, runs]) if (r.error) throw new Error(r.error.message);
  const runRows = (runs.data ?? []) as AgentRun[];

  const ev = (events.data ?? []) as AgentEvent[];
  const dayAgo = Date.now() - 24 * 3600_000;
  const status = ((agents.data ?? []) as AgentRow[]).map((a) => {
    const mine = ev.filter((e) => e.agent_id === a.agent_id);
    const last = mine[0]?.at ?? null;
    const expected = EXPECTED_HOURS[a.agent_id] ?? null;
    const ageH = last ? (Date.now() - new Date(last).getTime()) / 3600_000 : null;
    const health: "live" | "late" | "idle" =
      expected == null ? (ageH != null && ageH < 24 ? "live" : "idle") : ageH != null && ageH <= expected ? "live" : "late";
    return {
      ...a,
      last_at: last,
      last_detail: mine[0]?.detail ?? null,
      events_24h: mine.filter((e) => new Date(e.at).getTime() >= dayAgo).length,
      events_7d: mine.length,
      runs_24h: {
        work: runRows.filter((r) => r.agent_id === a.agent_id && r.mode === "work" && new Date(r.started_at).getTime() >= dayAgo).length,
        quiet: runRows.filter((r) => r.agent_id === a.agent_id && r.mode === "quiet" && new Date(r.started_at).getTime() >= dayAgo).length,
        error: runRows.filter((r) => r.agent_id === a.agent_id && r.mode === "error" && new Date(r.started_at).getTime() >= dayAgo).length,
      },
      expected_hours: expected,
      health,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    agents: status,
    pipelines: PIPELINES,
    recent: ev.slice(0, 40),
    runs: runRows.slice(0, 48),
    universe: (universe.data ?? []) as UniverseRow[],
    strategy: (doc.data ?? null) as StrategyDoc | null,
  };
}

export async function getStrategyDoc() {
  const db = supabaseAdmin();
  const [doc, universe] = await Promise.all([
    db.from("strategy_doc").select("version, markdown, change_reason, created_at").eq("status", "active").maybeSingle(),
    db.from("lev_universe").select("asset, tier, rank, in_play, max_leverage, blofin_symbol").order("tier").order("rank", { ascending: true, nullsFirst: true }),
  ]);
  if (doc.error) throw new Error(doc.error.message);
  if (universe.error) throw new Error(universe.error.message);
  return { strategy: doc.data as StrategyDoc | null, universe: universe.data };
}
