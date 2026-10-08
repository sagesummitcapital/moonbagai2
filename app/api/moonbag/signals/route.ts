import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { signalLabel, type LevSignal } from "@/lib/moonbag/desk";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Desk history for audits: every leverage signal (with its label and outcome), paper trades,
 * 24-hour lookbacks and recent backtests. GET /signals?days=14&asset=BTC
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 14) || 14));
  const asset = url.searchParams.get("asset")?.toUpperCase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const db = supabaseAdmin();

  let sq = db.from("lev_signals").select("*").gte("created_at", since).order("created_at", { ascending: false });
  if (asset) sq = sq.eq("asset", asset);
  const [signals, paper, lookbacks, backtests, strategy] = await Promise.all([
    sq,
    db.from("paper_trades").select("*").gte("opened_at", since).order("opened_at", { ascending: false }),
    db.from("trade_lookbacks").select("*").gte("created_at", since).order("created_at", { ascending: false }),
    db.from("backtests").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    db.from("lev_strategy").select("version, title, summary, rules, confidence_model, change_reason, created_at").eq("status", "active").limit(1),
  ]);
  for (const r of [signals, paper, lookbacks, backtests, strategy]) if (r.error) throw new Error(r.error.message);

  const rows = ((signals.data ?? []) as LevSignal[]).map((s: LevSignal) => ({ ...s, label: signalLabel(s) }));
  const resolved = rows.filter((s: LevSignal & { label: string }) => ["tp1", "stop", "timeout"].includes(s.outcome ?? ""));
  return json({
    ok: true,
    days,
    strategy: strategy.data?.[0] ?? null,
    summary: {
      signals: rows.length,
      desk_alerts: rows.filter((s: { label: string }) => s.label === "DESK ALERT").length,
      resolved: resolved.length,
      total_r: Math.round(resolved.reduce((a: number, s: LevSignal) => a + Number(s.outcome_r ?? 0), 0) * 100) / 100,
    },
    signals: rows,
    paper_trades: paper.data ?? [],
    lookbacks: lookbacks.data ?? [],
    backtests: backtests.data ?? [],
  });
});
