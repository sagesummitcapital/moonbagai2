import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { updateAlert } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** Link the TradingView id, mark triggered, or cancel a stale alert. */
export const PATCH = withAgent(["claude"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const alert = await updateAlert(params.id, pick(body, ["status", "status_reason", "tv_alert_id", "triggered_at"]));
  return json({ ok: true, alert });
});
