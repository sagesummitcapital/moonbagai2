import { withAgent, json, readJson, requireFields, pick } from "@/lib/moonbag/apiAuth";
import { createHandoff, listHandoffs } from "@/lib/moonbag/db";
import type { HandoffStatus } from "@/lib/moonbag/types";

export const dynamic = "force-dynamic";

/** Grok polls this:  GET /api/moonbag/handoffs?status=pending */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const status = (new URL(req.url).searchParams.get("status") as HandoffStatus) ?? undefined;
  return json({ ok: true, handoffs: await listHandoffs(status) });
});

export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  if ((body.action ?? "open") === "open") requireFields(body, ["thesis_id", "symbol", "direction"]);
  else requireFields(body, ["action", "trade_id"]);
  const handoff = await createHandoff(
    pick(body, [
      "thesis_id", "symbol", "direction", "destination", "broker", "entry_condition", "invalidation",
      "target_framework", "time_horizon", "setup_score", "system_confidence", "position_guidance",
      "conditions_to_cancel", "expires_at",
      // executable order fields (risk-checked by the database)
      "action", "trade_id", "order_type", "limit_price", "reference_price", "stop_price",
      "target_1", "target_2", "quantity", "setup_type", "horizon", "max_hold_days", "sleeve", "theme",
    ]) as never
  );
  return json({ ok: true, handoff }, 201);
});
