import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * EDGE HEALTH (CR-50, Stavros 2026-11-01: "the edge has to be the ability to refine ... one thing that's working and another thing
 * ready lined up"). Every strategy has a stage (live / on_deck / lab / benchmark) and a kill line. For live and benchmark books:
 * n, expectancy, last-20 / last-40, win %, max drawdown vs the backtest's out-of-sample number → ok / drifting / pause + review /
 * graveyard (CR-42) / too few to judge (< 20). Lab entries show their lab label. Flags only — nothing with real money auto-pauses;
 * any stage change needs Stavros's OK (promotion rule in strategy_rules 'promotion').
 * GET → { text, roster, rules }
 */
type H = { strategy_key: string; name: string; stage: string; n: number; expectancy_r: number | null; last20_r: number | null; win20_pct: number | null; max_dd_r: number | null; backtest_oos_r: number | null; lab_oos_r: number | null; state: string };

export const GET = withAgent(["claude", "grok"], async () => {
  const db = supabaseAdmin();
  const [h, rules] = await Promise.all([
    db.from("v_edge_health").select("*"),
    db.from("strategy_rules").select("rule_id, rule").in("rule_id", ["retirement", "promotion"]),
  ]);
  if (h.error) throw new BadRequest(h.error.message);
  const rows = (h.data ?? []) as H[];
  const r = (v: number | null) => (v == null ? "—" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}R`);
  const line = (x: H) =>
    x.stage === "lab" || x.stage === "on_deck"
      ? `  ${x.name} — ${x.state}${x.lab_oos_r != null ? ` · OOS ${r(x.lab_oos_r)} · ${x.n} backtest trades` : ""}`
      : `  ${x.name} — ${x.state} · ${x.n} trades · avg ${r(x.expectancy_r)} · last 20 ${r(x.last20_r)}${x.win20_pct != null ? ` (${x.win20_pct}% win)` : ""} · max DD ${x.max_dd_r ?? "—"}R${x.backtest_oos_r != null ? ` · backtest OOS ${r(x.backtest_oos_r)}` : ""}`;
  const group = (s: string, title: string) => {
    const g = rows.filter((x) => x.stage === s);
    return g.length ? [title, ...g.map(line)] : [];
  };
  const text = ["EDGE HEALTH", ...group("live", "LIVE (alerts he can trade)"), ...group("benchmark", "BENCHMARK"), ...group("on_deck", "ON DECK"), ...group("lab", "LAB"),
    "Flags only — any stage change needs Stavros's OK."].join("\n");
  return json({ ok: true, text, roster: rows, rules: rules.data ?? [] });
});
