// Limit orders (Stavros, 2026-10-12). One table for his own resting limits (Grok records them), Moonbag's suggested
// limits and Moonbag's paper limits (the feedback loop). The TradingView "LIMIT" alerts and the "Open limits"
// watchlist section are kept in sync by the trade-alert sync task.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calcEquity } from "./equity";

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
  /** CR-7 (2026-10-20, Stavros: "when i set limit orders, you should have invalid if: and then send me a trading view notification to cancel"). */
  invalid_if?: string | null;
  invalid_price?: number | null;
  invalid_btc?: number | null;
  invalid_by?: string | null;
  invalid_alert_ids?: string[] | null;
};

export type LimitScore = {
  origin: string; placed: number; filled: number; closed: number; targets: number; breakevens: number; stops: number;
  avg_r: number | null; total_r: number | null; target_rate_pct: number | null;
};

/** Fields Grok / Claude may write. IDs, timestamps and outcomes the database owns are excluded. */
export const LIMIT_WRITE = [
  "venue", "symbol", "direction", "origin", "group_id", "rung", "limit_price", "quantity", "notional", "leverage", "margin",
  "stop", "current_stop", "tp1", "tp2", "risk_dollars", "risk_percent", "plan_r", "level", "level_kind", "grade", "setup_id",
  "expires_at", "notes", "reasoning", "source", "invalid_if", "invalid_price", "invalid_btc", "invalid_by",
] as const;
export const LIMIT_PATCH = ["status", "quantity", "limit_price", "stop", "current_stop", "tp1", "tp2", "expires_at", "filled_at", "fill_price", "trade_id", "notes", "invalid_if", "invalid_price", "invalid_btc", "invalid_by"] as const;

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
export function limitsText(open: LimitOrder[], ctx?: SizingContext | null) {
  const L: string[] = ["MOONBAG OPEN LIMITS (your resting orders first, then Moonbag's paper limits)"];
  const mine = open.filter((o) => o.origin !== "paper");
  const paper = open.filter((o) => o.origin === "paper");
  const line = (o: LimitOrder) => {
    const rr = o.plan_r != null ? ` (${Number(o.plan_r).toFixed(1)}R)` : "";
    return `  ${o.symbol} ${o.direction === "long" ? "BUY" : "SELL"} limit ${n(o.limit_price)}${o.quantity != null ? ` × ${n(o.quantity)}` : ""}${o.leverage != null ? ` · ${n(o.leverage, 0)}x` : ""} · SL ${n(o.current_stop ?? o.stop)} · TP1 ${n(o.tp1)}${rr}${o.status === "touched" ? " · TOUCHED — check if filled" : ""}${o.expires_at ? ` · expires ${new Date(o.expires_at).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""} [${o.limit_id}]`;
  };
  // Inputs under each limit he hasn't sized yet, so he never has to calculate (Stavros, 2026-10-14).
  const withInputs = (o: LimitOrder) => {
    const inp = o.quantity == null && ctx ? limitInputs(o, ctx) : null;
    return inp ? `${line(o)}\n${inp.text.split("\n").map((x) => `     ${x}`).join("\n")}` : line(o);
  };
  L.push(mine.length ? mine.map(withInputs).join("\n") : "  none");
  L.push("");
  L.push("PAPER (Moonbag testing the limit recipe — not orders; inputs shown in case you want to place one)");
  L.push(paper.length ? paper.map(withInputs).join("\n") : "  none");
  return L.join("\n");
}

// ---------------------------------------------------------------- trade inputs for a limit (Stavros, 2026-10-14:
// "can you give me the trade inputs ... that way i dont have to calculate myself"). Same sizing rules as the desk's
// LIMIT SETUP card: risk 2% on BTC/ETH/SOL (1% other coins), B grade half, red-folder day half unless A+, half after
// 2 losses in a row; leverage = lowest whole x keeping margin ≤ 50% of the balance (and ≤ max_margin_dollars), within
// the grade ceiling; liquidation ≥ 1.25 × the stop distance. Analysis only — Stavros places every order.

export type LimitInputs = {
  riskPct: number;
  riskUsd: number;
  qty: number;
  qtyTp1: number;
  qtyTp2: number;
  notional: number;
  leverage: number;
  ceiling: number;
  margin: number;
  liq: number;
  liqOk: boolean;
  stopPct: number;
  beAt: number | null;
  quickTp: number;
  quickBe: number;
  notes: string[];
  plan: [string, string, string];
  text: string;
};

export type SizingContext = {
  equity: number;
  equityAt?: string | null;
  maxMarginPct?: number | null;
  maxMarginUsd?: number | null;
  redDay?: { red: boolean; events: string | null } | null;
  lossStreak?: number;
  ceilings?: Record<string, { tier: string; max: number }>;
};

const RISK_CORE = new Set(["BTC", "ETH", "SOL"]);
const qtyDecimals = (price: number) => (price >= 1000 ? 4 : price >= 10 ? 2 : price >= 1 ? 1 : 0);
const floorTo = (x: number, d: number) => Math.floor(x * 10 ** d) / 10 ** d;
const fp = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: v >= 1 ? 2 : 4, maximumFractionDigits: v >= 1 ? 2 : 4 });

export function limitInputs(o: LimitOrder, ctx: SizingContext, opts: { split?: number; riskCap?: number | null } = {}): LimitInputs | null {
  const entry = Number(o.limit_price), stop = Number(o.current_stop ?? o.stop);
  if (!entry || !stop || !ctx.equity || entry === stop) return null;
  const sg = o.direction === "long" ? 1 : -1;
  const dist = Math.abs(entry - stop);
  if (sg * (entry - stop) <= 0) return null; // stop on the wrong side
  const sym = o.symbol.toUpperCase();
  const grade = (o.grade ?? "B").toUpperCase();
  const notes: string[] = [];

  let riskPct = RISK_CORE.has(sym) ? 2 : 1;
  if (grade === "B") { riskPct /= 2; notes.push("grade B: half risk"); }
  if (ctx.redDay?.red && grade !== "A+") { riskPct /= 2; notes.push(`red-folder day${ctx.redDay.events ? ` (${ctx.redDay.events})` : ""}: half risk — no fill within 2h of the release`); }
  else if (ctx.redDay?.red) notes.push(`red-folder day${ctx.redDay.events ? ` (${ctx.redDay.events})` : ""}: A+ keeps full risk — no fill within 2h of the release`);
  if ((ctx.lossStreak ?? 0) >= 2) { riskPct /= 2; notes.push("2 losses in a row: half risk"); }
  // Caller's risk (Stavros 2026-10-18: Woods/Eliz/Johnny "may give risk as well. Like 1% or .5%") — can only LOWER the house risk, never raise it.
  if (opts.riskCap != null && opts.riskCap > 0 && opts.riskCap < riskPct) { riskPct = opts.riskCap; notes.push(`caller's risk ${opts.riskCap}%`); }
  else if (opts.riskCap != null && opts.riskCap > riskPct) notes.push(`caller asked ${opts.riskCap}% — capped at the house ${riskPct}% for this grade/coin`);
  const riskUsd = (ctx.equity * riskPct) / 100;

  const d = qtyDecimals(entry);
  let qty = floorTo(riskUsd / dist, d);

  const u = ctx.ceilings?.[sym];
  const core = u ? u.tier === "core" : sym === "BTC" || sym === "ETH";
  // Leverage (Stavros, 2026-10-15: "up to 100x — safety rule wins"; raised to 150x 2026-10-16: "raise to 150x since that is what exchange allows"): the ceiling is the coin's database cap (lev_universe,
  // ≤ 150) and never more than keeps liquidation ≥ 1.25 × the stop distance away, allowing ~0.5% maintenance margin.
  // Leverage never changes the dollar risk; the default is still the LOWEST leverage that keeps margin ≤ 50% of the balance.
  const safetyCap = Math.max(1, Math.floor(1 / (1.25 * (dist / entry) + 0.005)));
  const ceiling = Math.min(u?.max ?? 150, 150, safetyCap);
  const marginCap = Math.min((ctx.equity * (ctx.maxMarginPct ?? 50)) / 100, ctx.maxMarginUsd ?? Infinity);

  let notional = qty * entry;
  let leverage = Math.max(1, Math.ceil(notional / marginCap));
  if (leverage > ceiling) {
    leverage = ceiling;
    qty = floorTo((marginCap * ceiling) / entry, d);
    notional = qty * entry;
    notes.push(`size cut to fit ${ceiling}x and the margin cap — risk is lower than ${riskPct}%`);
  }
  const margin = notional / leverage;
  const liq = entry * (1 - sg / leverage);
  const liqOk = Math.abs(entry - liq) >= 1.25 * dist;
  if (!liqOk) notes.push("liquidation is too close to the stop — use less leverage");
  const qtyTp1 = floorTo(qty * (opts.split ?? 0.5), d);
  const qtyTp2 = floorTo(qty - qtyTp1, d);
  const stopPct = (dist / entry) * 100;
  const beAt = entry + sg * 1.5 * dist;
  const quickTp = entry + sg * 2 * dist;
  const quickBe = entry + sg * dist;
  const side = o.direction === "long" ? "Long" : "Short";
  const levelTxt = o.level != null ? `${(o.level_kind ?? "level").replace(/_/g, " ")} ${fp(Number(o.level))}` : "the level";
  const plan: [string, string, string] = [
    `Bias: ${o.direction} because price is expected to sweep the ${levelTxt} and ${o.direction === "long" ? "bounce" : "reject"}`,
    `Entering when: the limit at ${fp(entry)} fills (½ 1h ATR through the level)`,
    `Wrong if: price trades through ${fp(stop)} (the stop)`,
  ];
  const tp1 = o.tp1 != null ? Number(o.tp1) : null, tp2 = o.tp2 != null ? Number(o.tp2) : null;
  const rr = tp1 != null ? Math.abs(tp1 - entry) / dist : null;
  const exp = o.expires_at ? new Date(o.expires_at).toLocaleString("en-US", { timeZone: "America/Phoenix", weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
  const text = [
    ...plan,
    `${sym} ${side} · LIMIT ${fp(entry)} · SL ${fp(stop)} (${stopPct.toFixed(2)}%) · TP1 ${tp1 != null ? fp(tp1) : "—"}${rr != null ? ` (${rr.toFixed(1)}R)` : ""} for ${qtyTp1} · TP2 ${tp2 != null ? fp(tp2) : "—"} for ${qtyTp2}`,
    `Size ${qty} ${sym} (≈ $${notional.toFixed(2)}) · Leverage ${leverage}x isolated (max ${ceiling}x) · Margin $${margin.toFixed(2)} · Risk $${riskUsd.toFixed(2)} (${riskPct}% of $${ctx.equity.toFixed(2)}) · Liq ≈ ${fp(liq)}`,
    `Manage: stop to entry at +1.5R (${fp(beAt)}). Cancel ${exp ? `at ${exp} Phoenix ` : ""}if not filled, or if price reaches TP1 first. Quick mode instead: TP ${fp(quickTp)} (2R), stop to entry at +1R (${fp(quickBe)}).`,
    ...(notes.length ? [`Note: ${notes.join(" · ")}`] : []),
  ].join("\n");
  return { riskPct, riskUsd, qty, qtyTp1, qtyTp2, notional, leverage, ceiling, margin, liq, liqOk, stopPct, beAt, quickTp, quickBe, notes, plan, text };
}

/** Sizing context from the database: latest BloFin balance, risk config, today's red-folder flag, loss streak, ceilings. */
export async function getSizingContext(): Promise<SizingContext | null> {
  const db = supabaseAdmin();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
  const [snap, cfg, econ, closed, uni] = await Promise.all([
    db.from("account_snapshots").select("equity, reported_at").eq("venue", "blofin").order("reported_at", { ascending: false }).limit(1),
    db.from("risk_config").select("max_margin_pct, max_margin_dollars, starting_equity").eq("venue", "blofin").limit(1),
    db.from("econ_days").select("red, events").eq("day", day).maybeSingle(),
    db.from("trades").select("realized_pnl").eq("venue", "blofin").eq("status", "closed").order("closed_at", { ascending: false }).limit(2),
    db.from("lev_universe").select("asset, tier, max_leverage"),
  ]);
  const s = snap.data?.[0];
  const c = cfg.data?.[0];
  const calc = await calcEquity("blofin");
  const equity = calc ? calc.equity : s ? Number(s.equity) : Number(c?.starting_equity ?? 0);
  if (!equity) return null;
  const last2 = ((closed.data ?? []) as { realized_pnl: number | null }[]).map((t) => Number(t.realized_pnl ?? 0));
  const ceilings: Record<string, { tier: string; max: number }> = {};
  for (const u of (uni.data ?? []) as { asset: string; tier: string; max_leverage: number }[]) ceilings[u.asset] = { tier: u.tier, max: Number(u.max_leverage) };
  return {
    equity,
    equityAt: s?.reported_at ?? null,
    maxMarginPct: c?.max_margin_pct != null ? Number(c.max_margin_pct) : 50,
    maxMarginUsd: c?.max_margin_dollars != null ? Number(c.max_margin_dollars) : null,
    redDay: econ.data ? { red: !!econ.data.red, events: econ.data.events ?? null } : null,
    lossStreak: last2.length === 2 && last2.every((x: number) => x < 0) ? 2 : 0,
    ceilings,
  };
}
