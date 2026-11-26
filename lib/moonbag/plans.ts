import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * YOUR PLANS (CR-96, Stavros 2026-11-24): "Grade my own plans" — "prices will change but structure remains".
 * He gives Grok conditional setups. Moonbag watches each one in the database (mb_plans_check, every 15 minutes),
 * fires it as a prop trade only when the structure confirms, sends it like any engine trade (journal + TradingView alert),
 * and grades every plan to the end whether he takes it or not.
 *   deviation — price sweeps past the zone and a candle closes back inside (optional: then retests the zone and holds)
 *   hold      — price comes into the zone and a candle closes back out of it in his direction; a close through the zone cancels it
 *   breakout  — a candle closes through the zone (optional: then retests it and holds)
 * Stop: his stop if he gave one, otherwise just past the sweep wick (deviation), the zone low/high (hold), or the far side of the zone (breakout).
 * Target: his target if he gave one, otherwise 2R.
 */
export type Plan = {
  plan_id: number; coin: string; side: "long" | "short"; setup: "deviation" | "hold" | "breakout"; zone_lo: number; zone_hi: number;
  confirm_tf: string; retest: boolean; stop_px: number | null; target_px: number | null; name: string | null;
  status: "watching" | "armed" | "reclaimed" | "triggered" | "expired" | "invalid" | "cancelled"; status_note: string | null;
  created_at: string; valid_until: string; signal_id: string | null; entry: number | null; stop: number | null; tp: number | null;
  trade_status: string | null; r_net: number | null; taken_trade_id: string | null;
};

export const PLAN_FIELDS = ["coin", "side", "setup", "zone_lo", "zone_hi", "confirm_tf", "retest", "stop", "target", "valid_until", "name", "his_words", "source_note", "cancel", "reason"] as const;

export async function getPlans(days = 30): Promise<Plan[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const r = await supabaseAdmin().from("v_plan_record").select("*").gte("created_at", since).order("created_at", { ascending: false });
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as Plan[];
}

export async function postPlan(body: Record<string, unknown>, by: string) {
  const r = await supabaseAdmin().rpc("mb_plan_post", { p: body, p_by: by });
  if (r.error) throw new Error(r.error.message);
  return r.data as { plan_id: number; status: string };
}

const n = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 8 }));
const zone = (p: Plan) => (Number(p.zone_lo) === Number(p.zone_hi) ? n(p.zone_lo) : `${n(p.zone_lo)}–${n(p.zone_hi)}`);

export const STATUS_WORD: Record<Plan["status"], string> = {
  watching: "watching", armed: "price is in the zone — waiting for confirmation", reclaimed: "reclaimed — waiting for the retest",
  triggered: "fired", expired: "never triggered", invalid: "cancelled by price", cancelled: "cancelled",
};

export function planLine(p: Plan) {
  const what = `#${p.plan_id} ${p.coin} ${p.side} — ${p.setup}${p.retest ? " + retest" : ""} at ${zone(p)} (${p.confirm_tf})`;
  const sl = p.stop_px != null ? ` · your stop ${n(p.stop_px)}` : "";
  const tg = p.target_px != null ? ` · your target ${n(p.target_px)}` : "";
  const out = p.status === "triggered"
    ? ` · fired: entry ${n(p.entry)} stop ${n(p.stop)} target ${n(p.tp)} → ${p.r_net != null ? `${Number(p.r_net) > 0 ? "+" : ""}${Number(p.r_net).toFixed(2)}R` : p.trade_status ?? "open"}${p.taken_trade_id ? " (you took it)" : ""}`
    : ` · ${STATUS_WORD[p.status]}${p.status_note && p.status !== "watching" ? ` (${p.status_note})` : ""}`;
  return what + sl + tg + out;
}

/** His record by setup, from plans that fired and finished. */
export function planRecord(plans: Plan[]) {
  const by: Record<string, { n: number; r: number; wins: number }> = {};
  for (const p of plans) {
    if (p.status !== "triggered" || p.r_net == null) continue;
    const k = `${p.setup} ${p.side}`;
    by[k] ??= { n: 0, r: 0, wins: 0 };
    by[k].n++; by[k].r += Number(p.r_net); if (Number(p.r_net) > 0) by[k].wins++;
  }
  return Object.entries(by).map(([k, v]) => ({ setup: k, n: v.n, total_r: Math.round(v.r * 100) / 100, avg_r: Math.round((v.r / v.n) * 100) / 100, win_pct: Math.round((v.wins / v.n) * 100) }));
}
