import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { getTrade, updateTrade, TRADE_WRITABLE_FIELDS } from "@/lib/moonbag/db";
import { queueTradePost, queueTradeUpdatePost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** Open / manage / close a trade. Plan fields are write-once (enforced by the DB). */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const before = body.current_stop != null ? await getTrade(params.id) : null;
  const trade = await updateTrade(params.id, pick(body, TRADE_WRITABLE_FIELDS) as never);
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
