import { supabaseAdmin } from "@/lib/supabase/admin";

/** Command view data (layered flow, Stavros 2026-11-01): environment chips, today's P&L, the month, discipline. Read-only. */
export type Discipline = {
  trades: number; total_r: number;
  off_plan: { n: number; r: number; on_plan_n: number; on_plan_r: number };
  away_from_level: { n: number; r: number; at_level_n: number; at_level_r: number; unknown: number };
  overnight: { n: number; r: number; day_n: number; day_r: number };
  per_day: { days: number; avg: number | null; max: number | null; r_by_count: Record<string, number> | null };
};
export type CommandData = {
  gauge: { day: string; score: number; zone: string; components: { name: string; value: number; weight: number }[] } | null;
  redFolder: { red: boolean; events: string | null } | null;
  weekend: boolean;
  todayPnl: number; todayTrades: number;
  monthPnl: number; greenDays: number; redDays: number;
  discipline: Discipline | null;
  phxToday: string;
};

const phxDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

export async function getCommandData(): Promise<CommandData> {
  const db = supabaseAdmin();
  const today = phxDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  // Phoenix is UTC-7 all year
  const monthStartUtc = new Date(`${monthStart}T07:00:00Z`).toISOString();
  const [g, econ, pnl, disc, wk] = await Promise.all([
    db.from("retail_gauge").select("day, score, zone, components").order("day", { ascending: false }).limit(1).maybeSingle(),
    db.from("econ_days").select("red, events").eq("day", today).maybeSingle(),
    db.from("v_daily_pnl").select("day, pnl_usd, trades").eq("venue", "blofin").gte("day", monthStart),
    db.rpc("mb_discipline_summary", { p_from: monthStartUtc, p_to: new Date(Date.now() + 86400_000).toISOString() }),
    db.rpc("mb_weekend_overlap", { p_from: new Date().toISOString(), p_to: new Date(Date.now() + 60_000).toISOString() }),
  ]);
  const days = ((pnl.data ?? []) as { day: string; pnl_usd: number; trades: number }[]).map((d) => ({ ...d, pnl_usd: Number(d.pnl_usd) }));
  const t = days.find((d) => d.day === today);
  return {
    gauge: (g.data as CommandData["gauge"]) ?? null,
    redFolder: (econ.data as CommandData["redFolder"]) ?? null,
    weekend: Boolean(wk.data),
    todayPnl: t?.pnl_usd ?? 0,
    todayTrades: Number(t?.trades ?? 0),
    monthPnl: days.reduce((a, d) => a + d.pnl_usd, 0),
    greenDays: days.filter((d) => d.pnl_usd > 0).length,
    redDays: days.filter((d) => d.pnl_usd < 0).length,
    discipline: (disc.data as Discipline) ?? null,
    phxToday: today,
  };
}
