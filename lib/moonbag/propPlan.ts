import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * PROP PLAN (CR-73, Stavros 2026-11-12 in Cowork): the prop book must be impossible to blow by accident.
 * Rules (prop_plan_rules): risk = min($100, room to the floor / 5, room to the -$150 day stop, firm daily room - $100), rounded down to $5,
 * never bigger after a loss, half on red-folder days · max 2 new trades a day · 2 losses = done until 5:30 PM Phoenix · day stop -$150 ·
 * no entries 6 PM–5 AM Phoenix · 30 min after a loss · BTC/ETH/SOL same side = one position · firm leverage cap · stop ≥ 0.1% · no opposite BloFin position.
 * The database does the math (mb_prop_plan_state / mb_prop_check) so the page, Grok and any other caller see the same answer.
 */
export type PlanState = {
  account_id: string; status: "OPEN" | "LOCKED" | "STALE"; snapshot_at?: string | null; locks: string[]; allowed_risk: number; trades_today: number; trades_left: number;
  losses_today: number; losses_left: number; pnl_today: number; open_risk: number; room_to_day_stop: number; room_to_firm_daily: number;
  room_to_floor: number; to_target: number | null; equity: number | null; red_day: boolean; day_start: string;
  rules: { risk_cap: number; day_stop: number; max_trades: number; max_losses: number; cooloff_min: number };
};
export type PlanCheck = { verdict: "PASS" | "BLOCK"; reasons: string[]; warnings?: string[]; risk_with_fees: number | null; allowed_risk: number; max_qty: number | null; max_leverage: number | null; state: PlanState };

export async function getPlanState(accountId: string): Promise<PlanState> {
  const r = await supabaseAdmin().rpc("mb_prop_plan_state", { p_account: accountId });
  if (r.error) throw new Error(r.error.message);
  return r.data as PlanState;
}

export async function checkPropTrade(a: { account: string; coin: string; side: string; entry: number; stop: number | null; qty?: number | null; leverage?: number | null; grade?: string | null }): Promise<PlanCheck> {
  const r = await supabaseAdmin().rpc("mb_prop_check", {
    p_account: a.account, p_coin: a.coin, p_side: a.side, p_entry: a.entry, p_stop: a.stop, p_qty: a.qty ?? null, p_leverage: a.leverage ?? null, p_grade: a.grade ?? null,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data as PlanCheck;
}

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/** One block of text Grok relays word for word. */
export function checkText(c: PlanCheck, coin: string, side: string) {
  const s = c.state;
  const head = c.verdict === "PASS"
    ? `PROP CHECK — ${coin} ${side}: PASS. Risk allowed now ${usd(c.allowed_risk)}${c.max_qty != null ? ` → max size ${c.max_qty} ${coin}` : " — no size allowed"}${c.max_leverage ? ` at up to ${c.max_leverage}x` : ""}.${c.warnings?.length ? ` Note: ${c.warnings.join("; ")}.` : ""}`
    : `PROP CHECK — ${coin} ${side}: BLOCKED. ${c.reasons.join("; ")}.${c.warnings?.length ? ` Note: ${c.warnings.join("; ")}.` : ""}`;
  return [
    head,
    `Today: ${s.trades_today}/${s.rules.max_trades} trades, ${s.losses_today}/${s.rules.max_losses} losses, P&L ${s.pnl_today >= 0 ? "+" : ""}${s.pnl_today}. Room: ${usd(s.room_to_day_stop)} to the day stop, ${usd(s.room_to_firm_daily)} to the firm's daily limit, ${usd(s.room_to_floor)} to the floor (after open risk ${usd(s.open_risk)}).`,
    "He places every order. This is the plan he set on 11/12, not advice.",
  ].join("\n");
}
