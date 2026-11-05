import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * PROP FIRM LAYER (CR-56, Stavros 2026-11-04: "build a layer into moonbag for prop firms ... first is passing eval - then account is
 * fully funded - build this like a professional prop firm trader would"). Breakout 1-Step Pro $10K is the first account.
 * Prop accounts are a separate book: their P&L, ROI and risk never mix with BloFin. Firm limits are hard; his 0.5%–1% sizing is guidance only.
 */
export type PropStatus = {
  account_id: string; firm: string; program: string; wallet_name: string | null; stage: string;
  starting_balance: number; balance: number; equity: number; last_snapshot_at: string | null;
  target_balance: number; to_target: number; target_progress_pct: number;
  dd_floor: number; room_to_floor: number;
  day_start: string; day_resets_at: string; day_start_balance: number; daily_floor: number; day_pnl: number; room_today: number; daily_limit_usd: number;
  risk_low_usd: number; risk_high_usd: number; max_leverage: number; profit_split_pct: number; fee_paid: number | null;
  trades: number; open_trades: number; open_risk_usd: number | null; days_traded: number; win_pct: number | null; total_r: number | null; avg_r: number | null;
  notes: string | null;
};
export type PropDay = { account_id: string; day_utc: string; trades: number; day_pnl: number; day_pct: number | null; daily_limit_usd: number };
export type PropTrade = {
  trade_id: string; account_id: string; symbol: string; direction: string; opened_at: string | null; status: string;
  r_multiple: number | null; leverage: number | null; risk_dollars: number | null; risk_pct_of_start: number | null;
  firm_flags: string[] | null; guidance_note: string | null;
};
export type PropNote = { id: number; created_at: string; author: string; kind: string | null; body: string };

const n = (v: unknown) => Number(v ?? 0);
const usd = (v: unknown) => `$${n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** His BloFin record, reused for the prop account (same trader, same setups). Read-only. */
export type DeskEdge = {
  books: { book: string; n: number; expectancy_r: number | null; total_r: number | null; win_pct: number | null; profit_factor: number | null; max_dd_r: number | null }[];
  perDay: { trades_per_day: string; days: number; green_days: number; avg_day_r: number | null; total_r: number | null }[];
};

export async function getDeskEdge(): Promise<DeskEdge> {
  const db = supabaseAdmin();
  const [b, d] = await Promise.all([
    db.from("v_edge_scorecard").select("book, n, expectancy_r, total_r, win_pct, profit_factor, max_dd_r").like("book", "Stavros%"),
    db.from("v_trades_per_day_summary").select("trades_per_day, days, green_days, avg_day_r, total_r"),
  ]);
  return { books: (b.data ?? []) as DeskEdge["books"], perDay: (d.data ?? []) as DeskEdge["perDay"] };
}

/** What his BloFin numbers say about passing this evaluation. Facts from data, no new rules. */
export function edgeLines(a: PropStatus, e: DeskEdge) {
  const all = e.books.find((x) => x.book === "Stavros · all");
  const out: string[] = [];
  if (all && all.expectancy_r != null) {
    const exp = n(all.expectancy_r);
    out.push(`Your BloFin record: ${all.n} trades, ${exp >= 0 ? "+" : ""}${exp.toFixed(2)}R/trade, win ${n(all.win_pct).toFixed(0)}%, worst drawdown ${n(all.max_dd_r).toFixed(1)}R.`);
    if (exp > 0) {
      const t1 = Math.ceil(n(a.to_target) / (exp * n(a.risk_high_usd)));
      const t05 = Math.ceil(n(a.to_target) / (exp * n(a.risk_low_usd)));
      out.push(`At that edge the target needs about ${t1} trades at 1% or ${t05} at 0.5%. No time limit, so there is no reason to size up.`);
    }
    if (all.max_dd_r != null) {
      const dd1 = n(all.max_dd_r) * n(a.risk_high_usd);
      out.push(`Your worst run (${n(all.max_dd_r).toFixed(1)}R) costs ${usd(dd1)} at 1% vs ${usd(n(a.starting_balance) - n(a.dd_floor))} of drawdown room — it fits at 1%; at 1.5%+ it would not.`);
    }
  }
  const bad = e.books.filter((x) => x.book !== "Stavros · all" && x.n >= 2 && n(x.expectancy_r) < 0).map((x) => `${x.book.replace("Stavros · ", "")} (${n(x.expectancy_r).toFixed(2)}R, n ${x.n})`);
  if (bad.length) out.push(`Setups losing money on BloFin so far: ${bad.join(", ")}.`);
  const best = [...e.perDay].filter((d) => d.days >= 2).sort((x, y) => n(y.avg_day_r) - n(x.avg_day_r))[0];
  if (best) out.push(`Trades per day: your best days were ${best.trades_per_day} trade(s) (${n(best.avg_day_r).toFixed(2)}R avg, ${best.green_days}/${best.days} green). ` +
    e.perDay.filter((d) => n(d.avg_day_r) < 0).map((d) => `${d.trades_per_day}/day averaged ${n(d.avg_day_r).toFixed(2)}R`).join("; ") + ".");
  out.push(`Your two-loss stop: two 1% losses = ${usd(2 * n(a.risk_high_usd))}, inside the ${usd(a.daily_limit_usd)} daily limit. Three would be ${usd(3 * n(a.risk_high_usd))} — right at the limit.`);
  return out;
}

/** Fixed instructions for Grok, returned with GET /prop so the agent never has to guess. */
export const GROK_PROP_PLAYBOOK = [
  "GROK — PROP ACCOUNT HANDLING (CR-56)",
  "1. Separate book. Breakout trades never go in BloFin P&L, ROI, risk, X posts or the BloFin daily-loss count.",
  "2. Each fill he reports: POST /trades {venue:\"breakout\", prop_account_id:\"BRK-PRO-10K-1\", symbol, direction, entry, stop, leverage, risk_dollars, opened_at, setup_tag, trigger_tag, status:\"open\"} — no thesis_id. Close with POST /trades/{id}/exits.",
  "3. After each session or any screenshot of the Breakout dashboard: POST /prop {action:\"snapshot\", account_id, balance, equity}. Use his numbers only.",
  "4. Before he trades, relay GET /prop text: room today, room to the $9,500 floor, reset time (5 PM Phoenix).",
  "5. Firm limits are HARD: 3% daily of prior-day balance, $9,500 static floor, 10x max leverage, a stop on every trade. Warn him clearly if a planned trade's risk is bigger than today's room.",
  "6. His 0.5%–1% sizing is GUIDANCE ONLY. Never call it a rule break and never refuse to log a trade over size.",
  "7. Pass / funded / breached: tell Claude in the journal (FOR CLAUDE). Only Claude changes the stage, after Stavros confirms.",
  "8. He places every order himself. You log, warn and relay — you never place prop trades.",
].join("\n");

export async function getPropData(accountId?: string) {
  const db = supabaseAdmin();
  let st = db.from("v_prop_status").select("*");
  let dy = db.from("v_prop_days").select("*").order("day_utc", { ascending: false }).limit(60);
  let tr = db.from("v_prop_adherence").select("*").order("opened_at", { ascending: false }).limit(100);
  if (accountId) { st = st.eq("account_id", accountId); dy = dy.eq("account_id", accountId); tr = tr.eq("account_id", accountId); }
  const nt = db.from("desk_journal").select("id, created_at, author, kind, body")
    .or("body.ilike.%breakout%,body.ilike.%prop firm%,body.ilike.%prop account%,body.ilike.%BRK-PRO%")
    .order("created_at", { ascending: false }).limit(25);
  const [s, d, t, j, edge] = await Promise.all([st, dy, tr, nt, getDeskEdge()]);
  if (s.error) throw new Error(s.error.message);
  return {
    edge,
    accounts: (s.data ?? []) as PropStatus[],
    days: (d.data ?? []) as PropDay[],
    trades: (t.data ?? []) as PropTrade[],
    notes: (j.data ?? []) as PropNote[],
  };
}

/** Per-trade helpers for the intake (Grok #414): today's prop trades and losses (firm day, 00:00 UTC), room in $ and in R. */
export type PropToday = { account_id: string; trades_today: number; losses_today: number; pnl_today: number;
  room_today_usd: number; room_floor_usd: number; room_today_r_1pct: number | null; room_today_r_05pct: number | null; room_floor_r_1pct: number | null; room_floor_r_05pct: number | null };

export async function getPropToday(a: PropStatus): Promise<PropToday> {
  const r = await supabaseAdmin().from("trades").select("status, opened_at, closed_at, realized_pnl")
    .eq("venue", "breakout").eq("prop_account_id", a.account_id).or(`opened_at.gte.${new Date(a.day_start).toISOString()},closed_at.gte.${new Date(a.day_start).toISOString()}`);
  const rows = (r.data ?? []) as { status: string; opened_at: string | null; closed_at: string | null; realized_pnl: number | null }[];
  const start = new Date(a.day_start).getTime();
  const closedToday = rows.filter((t) => t.closed_at && new Date(t.closed_at).getTime() >= start);
  const rr = (room: number, risk: number) => (risk > 0 ? Math.round((room / risk) * 100) / 100 : null);
  return {
    account_id: a.account_id,
    trades_today: rows.filter((t) => t.opened_at && new Date(t.opened_at).getTime() >= start).length,
    losses_today: closedToday.filter((t) => n(t.realized_pnl) < 0).length,
    pnl_today: n(a.day_pnl),
    room_today_usd: n(a.room_today), room_floor_usd: n(a.room_to_floor),
    room_today_r_1pct: rr(n(a.room_today), n(a.risk_high_usd)), room_today_r_05pct: rr(n(a.room_today), n(a.risk_low_usd)),
    room_floor_r_1pct: rr(n(a.room_to_floor), n(a.risk_high_usd)), room_floor_r_05pct: rr(n(a.room_to_floor), n(a.risk_low_usd)),
  };
}

/** 1h ATR(14) from the hourly candles table (same source as /quick). min_stop = 1.5 × ATR, the stop-distance check. */
export type HourlySwing = { coin: string; last_close: number; atr_1h: number; atr_1h_pct: number; min_stop_distance: number; bar_at: string };

export async function getHourlySwing(coins: string[]): Promise<HourlySwing[]> {
  const db = supabaseAdmin();
  const out = await Promise.all(coins.slice(0, 8).map(async (raw) => {
    const coin = raw.toUpperCase().replace(/USDT.*$/, "").trim();
    const r = await db.from("candles").select("h, l, c, ts").eq("asset", coin).eq("tf", "1h").order("ts", { ascending: false }).limit(15);
    const b = (r.data ?? []) as { h: number; l: number; c: number; ts: string }[];
    if (b.length < 3) return null;
    let sum = 0;
    for (let i = 0; i < b.length - 1; i++) sum += Math.max(n(b[i].h) - n(b[i].l), Math.abs(n(b[i].h) - n(b[i + 1].c)), Math.abs(n(b[i].l) - n(b[i + 1].c)));
    const atr = sum / (b.length - 1);
    const px = n(b[0].c);
    return { coin, last_close: px, atr_1h: atr, atr_1h_pct: px ? (atr / px) * 100 : 0, min_stop_distance: 1.5 * atr, bar_at: b[0].ts };
  }));
  return out.filter(Boolean) as HourlySwing[];
}

const fpx = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 0 : v >= 1 ? 2 : 5 });
export const todayLine = (t: PropToday) =>
  `Today (firm day): ${t.trades_today} prop trade(s), ${t.losses_today} loss(es). Room ${usd(t.room_today_usd)} = ${t.room_today_r_1pct ?? "—"}R at 1% / ${t.room_today_r_05pct ?? "—"}R at 0.5%. To floor ${usd(t.room_floor_usd)} = ${t.room_floor_r_1pct ?? "—"}R at 1% / ${t.room_floor_r_05pct ?? "—"}R at 0.5%.`;
export const swingLine = (s: HourlySwing) =>
  `${s.coin} 1h ATR ${fpx(s.atr_1h)} (${s.atr_1h_pct.toFixed(2)}%) → stop at least ${fpx(s.min_stop_distance)} from entry (1.5× ATR) · last 1h close ${fpx(s.last_close)}`;

/** Losses in a row at a given $ risk before a limit is hit. */
export const lossesToLimit = (room: number, risk: number) => (risk > 0 ? Math.max(0, Math.floor(room / risk)) : null);

/** Fixed status text for agents to relay. Firm limits are facts; sizing is guidance. */
export function propText(a: PropStatus, trades: PropTrade[], edge?: DeskEdge) {
  const flagged = trades.filter((t) => t.account_id === a.account_id && (t.firm_flags?.length ?? 0) > 0);
  const resetPhx = new Date(a.day_resets_at).toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
  const lines = [
    `${a.firm} ${a.program} (${a.account_id}) · ${a.stage.toUpperCase()}`,
    `Balance ${usd(a.balance)} · equity ${usd(a.equity)} · target ${usd(a.target_balance)} (${usd(a.to_target)} to go, ${n(a.target_progress_pct).toFixed(0)}% there)`,
    `Static floor ${usd(a.dd_floor)} · room ${usd(a.room_to_floor)} (${lossesToLimit(n(a.room_to_floor), n(a.risk_high_usd))} losses at 1%)`,
    `Today: P&L ${usd(a.day_pnl)} · daily floor ${usd(a.daily_floor)} · room ${usd(a.room_today)} of ${usd(a.daily_limit_usd)} (${lossesToLimit(n(a.room_today), n(a.risk_high_usd))} losses at 1%) · resets ${resetPhx} Phoenix`,
    `Max leverage ${n(a.max_leverage)}x · sizing guidance 0.5–1% = ${usd(a.risk_low_usd)}–${usd(a.risk_high_usd)} (guidance, not a rule)`,
    `Trades ${a.trades} (${a.open_trades} open) · days traded ${a.days_traded}` + (a.total_r != null ? ` · ${n(a.total_r).toFixed(2)}R total, win ${n(a.win_pct).toFixed(0)}%` : ""),
  ];
  if (flagged.length) lines.push(`FIRM FLAGS: ` + flagged.map((t) => `${t.symbol} ${t.trade_id}: ${t.firm_flags!.join(", ")}`).join(" | "));
  if (a.stage === "funded") lines.push(`Payout at ${n(a.profit_split_pct)}%: ${usd(Math.max(0, n(a.balance) - n(a.starting_balance)) * n(a.profit_split_pct) / 100)} on current profit`);
  if (edge) lines.push("", "WHAT YOUR BLOFIN DATA SAYS", ...edgeLines(a, edge).map((l) => `- ${l}`));
  return lines.join("\n");
}
