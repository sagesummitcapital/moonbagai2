import { withAgent, json, readJson, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { getTrade, updateTrade, TRADE_WRITABLE_FIELDS } from "@/lib/moonbag/db";
import { queueTradePost, queueTradeUpdatePost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** Open / manage / close a trade. Plan fields are write-once (enforced by the DB). */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const needBefore = body.current_stop != null || ["1", "2", "3"].some((n) => body[`current_tp${n}_pct`] != null);
  const before = needBefore ? await getTrade(params.id) : null;
  const patch = pick(body, TRADE_WRITABLE_FIELDS) as Record<string, unknown>;
  // A partial target, e.g. "50% TP at 83,780": current_tp1 = 83780, current_tp1_pct = 50
  // → stored as coin units of what is still open, so the alerts and the close math use the real size.
  for (const n of ["1", "2", "3"]) {
    const pct = body[`current_tp${n}_pct`];
    if (pct == null || !before) continue;
    const p = Number(pct);
    if (!Number.isFinite(p) || p <= 0 || p > 100) throw new BadRequest(`current_tp${n}_pct must be between 0 and 100.`);
    const open = Number(before.qty_open ?? before.quantity);
    patch[`current_tp${n}_qty`] = p >= 100 ? null : Math.floor(open * p * 1e6) / 1e8;
  }
  const trade = await updateTrade(params.id, patch as never);
  // Opening a pending trade or closing one queues the matching X post for Grok.
  let x_post_id: string | null = null;
  if (trade.venue === "blofin" && body.status === "open") x_post_id = await queueTradePost(trade, "trade_open");
  if (trade.venue === "blofin" && body.status === "closed") x_post_id = await queueTradePost(trade, "trade_close");
  // Stop moved to breakeven or into profit on an open BloFin trade → one "trade update" post per new stop.
  if (!x_post_id && before && trade.venue === "blofin" && trade.status === "open" && Number(before.current_stop) !== Number(trade.current_stop)) {
    const s = Number(trade.current_stop), e = Number(trade.entry);
    const lockedIn = trade.direction === "short" ? s <= e : s >= e;
    if (lockedIn) x_post_id = await queueTradeUpdatePost(trade, null, `${trade.trade_id}-stop-${s}`);
  }
  return json({ ok: true, trade, x_post_id });
});
