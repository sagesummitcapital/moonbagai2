import { supabaseAdmin } from "@/lib/supabase/admin";

/** Daily realized P&L by Phoenix day and venue (v_daily_pnl) — Stavros 2026-11-01: month calendar, green +$ / red −$ days. */
export type PnlDay = { venue: string; day: string; pnl_usd: number; trades: number };

export async function getPnlDays(months = 13): Promise<PnlDay[]> {
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);
  const r = await supabaseAdmin().from("v_daily_pnl").select("venue, day, pnl_usd, trades").gte("day", from.toISOString().slice(0, 10)).order("day");
  if (r.error) return [];
  return ((r.data ?? []) as PnlDay[]).map((d) => ({ ...d, pnl_usd: Number(d.pnl_usd), trades: Number(d.trades) }));
}
