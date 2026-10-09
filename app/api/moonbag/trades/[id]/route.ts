import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { updateTrade, TRADE_WRITABLE_FIELDS } from "@/lib/moonbag/db";
import { queueTradePost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** Open / manage / close a trade. Plan fields are write-once (enforced by the DB). */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const trade = await updateTrade(params.id, pick(body, TRADE_WRITABLE_FIELDS) as never);
  // Opening a pending trade or closing one queues the matching X post for Grok.
  let x_post_id: string | null = null;
  if (trade.venue === "blofin" && body.status === "open") x_post_id = await queueTradePost(trade, "trade_open");
  if (trade.venue === "blofin" && body.status === "closed") x_post_id = await queueTradePost(trade, "trade_close");
  return json({ ok: true, trade, x_post_id });
});
