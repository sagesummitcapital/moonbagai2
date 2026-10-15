// Morning open plan for the leverage desk (Stavros, 2026-10-15: "do a morning routine every morning M-Fri before market
// opens and come up with a thesis for the day ... improve thesis everyday so confidence improves ... go into open everyday
// with a clear strategy ... put it right at the top of lev desk"). Written by the weekday morning routine into
// lev_open_plan; the Desk Lead fills `drive` after the first 30 minutes of the US open; graded the next morning.
// Also: the $10M goal (account balances + deposits).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calcEquity } from "./equity";

export type OpenCoin = {
  coin: string;
  bias: "long" | "short" | "neutral";
  confidence?: number | null;
  price?: number | null;
  overnight_high?: number | null;
  overnight_low?: number | null;
  pdh?: number | null;
  pdl?: number | null;
  plan?: string[] | null; // the 3-line plan: Bias because / Entering when / Wrong if
  long_plan?: string | null;
  short_plan?: string | null;
};

export type DriveRow = { coin: string; move_atr?: number | null; side?: string | null; entry?: number | null; stop?: number | null; tp?: number | null; fired?: boolean; note?: string | null; r?: number | null };

export type OpenPlan = {
  plan_date: string;
  created_at: string;
  updated_at: string;
  open_at: string | null;
  red_day: boolean;
  events: string | null;
  market_bias: "long" | "short" | "neutral" | null;
  confidence: number | null;
  headline: string | null;
  thesis: string | null;
  coins: OpenCoin[];
  open_strategy: string | null;
  playbook: { name: string; status?: string; record?: string; rule?: string }[];
  no_trade_if: string | null;
  drive: DriveRow[] | null;
  drive_checked_at: string | null;
  result: { summary?: string; drive?: DriveRow[] } | null;
  bias_correct: boolean | null;
  grade: number | null;
  lesson: string | null;
  graded_at: string | null;
};

export type OpenRecord = {
  graded: number; bias_hit_pct_30d: number | null; avg_grade_30d: number | null; avg_confidence_30d: number | null;
  drive_trades: number; drive_avg_r: number | null; drive_total_r: number | null;
};

export const phxDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

export async function getOpenPlan() {
  const db = supabaseAdmin();
  const [plans, rec] = await Promise.all([
    db.from("lev_open_plan").select("*").order("plan_date", { ascending: false }).limit(6),
    db.from("v_open_plan_record").select("*").limit(1),
  ]);
  if (plans.error) throw new Error(plans.error.message);
  const list = (plans.data ?? []) as OpenPlan[];
  const today = phxDate();
  return {
    today: list.find((p) => p.plan_date === today) ?? null,
    latest: list[0] ?? null,
    recent: list.filter((p) => p.graded_at).slice(0, 5),
    record: ((rec.data ?? [])[0] ?? null) as OpenRecord | null,
  };
}

// ---------------------------------------------------------------- $10M goal
export const GOAL_USD = 10_000_000;
export const GOAL_TICKS = [1_000, 10_000, 100_000, 1_000_000, 10_000_000];

export async function getGoal() {
  const db = supabaseAdmin();
  const venues = ["blofin", "coinbase", "robinhood"] as const;
  const [snaps, flows, cfg] = await Promise.all([
    Promise.all(venues.map((v) => db.from("account_snapshots").select("equity, reported_at").eq("venue", v).order("reported_at", { ascending: false }).limit(1))),
    db.from("account_flows").select("venue, amount"),
    db.from("risk_config").select("venue, starting_equity"),
  ]);
  const by: Record<string, { equity: number; at: string | null; start: number; deposits: number; needsCheck: boolean }> = {};
  const calcs = await Promise.all(venues.map((v) => calcEquity(v)));
  venues.forEach((v, i) => {
    const s = snaps[i].data?.[0];
    const c = calcs[i];
    const start = Number(((cfg.data ?? []) as { venue: string; starting_equity: number | null }[]).find((c) => c.venue === v)?.starting_equity ?? 0);
    const deposits = ((flows.data ?? []) as { venue: string; amount: number }[]).filter((f) => f.venue === v).reduce((a, f) => a + Number(f.amount), 0);
    by[v] = { equity: c ? c.equity : s ? Number(s.equity) : 0, at: s?.reported_at ?? null, start, deposits, needsCheck: c?.needs_check ?? false };
  });
  const total = venues.reduce((a, v) => a + by[v].equity, 0);
  const pnlBlofin = by.blofin.equity - by.blofin.start - by.blofin.deposits;
  return { total, by, pnlBlofin, goal: GOAL_USD };
}

/** Position of a dollar amount on a log bar from $100 to $10M (0–100). */
export const goalPct = (usd: number) => (usd <= 100 ? 0 : Math.min(100, (Math.log10(usd / 100) / Math.log10(GOAL_USD / 100)) * 100));
