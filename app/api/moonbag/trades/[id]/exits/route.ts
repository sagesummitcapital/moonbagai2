import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { createTradeExit, getTrade, listTradeExits, updateTrade, EXIT_REASONS } from "@/lib/moonbag/db";
import { queueTradePost, queueTradeUpdatePost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** All exit fills recorded on a trade (partials + the final one). */
export const GET = withAgent(["claude", "grok"], async (_req, _a, { params }) => {
  const trade = await getTrade(params.id);
  if (!trade) throw new BadRequest(`Trade ${params.id} not found.`);
  return json({ ok: true, trade, exits: await listTradeExits(params.id) });
});

/**
 * Record a partial take-profit or the final close.
 * Body: { price, quantity | percent, pnl?, fee?, reason?, exited_at?, notes?, current_stop? }
 *  - percent = share of the ORIGINAL position (e.g. 25). quantity wins if both are sent.
 *  - The last fill (quantity = what is still open) closes the trade automatically:
 *    exit_price = size-weighted average, realized_pnl/fees = sums, r_multiple = total P&L ÷ risk_dollars.
 *  - current_stop (optional) moves the stop in the same call, e.g. to breakeven.
 */
export const POST = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const trade = await getTrade(params.id);
  if (!trade) throw new BadRequest(`Trade ${params.id} not found.`);
  if (trade.status !== "open") throw new BadRequest(`Trade ${params.id} is ${trade.status}, not open.`);

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) throw new BadRequest("price is required.");
  let quantity = body.quantity != null ? Number(body.quantity) : NaN;
  if (!Number.isFinite(quantity) && body.percent != null) {
    const pct = Number(body.percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new BadRequest("percent must be between 0 and 100.");
    const open = Number(trade.qty_open ?? trade.quantity);
    // percent of the original size, capped at what is still open; 8 dp is finer than any exchange step
    quantity = Math.min(open, Math.round(((Number(trade.quantity) * pct) / 100) * 1e8) / 1e8);
  }
  const reason = String(body.reason ?? "manual");
  // "TP1 filled" with no size → use the size of the TP1 order on record (or everything still open).
  if (!Number.isFinite(quantity) && /^tp[123]$/.test(reason)) {
    const open = Number(trade.qty_open ?? trade.quantity);
    const orderQty = Number((trade as unknown as Record<string, unknown>)[`current_${reason}_qty`]);
    quantity = Number.isFinite(orderQty) && orderQty > 0 ? Math.min(orderQty, open) : open;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequest("Send quantity (coin units) or percent.");
  if (!(EXIT_REASONS as readonly string[]).includes(reason)) throw new BadRequest(`reason must be one of ${EXIT_REASONS.join(", ")}.`);

  // Optional stop move first, so the update post shows the new stop.
  if (body.current_stop != null) {
    await updateTrade(params.id, { current_stop: Number(body.current_stop) } as never);
  }

  const exit = await createTradeExit({
    trade_id: params.id,
    quantity,
    price,
    pnl: body.pnl != null ? Number(body.pnl) : null,
    fee: body.fee != null ? Number(body.fee) : null,
    reason,
    exited_at: typeof body.exited_at === "string" ? body.exited_at : undefined,
    notes: typeof body.notes === "string" ? body.notes : null,
  });
  const after = (await getTrade(params.id))!;
  const x_post_id =
    exit.kind === "final" ? await queueTradePost(after, "trade_close") : await queueTradeUpdatePost(after, exit, exit.exit_id);
  return json({ ok: true, exit, trade: after, x_post_id });
});
