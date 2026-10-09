// Data access for the two "books" shown on the dashboard:
//   Book 1 — Robinhood (longer-term thesis, executed by Grok/RockBot)
//   Book 2 — Leverage desk (BloFin BTC/ETH, Stavros places every order)
// Server-only (service-role client). Read-only: the scheduled Moonbag tasks do the writing.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MoonbagDbError } from "./db";
import type { Alert, DailyThesis, Handoff, Trade } from "./types";

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new MoonbagDbError(res.error.message, res.error.code);
  return res.data as T;
}

type Json = Record<string, unknown>;

export interface LevStrategy {
  version: number;
  title: string;
  summary: string | null;
  markdown: string;
  rules: Json;
  confidence_model: Json;
  change_reason: string | null;
  status: string;
  created_at: string;
}

export interface LevHourly {
  id: string;
  ts: string;
  asset: string;
  price: number;
  bias: string | null;
  htf_bias: string | null;
  regime: string | null;
  levels: { support?: number[]; resistance?: number[]; breakout?: number | null; invalidation?: number | null; range_high?: number | null; range_low?: number | null };
  indicators: Json;
  setups_forming: { setup_id?: string; direction?: string; level?: number; needs?: string; est_score?: number }[];
  session: string | null;
  note: string | null;
  thesis_id: string | null;
}

export interface LevSignal {
  signal_id: string;
  created_at: string;
  asset: string;
  direction: "long" | "short";
  setup_id: string;
  timeframe: string | null;
  trigger_condition: string | null;
  trigger_price: number | null;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number | null;
  tp3: number | null;
  account_equity: number | null;
  risk_percent: number | null;
  risk_dollars: number | null;
  quantity: number | null;
  notional: number | null;
  leverage: number | null;
  margin: number | null;
  rr_tp1: number | null;
  confidence_score: number;
  confidence_grade: number | null;
  confidence_components: Record<string, number>;
  reasoning: string | null;
  evidence_against: string | null;
  status: string;
  status_reason: string | null;
  expires_at: string | null;
  trade_id: string | null;
  outcome: string | null;
  outcome_r: number | null;
  resolved_at: string | null;
  lesson: string | null;
}

export interface SetupStat {
  setup_id: string;
  name: string;
  status: string;
  best_regime: string | null;
  resolved: number | null;
  wins: number | null;
  win_rate_pct: number | null;
  signal_avg_r: number | null;
  taken: number | null;
  bt_trades: number | null;
  bt_win_rate: number | null;
  bt_avg_r: number | null;
  bt_profit_factor: number | null;
  bt_max_dd_r: number | null;
  bt_asset: string | null;
  bt_timeframe: string | null;
}

export interface PlaybookSetup {
  setup_id: string;
  name: string;
  description: string | null;
  entry_rule: string | null;
  stop_rule: string | null;
  target_rule: string | null;
  best_regime: string | null;
  status: string;
  notes: string | null;
}

export interface CalibrationRow {
  confidence_grade: number | null;
  resolved: number;
  wins: number;
  win_rate_pct: number | null;
  avg_r: number | null;
  taken: number;
  never_triggered: number;
  signals: number;
}

export interface Backtest {
  backtest_id: string;
  book: string;
  setup_id: string | null;
  engine_code: string | null;
  asset: string;
  timeframe: string;
  period_start: string | null;
  period_end: string | null;
  params: Json;
  n_trades: number;
  wins: number;
  win_rate: number | null;
  avg_r: number | null;
  total_r: number | null;
  profit_factor: number | null;
  max_drawdown_r: number | null;
  notes: string | null;
  created_at: string;
}

export interface JournalLine {
  id: string;
  book: string;
  kind: string;
  ref: string | null;
  thesis: string;
  result: string;
  mistake: string | null;
  rule_change: string | null;
  created_at: string;
}

export interface PaperTrade {
  paper_id: string;
  book: string;
  symbol: string;
  direction: string;
  setup_type: string | null;
  thesis: string | null;
  entry: number;
  stop: number;
  target: number | null;
  opened_at: string;
  exit_price: number | null;
  closed_at: string | null;
  exit_reason: string | null;
  r_multiple: number | null;
  status: string;
}

export interface RiskConfig {
  venue: string;
  risk_per_trade_pct: number;
  max_open_positions: number;
  auto_execute: boolean;
  max_leverage: number | null;
  max_margin_dollars: number | null;
  min_confidence_grade: number | null;
  max_hold_days: number | null;
  max_fills_per_week: number | null;
  combined_max_loss_dollars: number | null;
  soft_halt_equity: number | null;
  one_symbol_per_day: boolean;
  blocked_symbols: string[];
  min_setup_score: number | null;
  starting_equity: number | null;
  daily_loss_stop_pct: number | null;
  drawdown_stop_pct: number | null;
}

export interface TradeLookback {
  trade_id: string;
  created_at: string;
  week_start: string;
  venue: string;
  symbol: string;
  r_realized: number | null;
  mfe_r: number | null;
  mae_r: number | null;
  r_if_held_to_plan: number | null;
  r_best_in_window: number | null;
  verdict: string;
  rules_broken: string[];
  what_went_well: string | null;
  could_do_better: string;
  dollars_left_on_table: number | null;
  dollars_saved: number | null;
  suggestion: string;
  lesson: string | null;
}

export interface Theme {
  theme_id: string;
  name: string;
  mechanism: string | null;
  what_would_break_it: string | null;
  conviction: number | null;
  status: string;
  beneficiaries: unknown;
}

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (Number(b) || 0), 0);

/**
 * The two numbers Stavros tracks on every leveraged trade:
 *   R:R         reward to the (live) target ÷ risk to the (live) stop
 *   account %   what the stop costs (−) and what the target pays (+), as a percent of the account
 * Plus, once closed, what the trade actually did to the account.
 */
export function tradeMetrics(t: {
  direction: string; entry: number | null; stop: number | null; current_stop?: number | null;
  tp1?: number | null; current_tp1?: number | null; target?: number | null; quantity: number | null;
  account_equity: number | null; realized_pnl?: number | null; fees?: number | null;
}) {
  const entry = Number(t.entry), qty = Number(t.quantity), eq = Number(t.account_equity);
  const stop = t.current_stop ?? t.stop, tp = t.current_tp1 ?? t.tp1 ?? t.target;
  const sign = t.direction === "short" ? -1 : 1;
  const ok = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const stopMove = ok(stop) && ok(t.entry) ? sign * (Number(stop) - entry) : null; // negative = loss at the stop
  const tpMove = ok(tp) && ok(t.entry) ? sign * (Number(tp) - entry) : null;
  const pct = (move: number | null) => (move !== null && qty > 0 && eq > 0 ? (move * qty * 100) / eq : null);
  const rr = stopMove !== null && tpMove !== null && stopMove < 0 ? tpMove / -stopMove : null;
  const net = ok(t.realized_pnl) ? Number(t.realized_pnl) - Number(t.fees ?? 0) : null;
  return {
    rr,                                   // 2.1 means 1 : 2.1
    riskPct: pct(stopMove),               // e.g. -1.9  (positive once the stop is past entry = profit locked)
    rewardPct: pct(tpMove),               // e.g. +4.0
    resultPct: net !== null && eq > 0 ? (net * 100) / eq : null, // closed trades, after fees
  };
}

/** Strategy v5 label: DESK ALERT = grade 3+ that passed the 8-point checklist; RESEARCH ONLY = paper-tracked; PASS = not recorded. */
export function signalLabel(s: { confidence_grade: number | null; status_reason?: string | null; reasoning?: string | null }) {
  const research = /^RESEARCH ONLY/i.test(s.status_reason ?? "") || /^RESEARCH ONLY/i.test(s.reasoning ?? "");
  if (Number(s.confidence_grade) >= 3 && !research) return "DESK ALERT" as const;
  return Number(s.confidence_grade) >= 2 || research ? ("RESEARCH ONLY" as const) : ("PASS" as const);
}
export const isDeskAlert = (s: Parameters<typeof signalLabel>[0]) => signalLabel(s) === "DESK ALERT";

export const fmtRR = (rr: number | null | undefined) => (rr == null ? "—" : `1 : ${rr.toFixed(rr >= 10 ? 0 : 1)}`);
export const fmtPct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);

/** Next milestone above the current equity, from the strategy's milestone ladder. */
export function nextMilestone(equity: number, rules?: Json | null): number | null {
  const ladder = Array.isArray(rules?.milestones) ? (rules!.milestones as number[]) : [1000, 10000, 100000, 1000000];
  return ladder.find((m) => m > equity) ?? null;
}

/** A coin the leverage desk watches (lev_universe): BTC/ETH core plus the Scout's top-5 rotation coins. */
export type UniverseCoin = {
  asset: string;
  tier: "core" | "rotation" | "bench";
  rank: number | null;
  rs_1m_vs_btc: number | null;
  rs_3m_vs_btc: number | null;
  in_play: boolean;
  max_leverage: number;
  blofin_symbol: string;
};

// ---------------------------------------------------------------- Book 2: leverage desk
export async function getLeverageDesk() {
  const db = supabaseAdmin();
  const [strategy, risk, hourly, signals, alerts, trades, theses, calibration, setups, playbook, journal, backtests, snap, lookbacks, universe] =
    await Promise.all([
      db.from("lev_strategy").select("*").eq("status", "active").limit(1),
      db.from("risk_config").select("*").eq("venue", "blofin").limit(1),
      db.from("lev_hourly").select("*").order("ts", { ascending: false }).limit(48),
      db.from("lev_signals").select("*").order("created_at", { ascending: false }).limit(40),
      db.from("alerts").select("*").in("status", ["active", "triggered"]).order("created_at", { ascending: false }).limit(60),
      db.from("trades").select("*").eq("venue", "blofin").order("created_at", { ascending: false }).limit(30),
      db.from("daily_thesis").select("*").eq("status", "active").in("asset", ["BTC", "ETH"]),
      db.from("v_lev_calibration").select("*"),
      db.from("v_lev_setup_stats").select("*"),
      db.from("lev_playbook").select("*").order("created_at"),
      db.from("journal").select("*").eq("book", "leverage").order("created_at", { ascending: false }).limit(12),
      db.from("backtests").select("*").eq("book", "leverage").order("created_at", { ascending: false }).limit(60),
      db.from("account_snapshots").select("equity, reported_at").eq("venue", "blofin").order("reported_at", { ascending: false }).limit(1),
      db.from("trade_lookbacks").select("*").eq("venue", "blofin").order("created_at", { ascending: false }).limit(12),
      db.from("lev_universe").select("*").order("rank", { ascending: true, nullsFirst: true }),
    ]);

  const cfg = (check(risk) as RiskConfig[])[0] ?? null;
  const allTrades = check(trades) as Trade[];
  const closed = allTrades.filter((t) => t.status === "closed");
  // The balance Grokbot reports from BloFin is the truth; the starting balance + P&L sum is only a fallback.
  const reported = (check(snap) as { equity: number; reported_at: string }[])[0] ?? null;
  const equity = reported ? Number(reported.equity) : Number(cfg?.starting_equity ?? 240) + sum(closed.map((t) => Number(t.realized_pnl ?? 0) - Number(t.fees ?? 0)));
  const strat = (check(strategy) as LevStrategy[])[0] ?? null;
  const log = check(hourly) as LevHourly[];
  const latest: Record<string, LevHourly> = {};
  for (const h of log) if (!latest[h.asset]) latest[h.asset] = h;

  return {
    strategy: strat,
    risk: cfg,
    equity,
    equityReportedAt: reported?.reported_at ?? null,
    lookbacks: check(lookbacks) as TradeLookback[],
    universe: check(universe) as UniverseCoin[],
    startingEquity: Number(cfg?.starting_equity ?? 240),
    milestone: nextMilestone(equity, strat?.rules),
    latest,
    hourly: log,
    signals: check(signals) as LevSignal[],
    // Only coin alerts (the universe), not Robinhood stock alerts.
    alerts: (check(alerts) as Alert[]).filter((x) => (check(universe) as UniverseCoin[]).some((u) => u.asset === x.asset)).slice(0, 30),
    openTrades: allTrades.filter((t) => t.status === "open" || t.status === "pending"),
    closedTrades: closed,
    theses: check(theses) as DailyThesis[],
    calibration: (check(calibration) as CalibrationRow[]).sort((a, b) => (b.confidence_grade ?? 0) - (a.confidence_grade ?? 0)),
    setups: check(setups) as SetupStat[],
    playbook: check(playbook) as PlaybookSetup[],
    journal: check(journal) as JournalLine[],
    backtests: check(backtests) as Backtest[],
  };
}

// ---------------------------------------------------------------- Book 1: Robinhood (longer-term)
function weekStartPhoenix(): Date {
  // Phoenix is UTC-7 all year. Monday 00:00 Phoenix, as a UTC instant.
  const now = new Date(Date.now() - 7 * 3600_000);
  const dow = (now.getUTCDay() + 6) % 7;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow);
  return new Date(monday + 7 * 3600_000);
}

export async function getRobinhoodBook() {
  const db = supabaseAdmin();
  const [risk, snapshot, trades, handoffs, theses, themes, paper, journal, backtests] = await Promise.all([
    db.from("risk_config").select("*").eq("venue", "robinhood").limit(1),
    db.from("account_snapshots").select("*").eq("venue", "robinhood").order("reported_at", { ascending: false }).limit(1),
    db.from("trades").select("*").eq("venue", "robinhood").order("created_at", { ascending: false }).limit(60),
    db.from("handoffs").select("*").order("created_at", { ascending: false }).limit(15),
    db.from("daily_thesis").select("*").eq("status", "active").not("asset", "in", "(BTC,ETH)"),
    db.from("investment_themes").select("*").order("status").order("conviction", { ascending: false, nullsFirst: false }),
    db.from("paper_trades").select("*").eq("book", "robinhood").order("opened_at", { ascending: false }).limit(30),
    db.from("journal").select("*").eq("book", "robinhood").order("created_at", { ascending: false }).limit(12),
    db.from("backtests").select("*").eq("book", "robinhood").order("created_at", { ascending: false }).limit(20),
  ]);

  const cfg = (check(risk) as RiskConfig[])[0] ?? null;
  const all = check(trades) as Trade[];
  const open = all.filter((t) => t.status === "open" || t.status === "pending");
  const closed = all.filter((t) => t.status === "closed");
  const snap = (check(snapshot) as { equity: number; cash: number | null; buying_power: number | null; reported_at: string; positions: unknown }[])[0] ?? null;

  // $ loss box: realised net loss so far + what is still at risk to the stops.
  const realisedLoss = Math.max(0, -sum(closed.map((t) => t.realized_pnl)));
  const openRisk = sum(open.map((t) => Math.max(0, (Number(t.entry) - Number(t.current_stop ?? t.stop)) * Number(t.quantity ?? 0))));
  const wk = weekStartPhoenix().getTime();
  const fillsThisWeek = all.filter((t) => t.status !== "cancelled" && new Date(t.created_at).getTime() >= wk).length;

  const th = check(theses) as DailyThesis[];
  return {
    risk: cfg,
    snapshot: snap,
    open,
    closed,
    handoffs: (check(handoffs) as Handoff[]).filter((h) => h.broker === "robinhood"),
    master: th.find((t) => t.asset === "MASTER") ?? null,
    equityThesis: th.find((t) => t.asset === "EQUITY") ?? null,
    tickerTheses: th.filter((t) => !["MASTER", "EQUITY"].includes(t.asset)),
    themes: check(themes) as Theme[],
    paper: check(paper) as PaperTrade[],
    journal: check(journal) as JournalLine[],
    backtests: check(backtests) as Backtest[],
    box: { limit: Number(cfg?.combined_max_loss_dollars ?? 12), used: realisedLoss + openRisk, realisedLoss, openRisk },
    fillsThisWeek,
  };
}
