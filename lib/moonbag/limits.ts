// Limit orders (Stavros, 2026-10-12). One table for his own resting limits (Grok records them), Moonbag's suggested
// limits and Moonbag's paper limits (the feedback loop). The TradingView "LIMIT" alerts and the "Open limits"
// watchlist section are kept in sync by the trade-alert sync task.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LimitOrder = {
  limit_id: string;
  created_at: string;
  updated_at: string;
  venue: string;
  symbol: string;
  direction: "long" | "short";
  origin: "own" | "moonbag" | "paper";
  group_id: string | null;
  rung: number | null;
  limit_price: number;
  quantity: number | null;
  notional: number | null;
  leverage: number | null;
  margin: number | null;
  stop: number | null;
  current_stop: number | null;
  tp1: number | null;
  tp2: number | null;
  risk_dollars: number | null;
  risk_percent: number | null;
  plan_r: number | null;
  level: number | null;
  level_kind: string | null;
  grade: string | null;
  setup_id: string | null;
  status: "working" | "touched" | "filled" | "closed" | "cancelled" | "expired";
  expires_at: string | null;
  touched_at: string | null;
  filled_at: string | null;
  fill_price: number | null;
  trade_id: string | null;
  outcome: string | null;
  outcome_r: number | null;
  mfe_r: number | null;
  resolved_at: string | null;
  alert_id: string | null;
  notes: string | null;
  reasoning: string | null;
  source: string;
};

export type LimitScore = {
  origin: string; placed: number; filled: number; closed: number; targets: number; breakevens: number; stops: number;
  avg_r: number | null; total_r: number | null; target_rate_pct: number | null;
};

/** Fields Grok / Claude may write. IDs, timestamps and outcomes the database owns are excluded. */
export const LIMIT_WRITE = [
  "venue", "symbol", "direction", "origin", "group_id", "rung", "limit_price", "quantity", "notional", "leverage", "margin",
  "stop", "current_stop", "tp1", "tp2", "risk_dollars", "risk_percent", "plan_r", "level", "level_kind", "grade", "setup_id",
  "expires_at", "notes", "reasoning", "source",
] as const;
export const LIMIT_PATCH = ["status", "quantity", "limit_price", "stop", "current_stop", "tp1", "tp2", "expires_at", "filled_at", "fill_price", "trade_id", "notes"] as const;

export async function getLimits() {
  const db = supabaseAdmin();
  const [open, recent, score] = await Promise.all([
    db.from("limit_orders").select("*").in("status", ["working", "touched"]).order("symbol").order("limit_price", { ascending: false }),
    db.from("limit_orders").select("*").not("status", "in", "(working,touched)").order("updated_at", { ascending: false }).limit(30),
    db.from("v_limit_scoreboard").select("*"),
  ]);
  for (const r of [open, recent, score]) if (r.error) throw new Error(r.error.message);
  return { open: (open.data ?? []) as LimitOrder[], recent: (recent.data ?? []) as LimitOrder[], scoreboard: (score.data ?? []) as LimitScore[] };
}

const n = (v: unknown, d = 6) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d }));

/** Fixed-format text Grok relays word for word ("what limits do I have?"). */
export function limitsText(open: LimitOrder[]) {
  const L: string[] = ["MOONBAG OPEN LIMITS (your resting orders first, then Moonbag's paper limits)"];
  const mine = open.filter((o) => o.origin !== "paper");
  const paper = open.filter((o) => o.origin === "paper");
  const line = (o: LimitOrder) => {
    const rr = o.plan_r != null ? ` (${Number(o.plan_r).toFixed(1)}R)` : "";
    return `  ${o.symbol} ${o.direction === "long" ? "BUY" : "SELL"} limit ${n(o.limit_price)}${o.quantity != null ? ` × ${n(o.quantity)}` : ""}${o.leverage != null ? ` · ${n(o.leverage, 0)}x` : ""} · SL ${n(o.current_stop ?? o.stop)} · TP1 ${n(o.tp1)}${rr}${o.status === "touched" ? " · TOUCHED — check if filled" : ""}${o.expires_at ? ` · expires ${new Date(o.expires_at).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""} [${o.limit_id}]`;
  };
  L.push(mine.length ? mine.map(line).join("\n") : "  none");
  L.push("");
  L.push("PAPER (Moonbag testing the limit recipe — not orders)");
  L.push(paper.length ? paper.map(line).join("\n") : "  none");
  return L.join("\n");
}
