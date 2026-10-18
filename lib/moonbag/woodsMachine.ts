// The Woods machine (Stavros, 2026-10-16: "I love the woods map ... make it a machine. accuracy and r:r ... make sure i
// always know the time of this data, if i use bad data its a bad trade ... always have limits with confidence score that
// way i can throw them in if i agree"). Read-only loader for the website: public.woods_scan() writes woods_machine every
// 15 minutes from Moonbag's own BloFin candle feed (public.lev_candle_sync(), every 5 minutes). Display only.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WoodsRow = {
  coin: string;
  side: "long" | "short";
  as_of: string;
  data_as_of: string | null;
  price: number | null;
  anchor: { btc: number; line_low: number | null; line_high: number | null; state: string; text: string; macro?: { state: string; text: string }; bias?: { bias: string | null; confirmed: boolean; conviction: number | null; week: string; thoughts: string | null } | null;
    context?: { state: string; text: string; as_of: string | null; total_bn: number | null; total_24h_pct: number | null; total_7d_pct: number | null; usdt_d: number | null; usdt_d_24h: number | null; usdt_d_7d: number | null; ethbtc: number | null; ethbtc_24h_pct: number | null; ethbtc_7d_pct: number | null };
    combo?: { state: string | null; text: string; bar: string | null; bull_count: number | null; bear_count: number | null; woodsbot: { side: string; bar: string; at: string } | null } } | null;
  checklist: {
    a: boolean; b: boolean; c: boolean | null; d: boolean | null;
    pool: string | null; level: number | null; wick: number | null; bar: string | null;
    rsi_now: number | null; rsi_note: string | null; trigger_at: string | null;
    fib_zone?: [number, number] | null; fib_confluence?: boolean; ema200?: number | null; ema200_confluence?: boolean; ctx_aligned?: boolean; ctx_state?: string; combo_aligned?: boolean;
  } | null;
  trigger: boolean;
  limit_plan: {
    entry: number; stop: number; tp1: number; tp2: number; rr1: number; rr2: number;
    stop_pct: number; pool: string; pool_note: string | null; atr1h: number;
  } | null;
  confidence: number | null;
  grade: string | null;
  components: Record<string, number> | null;
  blocked: string | null;
};

export type Freshness = { asset: string; tf: string; last_bar: string | null; fetched_at: string; ok: boolean; error: string | null; bar_age_min: number | null; fresh: boolean | null };
export type WoodsEvent = { id: number; created_at: string; coin: string; side: string; kind: string; bar_ts: string | null; detail: Record<string, unknown> | null };

export type WoodsMachine = {
  rows: WoodsRow[];
  feed: Freshness[];
  events: WoodsEvent[];
  deskLead: { started_at: string; mode: string; summary: string } | null;
};

export async function getWoodsMachine(): Promise<WoodsMachine> {
  const db = supabaseAdmin();
  const [rows, feed, events, desk] = await Promise.all([
    db.from("woods_machine").select("*").order("coin").order("side"),
    db.from("v_data_freshness").select("*").in("asset", ["BTC", "ETH", "SOL"]),
    db.from("woods_events").select("*").gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()).order("created_at", { ascending: false }).limit(12),
    db.from("agent_runs").select("started_at, mode, summary").like("agent_id", "desk_lead%").order("started_at", { ascending: false }).limit(1),
  ]);
  return {
    rows: (rows.data ?? []) as WoodsRow[],
    feed: (feed.data ?? []) as Freshness[],
    events: (events.data ?? []) as WoodsEvent[],
    deskLead: ((desk.data ?? [])[0] ?? null) as WoodsMachine["deskLead"],
  };
}

/** How trustworthy is the data right now? Based on BTC/ETH/SOL 15m bars (closed, from BloFin). */
export function feedHealth(feed: Freshness[], now = Date.now()) {
  const m15 = feed.filter((f) => f.tf === "15m");
  if (!m15.length) return { tone: "red" as const, label: "no data feed", ageMin: null as number | null, lastBar: null as string | null };
  const newest = m15.map((f) => (f.last_bar ? Date.parse(f.last_bar) : 0)).reduce((a, b) => Math.min(a, b));
  const ageMin = newest ? Math.round((now - newest) / 60_000) - 15 : null; // minutes since the bar CLOSED
  const anyErr = m15.some((f) => !f.ok);
  const tone = ageMin == null || anyErr || ageMin > 45 ? "red" : ageMin > 20 ? "amber" : "green";
  return { tone, label: tone === "green" ? "fresh" : tone === "amber" ? "aging" : "STALE — don't trade off it", ageMin, lastBar: newest ? new Date(newest + 15 * 60_000).toISOString() : null };
}
