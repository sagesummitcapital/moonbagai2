// Moonbag data-access layer. All reads/writes to Supabase go through here.
// Server-only (uses the service-role client).

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Alert,
  AlertStatus,
  DailyReport,
  DailyThesis,
  Evaluation,
  EvaluationDetail,
  Handoff,
  HandoffStatus,
  NewEvaluation,
  NewThesis,
  SystemState,
  ThesisStatus,
  Trade,
  TradeExit,
  TradeStatus,
} from "./types";

export class MoonbagDbError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new MoonbagDbError(res.error.message, res.error.code);
  return res.data as T;
}

// ---------------------------------------------------------------- dates
const TZ = "America/Phoenix";

/** YYYY-MM-DD in Moonbag's market-day timezone. */
export function moonbagDate(offsetDays = 0, from = new Date()): string {
  const d = new Date(from.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ---------------------------------------------------------------- system state
export async function getSystemState(): Promise<SystemState | null> {
  const db = supabaseAdmin();
  const rows = check(
    await db.from("system_state").select("*").order("state_date", { ascending: false }).limit(1)
  ) as SystemState[];
  return rows[0] ?? null;
}

export async function listSystemStates(limit = 60): Promise<SystemState[]> {
  const db = supabaseAdmin();
  return check(
    await db.from("system_state").select("*").order("state_date", { ascending: false }).limit(limit)
  ) as SystemState[];
}

export async function refreshSystemState(opts: {
  date?: string;
  regime?: string | null;
  riskEnvironment?: string | null;
} = {}): Promise<SystemState> {
  const db = supabaseAdmin();
  return check(
    await db.rpc("moonbag_refresh_system_state", {
      p_date: opts.date ?? null,
      p_regime: opts.regime ?? null,
      p_risk_environment: opts.riskEnvironment ?? null,
    })
  ) as SystemState;
}

// ---------------------------------------------------------------- theses
export async function listTheses(
  filter: { date?: string; status?: ThesisStatus; asset?: string; limit?: number } = {}
): Promise<DailyThesis[]> {
  const db = supabaseAdmin();
  let q = db.from("daily_thesis").select("*");
  if (filter.date) q = q.eq("thesis_date", filter.date);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.asset) q = q.eq("asset", filter.asset.toUpperCase());
  q = q.order("thesis_date", { ascending: false }).order("created_at", { ascending: false });
  return check(await q.limit(filter.limit ?? 200)) as DailyThesis[];
}

export async function getActiveTheses(): Promise<DailyThesis[]> {
  return listTheses({ status: "active" });
}

export async function getThesis(thesisId: string): Promise<DailyThesis | null> {
  const db = supabaseAdmin();
  const rows = check(
    await db.from("daily_thesis").select("*").eq("thesis_id", thesisId).limit(1)
  ) as DailyThesis[];
  return rows[0] ?? null;
}

/** Create a thesis. To correct one, pass `supersedes` + `change_reason` (never edit). */
export async function createThesis(t: NewThesis): Promise<DailyThesis> {
  const db = supabaseAdmin();
  return check(await db.from("daily_thesis").insert(t).select("*").single()) as DailyThesis;
}

export async function setThesisStatus(
  thesisId: string,
  status: Exclude<ThesisStatus, "active" | "superseded">
): Promise<DailyThesis> {
  const db = supabaseAdmin();
  return check(
    await db.from("daily_thesis").update({ status }).eq("thesis_id", thesisId).select("*").single()
  ) as DailyThesis;
}

/** Everything the daily cycle needs to start with yesterday (spec §4). */
export async function getYesterdayReview(date = moonbagDate(-1)) {
  const db = supabaseAdmin();
  const theses = (await listTheses({ date })).filter((t) => t.status !== "cancelled");
  const ids = theses.map((t) => t.thesis_id);
  const evaluations = ids.length
    ? (check(
        await db.from("thesis_evaluations").select("*").in("thesis_id", ids)
      ) as Evaluation[])
    : [];
  const trades = ids.length
    ? (check(await db.from("trades").select("*").in("thesis_id", ids)) as Trade[])
    : [];
  const graded = new Set(evaluations.map((e) => e.thesis_id));
  return {
    date,
    theses,
    evaluations,
    trades,
    ungraded: theses.filter((t) => !graded.has(t.thesis_id)).map((t) => t.thesis_id),
  };
}

// ---------------------------------------------------------------- evaluations
export async function createEvaluation(e: NewEvaluation): Promise<Evaluation> {
  const db = supabaseAdmin();
  // System Confidence is refreshed automatically by a DB trigger on insert.
  return check(await db.from("thesis_evaluations").insert(e).select("*").single()) as Evaluation;
}

export async function listEvaluationDetails(limit = 500): Promise<EvaluationDetail[]> {
  const db = supabaseAdmin();
  return check(
    await db
      .from("v_evaluation_detail")
      .select("*")
      .order("evaluated_at", { ascending: false })
      .limit(limit)
  ) as EvaluationDetail[];
}

export async function listUngradedTheses(): Promise<DailyThesis[]> {
  const db = supabaseAdmin();
  return check(
    await db.from("v_ungraded_theses").select("*").order("thesis_date", { ascending: true })
  ) as DailyThesis[];
}

// ---------------------------------------------------------------- alerts
export async function listAlerts(status?: AlertStatus): Promise<Alert[]> {
  const db = supabaseAdmin();
  let q = db.from("alerts").select("*");
  if (status) q = q.eq("status", status);
  return check(await q.order("created_at", { ascending: false }).limit(300)) as Alert[];
}

export async function createAlert(
  a: Pick<Alert, "thesis_id" | "asset" | "condition"> &
    Partial<Pick<Alert, "tv_alert_id" | "tv_symbol" | "trigger_price" | "direction" | "action" | "message">>
): Promise<Alert> {
  const db = supabaseAdmin();
  return check(await db.from("alerts").insert(a).select("*").single()) as Alert;
}

export async function updateAlert(
  alertId: string,
  patch: Partial<Pick<Alert, "status" | "status_reason" | "tv_alert_id" | "triggered_at">>
): Promise<Alert> {
  const db = supabaseAdmin();
  return check(
    await db.from("alerts").update(patch).eq("alert_id", alertId).select("*").single()
  ) as Alert;
}

// ---------------------------------------------------------------- handoffs
export async function listHandoffs(status?: HandoffStatus): Promise<Handoff[]> {
  const db = supabaseAdmin();
  let q = db.from("handoffs").select("*");
  if (status) q = q.eq("status", status);
  return check(await q.order("created_at", { ascending: false }).limit(300)) as Handoff[];
}

export async function createHandoff(
  h: Pick<Handoff, "thesis_id" | "symbol" | "direction"> &
    Partial<
      Pick<
        Handoff,
        | "destination"
        | "broker"
        | "entry_condition"
        | "invalidation"
        | "target_framework"
        | "time_horizon"
        | "setup_score"
        | "system_confidence"
        | "position_guidance"
        | "conditions_to_cancel"
        | "expires_at"
      >
    >
): Promise<Handoff> {
  const db = supabaseAdmin();
  return check(await db.from("handoffs").insert(h).select("*").single()) as Handoff;
}

export async function respondToHandoff(
  handoffId: string,
  patch: Partial<Pick<Handoff, "status" | "status_reason" | "grok_response">>
): Promise<Handoff> {
  const db = supabaseAdmin();
  return check(
    await db.from("handoffs").update(patch).eq("handoff_id", handoffId).select("*").single()
  ) as Handoff;
}

// ---------------------------------------------------------------- trades
export const TRADE_WRITABLE_FIELDS = [
  "account_equity", "entry", "stop", "current_stop", "tp1", "tp2", "tp3", "current_tp1", "current_tp2", "current_tp3", "target", "quantity",
  "current_tp1_qty", "current_tp2_qty", "current_tp3_qty",
  "position_value", "portfolio_percent", "risk_dollars", "risk_percent", "position_notional",
  "margin", "leverage", "estimated_costs", "setup_score", "system_confidence", "opened_at",
  "exit_price", "closed_at", "realized_pnl", "fees", "return_percent", "holding_period",
  "execution_score", "execution_notes", "status", "exit_reason", "origin", "origin_notes",
] as const;

export async function listTrades(
  filter: { status?: TradeStatus; venue?: string; limit?: number } = {}
): Promise<Trade[]> {
  const db = supabaseAdmin();
  let q = db.from("trades").select("*");
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.venue) q = q.eq("venue", filter.venue);
  return check(await q.order("created_at", { ascending: false }).limit(filter.limit ?? 500)) as Trade[];
}

export async function createTrade(t: Partial<Trade>): Promise<Trade> {
  const db = supabaseAdmin();
  return check(await db.from("trades").insert(t).select("*").single()) as Trade;
}

export async function updateTrade(tradeId: string, patch: Partial<Trade>): Promise<Trade> {
  const db = supabaseAdmin();
  return check(
    await db.from("trades").update(patch).eq("trade_id", tradeId).select("*").single()
  ) as Trade;
}

// ---------------------------------------------------------------- partial / final exits
export const EXIT_REASONS = ["tp1", "tp2", "tp3", "manual", "stop", "breakeven_stop", "trail", "time"] as const;

/** Record one exit fill. The database closes the trade on the last fill and sums P&L across fills. */
export async function createTradeExit(e: {
  trade_id: string;
  quantity: number;
  price: number;
  pnl?: number | null;
  fee?: number | null;
  reason?: string;
  exited_at?: string;
  notes?: string | null;
}): Promise<TradeExit> {
  const db = supabaseAdmin();
  return check(await db.from("trade_exits").insert(e).select("*").single()) as TradeExit;
}

export async function listTradeExits(tradeId: string): Promise<TradeExit[]> {
  const db = supabaseAdmin();
  return check(
    await db.from("trade_exits").select("*").eq("trade_id", tradeId).order("exited_at", { ascending: true })
  ) as TradeExit[];
}

export async function getTrade(tradeId: string): Promise<Trade | null> {
  const db = supabaseAdmin();
  const rows = check(await db.from("trades").select("*").eq("trade_id", tradeId).limit(1)) as Trade[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------- reports
export async function createReport(r: {
  markdown: string;
  title?: string | null;
  report_date?: string;
}): Promise<DailyReport> {
  const db = supabaseAdmin();
  return check(await db.from("daily_reports").insert(r).select("*").single()) as DailyReport;
}

export async function latestReport(): Promise<DailyReport | null> {
  const db = supabaseAdmin();
  const rows = check(
    await db
      .from("daily_reports")
      .select("*")
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
  ) as DailyReport[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------- analytics
export type AccuracyRow = { key: string; graded: number; avgScore: number | null; directionAvg: number | null };

export function accuracyBy(
  evals: EvaluationDetail[],
  keyFn: (e: EvaluationDetail) => string | null | undefined
): AccuracyRow[] {
  const groups = new Map<string, EvaluationDetail[]>();
  for (const e of evals) {
    const k = keyFn(e) || "—";
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? Math.round((v.reduce((a, b) => a + Number(b), 0) / v.length) * 10) / 10 : null;
  };
  return Array.from(groups.entries())
    .map(([key, rows]) => ({
      key,
      graded: rows.length,
      avgScore: avg(rows.map((r) => (r.total_score == null ? null : Number(r.total_score)))),
      directionAvg: avg(rows.map((r) => (r.direction_score == null ? null : Number(r.direction_score)))),
    }))
    .sort((a, b) => b.graded - a.graded);
}

// ---------------------------------------------------------------- accounts & risk
export async function createAccountSnapshot(snap: {
  venue: "robinhood" | "blofin";
  equity: number;
  cash?: number | null;
  buying_power?: number | null;
  positions?: unknown[];
  reported_by?: string;
}) {
  const db = supabaseAdmin();
  return check(await db.from("account_snapshots").insert(snap).select("*").single());
}

export async function latestAccountSnapshot(venue: string) {
  const db = supabaseAdmin();
  const rows = check(
    await db
      .from("account_snapshots")
      .select("*")
      .eq("venue", venue)
      .order("reported_at", { ascending: false })
      .limit(1)
  ) as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function getRiskStatus(venue = "robinhood") {
  const db = supabaseAdmin();
  const [cfgRes, snapshot, openTrades, pendingRes] = await Promise.all([
    db.from("risk_config").select("*").eq("venue", venue).limit(1),
    latestAccountSnapshot(venue),
    listTrades({ status: "open", venue }),
    db
      .from("handoffs")
      .select("*")
      .eq("broker", venue)
      .eq("action", "open")
      .in("status", ["pending", "acknowledged"]),
  ]);
  const cfgRows = check(cfgRes) as Record<string, unknown>[];
  const pendingOpens = check(pendingRes) as Record<string, unknown>[];
  const openRisk = openTrades.reduce((a, t) => {
    const stop = Number(t.current_stop ?? t.stop ?? 0);
    const entry = Number(t.entry ?? 0);
    return a + Math.max(0, (entry - stop) * Number(t.quantity ?? 0));
  }, 0);
  const exposure = openTrades.reduce(
    (a, t) => a + Number(t.position_value ?? Number(t.entry ?? 0) * Number(t.quantity ?? 0)),
    0
  );
  return {
    config: cfgRows[0] ?? null,
    latest_snapshot: snapshot,
    open_positions: openTrades.length,
    pending_open_handoffs: pendingOpens.length,
    open_risk_dollars: Math.round(openRisk * 100) / 100,
    gross_exposure_dollars: Math.round(exposure * 100) / 100,
  };
}
