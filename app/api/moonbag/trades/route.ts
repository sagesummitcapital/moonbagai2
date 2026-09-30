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

/** Record an execution. Grok: Robinhood fills. Claude: BloFin manual trades you report. */
export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["thesis_id", "venue", "symbol", "direction"]);
  if (agent === "grok" && body.venue !== "robinhood") {
    throw new BadRequest("Grok can only record Robinhood trades.");
  }
  const trade = await createTrade({
    ...pick(body, ["thesis_id", "handoff_id", "venue", "execution", "symbol", "direction"]),
    ...pick(body, TRADE_WRITABLE_FIELDS),
    ...(agent === "grok" ? { execution: "grokbot" } : {}),
  } as never);
  return json({ ok: true, trade }, 201);
});
