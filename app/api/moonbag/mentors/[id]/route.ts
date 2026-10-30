import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * CALLER CALL AS A TRADE (CR-24, approved 2026-10-30). PATCH /mentors/<call_id> with the call's trade details; Moonbag then grades it
 * on BloFin candles every night (entry touched within 48h → stop or first target first; untouched → no_fill) and marks whether
 * Moonbag had caught the same setup beforehand. Fields: side (long|short), timeframe, trigger (sweep_reclaim|break_retest|retrace_075|other),
 * zone_lo, zone_hi, entry, stop, targets (array of prices), risk_pct, management, origin_lane (follow|fade|ignore), status
 * (open|invalidated → sets trade_status).
 */
const NUM = ["zone_lo", "zone_hi", "entry", "stop", "risk_pct"] as const;
const TXT = ["timeframe", "management"] as const;

export const PATCH = withAgent(["grok", "claude"], async (req, agent, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest("call id must be a number");
  const b = await readJson(req);
  const patch: Record<string, unknown> = { graded_by: agent };
  if (b.side != null) { const s = String(b.side); if (s !== "long" && s !== "short") throw new BadRequest('side must be "long" or "short"'); patch.side = s; }
  if (b.trigger != null) { const t = String(b.trigger); if (!["sweep_reclaim", "break_retest", "retrace_075", "other"].includes(t)) throw new BadRequest("trigger must be sweep_reclaim | break_retest | retrace_075 | other"); patch.trigger = t; }
  if (b.origin_lane != null) { const o = String(b.origin_lane); if (!["follow", "fade", "ignore"].includes(o)) throw new BadRequest("origin_lane must be follow | fade | ignore"); patch.origin_lane = o; }
  if (b.status != null) { const st = String(b.status); if (st !== "open" && st !== "invalidated") throw new BadRequest('status must be "open" or "invalidated"'); patch.trade_status = st; }
  for (const f of NUM) if (b[f] != null) { const v = Number(b[f]); if (!Number.isFinite(v)) throw new BadRequest(`${f} must be a number`); patch[f] = v; }
  for (const f of TXT) if (b[f] != null) patch[f] = String(b[f]).slice(0, 1000);
  if (b.targets != null) { if (!Array.isArray(b.targets) || !b.targets.every((x: unknown) => Number.isFinite(Number(x)))) throw new BadRequest("targets must be an array of prices"); patch.targets = b.targets.map(Number); }
  if (Object.keys(patch).length <= 1) throw new BadRequest("nothing to update");
  const u = await supabaseAdmin().from("mentor_calls").update(patch).eq("call_id", id).select("call_id, mentor, asset, side, entry, stop, targets, trade_status").single();
  if (u.error) throw new BadRequest(u.error.message);
  return json({ ok: true, call: u.data });
});
