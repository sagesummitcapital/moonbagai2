import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * BACKTEST RESULTS (CR-27, approved 2026-10-30) — stored in lab_backtests (the Automation Lab's results table, CR-23).
 * POST {strategy_id, family, variant_id?, params?, universe?, period_start?, period_end?, n_trades, win_rate?, expectancy_r, profit_factor?,
 *       total_r?, max_dd_r?, is_stats?, oos_stats?, pass, fail_reasons?, decision_informed?, kill_date?, code_ref?, notes?}
 *      CR-36 (11/1): also send baseline_inputs {tf, stop_pct (e.g. 0.8 for 0.8%), long_share (0–1), target_r?, hold_bars?} — or put them in
 *      params.baseline_inputs. The database then adds buy-and-hold, random-entry (200 seeds) and 20/50 EMA baselines on the same coins,
 *      period and costs (filled Saturday 11:30 PM–2:30 AM Phoenix) and labels the result: "no edge shown" if it can't beat the random median.
 * GET  ?family=…&pass=true|false → newest first (max 200), with baselines, beats_baselines and edge_label.
 */
const NUM = ["n_trades", "win_rate", "expectancy_r", "profit_factor", "total_r", "max_dd_r", "is_expectancy_r", "oos_expectancy_r"] as const;

export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const b = await readJson(req);
  requireFields(b, ["strategy_id", "family", "n_trades", "expectancy_r", "pass"]);
  const row: Record<string, unknown> = {
    strategy_id: String(b.strategy_id).slice(0, 100), family: String(b.family).slice(0, 100),
    variant_id: b.variant_id == null ? null : String(b.variant_id).slice(0, 100), version: b.version == null ? 1 : Number(b.version),
    params: b.baseline_inputs ? { ...((b.params as Record<string, unknown>) ?? {}), baseline_inputs: b.baseline_inputs } : (b.params ?? null), universe: Array.isArray(b.universe) ? b.universe.map(String) : null,
    period_start: b.period_start ?? null, period_end: b.period_end ?? null,
    is_stats: b.is_stats ?? null, oos_stats: b.oos_stats ?? null, pass: Boolean(b.pass),
    fail_reasons: Array.isArray(b.fail_reasons) ? b.fail_reasons.map(String) : null,
    decision_informed: b.decision_informed == null ? null : String(b.decision_informed).slice(0, 2000),
    kill_date: b.kill_date ?? null, code_ref: b.code_ref == null ? null : String(b.code_ref).slice(0, 500),
    notes: b.notes == null ? null : String(b.notes).slice(0, 4000), submitted_by: agent,
  };
  for (const f of NUM) if (b[f] != null) { const v = Number(b[f]); if (!Number.isFinite(v)) throw new BadRequest(`${f} must be a number`); row[f] = v; }
  const ins = await supabaseAdmin().from("lab_backtests").insert(row).select("run_id, strategy_id, family, pass, params").single();
  if (ins.error) throw new BadRequest(ins.error.message);
  const bi = (ins.data?.params as { baseline_inputs?: unknown } | null)?.baseline_inputs;
  return json({ ok: true, result: { run_id: ins.data.run_id, strategy_id: ins.data.strategy_id, family: ins.data.family, pass: ins.data.pass },
    baselines: bi ? "queued — filled Saturday 11:30 PM–2:30 AM Phoenix" : "missing baseline_inputs {tf, stop_pct, long_share} — send them so this result can be compared with the baselines" }, 201);
});

export const GET = withAgent(["grok", "claude"], async (req) => {
  const q = new URL(req.url).searchParams;
  let s = supabaseAdmin().from("lab_backtests").select("*").order("run_id", { ascending: false }).limit(200);
  const fam = q.get("family");
  if (fam) s = s.eq("family", fam);
  const pass = q.get("pass");
  if (pass === "true" || pass === "false") s = s.eq("pass", pass === "true");
  const r = await s;
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, results: r.data ?? [] });
});
