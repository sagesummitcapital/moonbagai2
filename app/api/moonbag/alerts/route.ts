import { withAgent, json, readJson, requireFields, pick } from "@/lib/moonbag/apiAuth";
import { createAlert, listAlerts } from "@/lib/moonbag/db";
import type { AlertStatus } from "@/lib/moonbag/types";

export const dynamic = "force-dynamic";

export const GET = withAgent(["claude", "grok"], async (req) => {
  const status = (new URL(req.url).searchParams.get("status") as AlertStatus) ?? undefined;
  return json({ ok: true, alerts: await listAlerts(status) });
});

/** Record a TradingView alert against an ACTIVE thesis. */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  requireFields(body, ["thesis_id", "asset", "condition"]);
  const alert = await createAlert(
    pick(body, ["thesis_id", "asset", "condition", "tv_alert_id", "tv_symbol", "trigger_price", "direction", "action", "message"]) as never
  );
  return json({ ok: true, alert }, 201);
});
