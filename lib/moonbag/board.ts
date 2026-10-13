// Trading-hours board (Stavros, 2026-10-12). Read-only view of lev_board (refreshed hourly 5 AM–3 PM Phoenix on weekdays
// by the Desk Lead via lev_board_refresh()) plus the week plan written every Monday by the daily cycle.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BoardPlan = {
  edge: number; entry: number; stop: number; tp1: number | null; rr: number | null; grade: string;
  dist_pct: number; near: boolean; stop_pct: number; order: "limit" | "market"; note: string;
};
export type BoardRow = {
  asset: string; updated_at: string; last_bar: string | null; tier: "core" | "mover" | "off"; rank: number | null;
  price: number | null; change_24h: number | null; atr_1h: number | null; atr_1d: number | null; ema50_1d: number | null;
  trend: "up" | "down" | null; cooling: boolean; range_low: number | null; range_high: number | null; range_source: string | null;
  long_plan: BoardPlan | null; short_plan: BoardPlan | null; best_side: "long" | "short" | null; best_grade: string | null; near: boolean;
};
export type WeekPlan = { report_date: string; title: string; markdown: string } | null;

export async function getBoard() {
  const db = supabaseAdmin();
  const [rows, plan] = await Promise.all([
    db.from("lev_board").select("*").neq("tier", "off"),
    db.from("daily_reports").select("report_date,title,markdown").like("title", "MOONBAG WEEK PLAN%").order("report_date", { ascending: false }).limit(1),
  ]);
  if (rows.error) throw new Error(rows.error.message);
  const order = (r: BoardRow) => (r.tier === "core" ? ["BTC", "ETH", "SOL"].indexOf(r.asset) : 10 + Number(r.rank ?? 9));
  const all = ((rows.data ?? []) as BoardRow[]).sort((a, b) => order(a) - order(b));
  return { core: all.filter((r) => r.tier === "core"), movers: all.filter((r) => r.tier === "mover"), weekPlan: ((plan.data ?? [])[0] ?? null) as WeekPlan };
}

/** Phoenix trading window: weekdays 5 AM – 3 PM (UTC-7, no DST). */
export function tradingWindow(now = new Date()) {
  const phx = new Date(now.getTime() - 7 * 3600_000);
  const dow = phx.getUTCDay(); const h = phx.getUTCHours();
  return { open: dow >= 1 && dow <= 5 && h >= 5 && h < 15, monday: dow === 1, weekday: dow >= 1 && dow <= 5 };
}
