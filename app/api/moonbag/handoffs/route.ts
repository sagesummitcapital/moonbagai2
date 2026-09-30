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
  requireFields(body, ["thesis_id", "symbol", "direction"]);
  const handoff = await createHandoff(
    pick(body, [
      "thesis_id", "symbol", "direction", "destination", "broker", "entry_condition", "invalidation",
      "target_framework", "time_horizon", "setup_score", "system_confidence", "position_guidance",
      "conditions_to_cancel", "expires_at",
    ]) as never
  );
  return json({ ok: true, handoff }, 201);
});
