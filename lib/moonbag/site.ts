import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outlook } from "@/lib/moonbag/outlook";
import type { PlanState } from "@/lib/moonbag/propPlan";
import type { Level } from "@/lib/moonbag/levelsBoard";

/**
 * THE SIMPLE SITE (CR-78, Stavros 2026-11-13): "simple saas product that helps traders be profitable ...
 * my rules, levels, and journal are the edge". Five pages, one database function each:
 *   Today (mb_today) · Levels (v_levels_board) · Setups (mb_setups_page) · Scorecard (mb_scorecard) · System (mb_system_page)
 * The functions are the single source: the page, Grok and Claude all read the same answer.
 */

/** No mentor names anywhere on the site (CR-32, repeated 11/13). Applied to every stored string we show. */
export function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\s*\((Woods|Eliz)\)/gi, "")
    .replace(/Woods\/Eliz|Eliz\/Woods/gi, "market")
    .replace(/WoodsBot/gi, "RSI bot")
    .replace(/\bwoods[_ ]machine\b/gi, "sweep engine")
    .replace(/\bwoods[_ ]limit\b/gi, "sweep limit")
    .replace(/\bWoods(?:'s)?\b/gi, "sweep")
    .replace(/\bEliz(?:'s)?\b/gi, "macro")
    .replace(/\b(her|his) (buy|sell) zone\b/gi, "the $2 zone");
}

export type Setup = {
  limit_id: string; symbol: string; direction: "long" | "short"; grade: string; status: string; venue: string; origin: string; source?: string | null;
  limit_price: number; stop: number | null; tp1: number | null; tp2: number | null; plan_r: number | null; level?: number | null; level_kind: string | null;
  reasoning?: string | null; bull_case?: string | null; bear_case?: string | null; invalid_if?: string | null;
  created_at: string; expires_at: string | null; touched_at?: string | null;
};

export type TodayCoin = {
  asset: string; section: string; price: number | null; price_at: string | null; rsi_4h: number | null; status: string; at_level: string | null;
  above: Level[] | null; below: Level[] | null; my_view: Outlook | null; changes: string[] | null; tv_symbol: string | null;
  levels: Record<string, number | string | boolean>; chg_24h: number | null; chg_7d: number | null;
};

export type Today = {
  as_of: string;
  plan: PlanState | null;
  my_market: Outlook | null;
  coins: TodayCoin[] | null;
  setups: Setup[] | null;
  open_trades: { trade_id: string; venue: string; symbol: string; direction: string; entry: number; stop: number | null; opened_at: string | null; risk_dollars: number | null }[] | null;
  macro: { thesis_date: string; regime: string | null; bias: string | null; confidence: number | null; scenario: string | null; changes_mind: string | null; key: Record<string, string> | null; created_at: string } | null;
  red_day: { red: boolean; events: unknown } | null;
  top_mistake: { label: string; rule: string; last_7d: number; r_cost: number } | null;
  feed: Record<string, string> | null;
};

export type StrategyRow = {
  strategy_key: string; name: string; stage: string; edge_source: string | null; kill_line: string | null; backtest_oos_r: number | null; notes: string | null;
  retired_reason: string | null; updated_at: string; trades: number | null; flags: string[] | null; league: { n: number | null; total_r: number | null; avg_r: number | null } | null;
};

export type SetupsPage = {
  as_of: string;
  live: Setup[] | null;
  recent: { limit_id: string; symbol: string; direction: string; grade: string; source: string | null; limit_price: number; plan_r: number | null; outcome: string | null; outcome_r: number | null; mfe_r: number | null; resolved_at: string }[] | null;
  record: { grade: string; n: number; resolved: number; avg_r: number | null; win_pct: number | null }[] | null;
  strategies: StrategyRow[] | null;
};

export type Numbers = {
  trades: number; wins: number; losses: number; win_pct: number; avg_win_r: number; avg_loss_r: number; expectancy_r: number; breakeven_win_pct: number;
  last20: { win_pct: number; avg_win_r: number; avg_loss_r: number; expectancy_r: number };
  longs: { n: number; avg_r: number }; shorts: { n: number; avg_r: number }; over_1h: { n: number; avg_r: number }; under_1h: { n: number; avg_r: number };
  wins_2r_plus: number; wins_under_half_r: number; full_stop_losses: number;
  reviews_72h?: { n: number; exited_early: number; avg_best_r_seen: number; exited_early_plan_r: number; exited_early_took_r: number; losers_never_up_03r: number };
};

export type Scorecard = {
  as_of: string;
  numbers: Numbers | null;
  plan: PlanState | null;
  prop: Record<string, unknown> | null;
  mistakes: { label: string; rule: string; times: number; r_cost: number; last_7d: number; trend: string; last_seen: string; cost_rank: number }[] | null;
  discipline: { trades: number; off_plan: number; away_from_level: number; net_r: number | null; net_usd: number | null } | null;
  reviews: { trade_id: string; r_multiple: number | null; followed_plan: boolean | null; rules_broken: string[] | null; lesson: string | null; reviewed_at: string }[] | null;
  days: { day: string; n: number; pnl: number | null; r: number | null }[] | null;
};

export type SystemPage = {
  as_of: string;
  agents: {
    agent_id: string; name: string; role: string; cadence: string; sort: number; runs_7d: number; errors_7d: number;
    last_run: { at: string; mode: string; summary: string | null } | null;
    review: { week: string; score: number | null; verdict: string | null; evidence: string | null; change_made: string | null } | null;
  }[] | null;
  other_runs: { agent_id: string; last_at: string; runs_7d: number; errors_7d: number; summary: string | null }[] | null;
  proposed: { change_id: number; created_at: string; change: string; status: string }[] | null;
  shipped: { change_id: number; created_at: string; change: string; status: string }[] | null;
  coach: { started_at: string; mode: string; summary: string | null }[] | null;
  journal: { id: number; created_at: string; author: string; body: string }[] | null;
};

async function rpc<T>(fn: string): Promise<T> {
  const r = await supabaseAdmin().rpc(fn);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const getToday = () => rpc<Today>("mb_today");
export const getSetupsPage = () => rpc<SetupsPage>("mb_setups_page");
export const getScorecard = () => rpc<Scorecard>("mb_scorecard");
export const getSystemPage = () => rpc<SystemPage>("mb_system_page");

/** Price formatting shared by the new pages. */
export function fmt(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v), a = Math.abs(n);
  const d = a >= 1000 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 8;
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
}
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%`);
export const rr = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}R`);
export const usd = (v: number | null | undefined) => (v == null ? "—" : `${v < 0 ? "−" : ""}$${Math.abs(Math.round(Number(v))).toLocaleString("en-US")}`);
