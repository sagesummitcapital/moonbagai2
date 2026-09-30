import { withAgent, json, readJson, requireFields, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { createTrade, listTrades, TRADE_WRITABLE_FIELDS } from "@/lib/moonbag/db";
import type { TradeStatus } from "@/lib/moonbag/types";

export const dynamic = "force-dynamic";

export const GET = withAgent(["claude", "grok"], async (req) => {
  const p = new URL(req.url).searchParams;
  const trades = await listTrades({
    status: (p.get("status") as TradeStatus) ?? undefined,
    venue: p.get("venue") ?? undefined,
  });
  return json({ ok: true, trades });
});

/**
 * Record an execution.
 * Grok: Robinhood fills it executes (execution "grokbot") AND BloFin leveraged
 * trades Stavros tells it he took manually (execution "manual").
 */
export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["thesis_id", "venue", "symbol", "direction"]);
  if (agent === "grok" && body.venue !== "robinhood" && body.venue !== "blofin") {
    throw new BadRequest("Grok can record Robinhood or BloFin trades.");
  }
  const execution =
    agent === "grok" ? (body.venue === "blofin" ? "manual" : "grokbot") : body.execution;
  const trade = await createTrade({
    ...pick(body, ["thesis_id", "handoff_id", "venue", "symbol", "direction"]),
    ...pick(body, TRADE_WRITABLE_FIELDS),
    ...(execution ? { execution } : {}),
  } as never);
  return json({ ok: true, trade }, 201);
});
