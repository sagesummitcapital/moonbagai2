// Calculated balances (Stavros, 2026-10-15: "anything that becomes outdated like my balance, should be a weekly check and
// then you calculate since everything goes through you"). Balance = the last balance Grok confirmed + realised P&L of every
// exit recorded since + deposits/withdrawals since. A real balance is confirmed weekly (needs_check after 7 days).
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      needs_check: Boolean(d.needs_check),
    };
  } catch {
    return null;
  }
}
