// Moonbag shared record types — mirror supabase/migrations/*_moonbag_core.sql
// and Master Trading System spec v1.1 (§16–§24).

export type Bias = "bullish" | "bearish" | "neutral" | "mixed";
export type Direction = "long" | "short";
export type Market = "crypto" | "equity" | "macro" | "commodity" | "fx" | "index";
export type SetupGrade = "A+" | "A" | "B" | "C";
export type ThesisStatus = "active" | "superseded" | "expired" | "invalidated" | "cancelled";
export type Decision = "trade" | "no_trade" | "watch";

export interface Levels {
  support: number[];
  resistance: number[];
  breakout: number | null;
  invalidation: number | null;
}

export interface TradePlan {
  direction?: Direction | null;
  entry_zone?: number[];
  stop?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  tp3?: number | null;
}

export interface DailyThesis {
  thesis_id: string; // MB-YYYY-MM-DD-ASSET-###
  thesis_date: string;
  created_at: string;
  asset: string; // BTC, ETH, SPY, TSLA, MASTER, EQUITY …
  market: Market;
  time_horizon: string | null;
  bias: Bias;
  thesis_confidence: number | null;
  system_confidence: number | null;
  setup_score: number | null;
  setup_grade: SetupGrade | null;
  market_regime: string | null;
  risk_environment: string | null;
  levels: Levels;
  trade_plan: TradePlan;
  primary_scenario: string | null;
  alternative_scenario: string | null;
  what_changes_our_mind: string | null;
  catalysts: string[];
  conditions_for_entry: string[];
  conditions_to_cancel: string[];
  reasoning: string | null;
  decision: Decision;
  supersedes: string | null;
  change_reason: string | null;
  status: ThesisStatus;
  status_changed_at: string | null;
  source: string;
}

/** Fields a writer supplies. IDs, timestamps, grade and status are set by the DB. */
export type NewThesis = Pick<DailyThesis, "asset" | "market" | "bias"> &
  Partial<
    Pick<
      DailyThesis,
      | "thesis_date"
      | "time_horizon"
      | "thesis_confidence"
      | "system_confidence"
      | "setup_score"
      | "market_regime"
      | "risk_environment"
      | "levels"
      | "trade_plan"
      | "primary_scenario"
      | "alternative_scenario"
      | "what_changes_our_mind"
      | "catalysts"
      | "conditions_for_entry"
      | "conditions_to_cancel"
      | "reasoning"
      | "decision"
      | "supersedes"
      | "change_reason"
      | "source"
    >
  >;

export type ErrorType =
  | "none"
  | "direction"
  | "timing"
  | "level"
  | "regime"
  | "execution"
  | "catalyst"
  | "other";

export interface Evaluation {
  evaluation_id: string; // MBE-…
  thesis_id: string;
  evaluation_date: string;
  direction_score: number | null;
  levels_score: number | null;
  setup_score: number | null;
  invalidation_score: number | null;
  target_score: number | null;
  total_score: number | null;
  setup_triggered: boolean | null;
  actual_result: Record<string, unknown>;
  what_worked: string[];
  what_failed: string[];
  error_type: ErrorType | null;
  missed_information: string | null;
  overweighted_information: string | null;
  lesson: string | null;
  methodology_change_warranted: boolean;
  evaluated_at: string;
}

export type NewEvaluation = Pick<Evaluation, "thesis_id"> &
  Partial<
    Omit<Evaluation, "evaluation_id" | "thesis_id" | "total_score" | "evaluated_at">
  >;

export interface EvaluationDetail extends Evaluation {
  thesis_date: string;
  asset: string;
  market: Market;
  bias: Bias;
  market_regime: string | null;
  setup_grade: SetupGrade | null;
  thesis_setup_score: number | null;
  thesis_confidence: number | null;
  decision: Decision;
  planned_direction: string | null;
}

export type AlertStatus = "active" | "triggered" | "stale" | "cancelled" | "expired";
export type AlertAction = "REEVALUATE" | "NOTIFY" | "ENTER" | "EXIT" | "CANCEL";

export interface Alert {
  alert_id: string; // MBA-…
  thesis_id: string;
  tv_alert_id: number | null;
  asset: string;
  tv_symbol: string | null;
  condition: string;
  trigger_price: number | null;
  direction: "long" | "short" | "neutral" | null;
  action: AlertAction;
  message: string | null;
  status: AlertStatus;
  status_reason: string | null;
  triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type HandoffStatus =
  | "pending"
  | "acknowledged"
  | "executed"
  | "rejected"
  | "cancelled"
  | "expired";

export interface Handoff {
  handoff_id: string; // MBH-…
  thesis_id: string;
  destination: string;
  broker: string;
  symbol: string;
  direction: Direction;
  entry_condition: string | null;
  invalidation: string | null;
  target_framework: string | null;
  time_horizon: string | null;
  setup_score: number | null;
  system_confidence: number | null;
  position_guidance: string | null;
  conditions_to_cancel: string[];
  expires_at: string | null;
  status: HandoffStatus;
  status_reason: string | null;
  grok_response: Record<string, unknown> | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TradeStatus = "pending" | "open" | "closed" | "cancelled";
export type Venue = "robinhood" | "blofin" | "other";

export interface Trade {
  trade_id: string; // MBT-…
  thesis_id: string;
  handoff_id: string | null;
  venue: Venue;
  execution: "manual" | "grokbot" | "other";
  symbol: string;
  direction: Direction;
  account_equity: number | null;
  entry: number | null;
  stop: number | null;
  current_stop: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  /** Live targets after an adjustment; the originals above stay write-once for grading. */
  current_tp1: number | null;
  current_tp2: number | null;
  current_tp3: number | null;
  target: number | null;
  quantity: number | null;
  position_value: number | null;
  portfolio_percent: number | null;
  risk_dollars: number | null;
  risk_percent: number | null;
  position_notional: number | null;
  margin: number | null;
  leverage: number | null;
  estimated_costs: number | null;
  setup_score: number | null;
  system_confidence: number | null;
  opened_at: string | null;
  exit_price: number | null;
  closed_at: string | null;
  realized_pnl: number | null;
  fees: number | null;
  return_percent: number | null;
  holding_period: string | null;
  r_multiple: number | null;
  execution_score: number | null;
  execution_notes: string | null;
  setup_type?: string | null;
  exit_reason?: string | null;
  /** "moonbag" = followed a DESK ALERT; "own" = Stavros's own call. */
  origin?: "moonbag" | "own" | null;
  /** What Moonbag's confidence rubric gives the setup at entry (own trades: scored after the fact). */
  moonbag_score?: number | null;
  origin_notes?: string | null;
  // Partial exits (trade_exits) — maintained by the database, never written directly.
  qty_open?: number | null;
  // Partial take-profit orders: size (coin units) on each working target; null = the whole remaining position.
  current_tp1_qty?: number | null;
  current_tp2_qty?: number | null;
  current_tp3_qty?: number | null;
  banked_pnl?: number | null;
  banked_fees?: number | null;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
}

export interface SystemState {
  state_date: string;
  system_confidence: number;
  rolling_window_days: number;
  forecasts_graded: number;
  avg_total_score: number | null;
  direction_accuracy: number | null;
  level_accuracy: number | null;
  setup_accuracy: number | null;
  invalidation_accuracy: number | null;
  target_accuracy: number | null;
  current_regime: string | null;
  risk_environment: string | null;
  computed_at: string;
}

export interface DailyReport {
  report_id: string;
  report_date: string;
  title: string | null;
  markdown: string;
  created_at: string;
}

export type TradeExit = {
  exit_id: string;
  trade_id: string;
  kind: "partial" | "final";
  quantity: number;
  price: number;
  pnl: number | null;
  fee: number | null;
  pct_of_position: number | null;
  r_at_exit: number | null;
  reason: "tp1" | "tp2" | "tp3" | "manual" | "stop" | "breakeven_stop" | "trail" | "time";
  exited_at: string;
  notes: string | null;
  created_at: string;
};
