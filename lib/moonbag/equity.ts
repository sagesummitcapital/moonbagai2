// Calculated balances (Stavros, 2026-10-15: "anything that becomes outdated like my balance, should be a weekly check and
// then you calculate since everything goes through you"). Balance = the last balance Grok confirmed + realised P&L of every
// exit recorded since + deposits/withdrawals since. A real balance is confirmed weekly (needs_check after 7 days).
// CR-5 (2026-10-20, Stavros: "every few days I send, and it only is late if I don't send"): BloFin is confirmed Mon + Thu,
// so its balance counts as current for 4 days after a confirm; Robinhood/Coinbase keep the database's 7-day check.
import { supabaseAdmin } from "@/lib/supabase/admin";

export const CHECK_DAYS: Record<string, number> = { blofin: 4, coinbase: 7, robinhood: 7 };

export type CalcEquity = {
  venue: string;
  equity: number;
  confirmed: number;
  confirmed_at: string;
  realized_since: number;
  deposits_since: number;
  days_since_confirmed: number;
  needs_check: boolean;
};

export async function calcEquity(venue: "blofin" | "coinbase" | "robinhood"): Promise<CalcEquity | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("moonbag_calc_equity", { p_venue: venue });
    if (error || !data) return null;
    const d = data as Record<string, unknown>;
    return {
      venue,
      equity: Number(d.equity),
      confirmed: Number(d.confirmed),
      confirmed_at: String(d.confirmed_at),
      realized_since: Number(d.realized_since),
      deposits_since: Number(d.deposits_since),
      days_since_confirmed: Number(d.days_since_confirmed),
      needs_check: venue === "blofin" ? Number(d.days_since_confirmed) > CHECK_DAYS.blofin : Boolean(d.needs_check),
    };
  } catch {
    return null;
  }
}
