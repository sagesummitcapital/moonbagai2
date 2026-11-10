import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * STAVROS'S RULES + GROK'S CRITIQUE STRUCTURES (CR-64, Stavros 2026-11-09 in Cowork).
 * "my simple rules are 2% max daily drawdown, .5% - 2% per trade, 1:2 risk ratio, 50% win rate, I am not excluding a high risk trade of
 * 10% with high conviction, sometimes 1:1 ... for prop firm it is similar but never 10% risk, i strictly follow rules of firm."
 * "grok should also have a set structure for critiquing questions on potential trades and active trades".
 * One place for the text, so the site, the API and Grok all say the same thing. The numbers come live from mb_trader_numbers().
 */
export const RULES = [
  "BLOFIN — risk 0.5% to 2% per trade (his call). Max daily drawdown 2%: at −2% he is done for the day. Aim 1 : 2; 1 : 1 sometimes. Target 50%+ wins.",
  "High-conviction exception: up to 10% risk, only when he says so at entry. It still needs a stop.",
  "Cross margin. His style: get in, secure profit, move the stop up.",
  "PROP (Breakout) — 0.5% to 1% per trade. The firm's rules are hard. Never the 10% exception.",
  "He places every order. Moonbag and Grok size, warn and log.",
] as const;

export const POTENTIAL_TRADE = [
  "POTENTIAL TRADE — answer in this order, 6 short lines at most:",
  "1. VERDICT first: TAKE / WAIT FOR TRIGGER / SKIP, with the one reason.",
  "2. LEVEL: is the entry at a mapped level (range edge, swept high/low, yesterday's high/low, his own stated level) or mid-range? Mid-range with no trigger = SKIP.",
  "3. TRIGGER: sweep + close back inside, retest that holds, or a breakout close. Say which one is there, or that none is yet.",
  "4. PAYOFF: R to the first real level in the way. 2R+ good; 1–2R only if he says it's a 1 : 1 trade; under 1R skip.",
  "5. SIZE: dollars at 0.5% / 1% / 2%, what is left of today's 2% (after today's losses), trades today. Two losses today = done.",
  "6. FLAGS, one line: with or against BTC's 4h trend, big-news window, weekend, and for prop the coin's leverage cap, room today and any BloFin position the other way.",
  "Always end with the price that proves the idea wrong.",
] as const;

export const ACTIVE_TRADE = [
  "ACTIVE TRADE (\"move the stop / take profit here / let it ride?\") — reply as: HOLD / TRIM x% / MOVE STOP to <price> / CLOSE, one reason, the numbers.",
  "1. Where it is: R now, distance to the stop, to TP1 and to the next level against it.",
  "2. Under +1R: leave the stop. Close early only if the reason for the trade is gone (name it), not because of a wobble.",
  "3. At +1R: secure it one way, not both — stop to entry, or take half.",
  "4. Stalling at a level before the target (his own opposite zone, a prior high/low): take 50–70% there, stop to entry, let the rest run. If it closes 15m through the level, keep it all.",
  "5. At TP1 (2R): take 70%, stop to entry, trail the rest behind the last 1h swing.",
  "6. No progress: under +0.5R after 4 hours, reassess; if the trigger failed, close.",
  "7. Never: add to a loser, widen the stop, or move the stop to entry before +1R.",
] as const;

export type TraderNumbers = Record<string, unknown>;

export async function getTraderNumbers(): Promise<TraderNumbers | null> {
  const r = await supabaseAdmin().rpc("mb_trader_numbers");
  return r.error ? null : ((r.data as TraderNumbers) ?? null);
}

/** His own record in plain lines — why the structures above say what they say. */
export function numberLines(n: TraderNumbers | null): string[] {
  if (!n) return [];
  const v = (k: string) => (n[k] == null ? null : Number(n[k]));
  const o = (k: string) => (n[k] ?? {}) as Record<string, unknown>;
  const sg = (x: unknown) => (x == null ? "—" : `${Number(x) > 0 ? "+" : ""}${Number(x).toFixed(2)}R`);
  const rv = o("reviews_72h"), l20 = o("last20"), lo = o("longs"), sh = o("shorts"), u1 = o("under_1h"), o1 = o("over_1h");
  return [
    `${v("trades")} BloFin trades: ${v("win_pct")}% won, average win ${sg(n.avg_win_r)}, average loss ${sg(n.avg_loss_r)} → ${sg(n.expectancy_r)} per trade. At that payoff he needs ${v("breakeven_win_pct")}% wins to break even.`,
    `${v("wins_under_half_r")} of ${v("wins")} wins were closed under +0.5R; ${v("wins_2r_plus")} reached 2R. ${v("full_stop_losses")} of ${v("losses")} losses were full stops.`,
    `Last 20: ${l20.win_pct ?? "—"}% won, ${sg(l20.expectancy_r)} per trade (wins ${sg(l20.avg_win_r)}, losses ${sg(l20.avg_loss_r)}).`,
    `72-hour reviews (${rv.n ?? 0}): ${rv.exited_early ?? 0} exited early (took ${sg(rv.exited_early_took_r)}, the plan paid ${sg(rv.exited_early_plan_r)}); ${rv.entry_poor_or_skip ?? 0} were poor entries or should have been skipped; ${rv.losers_never_up_03r ?? 0} losers never got to +0.3R, ${rv.losers_up_1r_first ?? 0} were up 1R first.`,
    `Longs ${lo.n ?? 0} trades ${sg(lo.avg_r)} · shorts ${sh.n ?? 0} trades ${sg(sh.avg_r)} · held under 1 hour ${u1.n ?? 0} trades ${sg(u1.avg_r)} · over 1 hour ${o1.n ?? 0} trades ${sg(o1.avg_r)}.`,
  ];
}

export function playbookText(n: TraderNumbers | null) {
  return ["STAVROS'S RULES", ...RULES.map((x) => `- ${x}`), "", ...POTENTIAL_TRADE, "", ...ACTIVE_TRADE, "", "HIS NUMBERS (live)", ...numberLines(n).map((x) => `- ${x}`)].join("\n");
}
