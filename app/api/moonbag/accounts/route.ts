import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { createAccountSnapshot, latestAccountSnapshot } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** Latest account snapshot per venue. */
export const GET = withAgent(["claude", "grok"], async () => {
  const [robinhood, blofin] = await Promise.all([
    latestAccountSnapshot("robinhood"),
    latestAccountSnapshot("blofin"),
  ]);
  return json({ ok: true, robinhood, blofin });
});

/** Grok posts the Robinhood account state (equity, cash, positions) — required before new positions are sized. */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["venue", "equity"]);
  if (body.venue !== "robinhood" && body.venue !== "blofin") throw new BadRequest('venue must be "robinhood" or "blofin"');
  const snapshot = await createAccountSnapshot({
    venue: body.venue,
    equity: Number(body.equity),
    cash: body.cash == null ? null : Number(body.cash),
    buying_power: body.buying_power == null ? null : Number(body.buying_power),
    positions: Array.isArray(body.positions) ? body.positions : [],
    reported_by: agent,
  });
  return json({ ok: true, snapshot }, 201);
});
