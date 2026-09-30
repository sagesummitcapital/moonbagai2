import { withAgent, json, readJson, BadRequest, pick } from "@/lib/moonbag/apiAuth";
import { respondToHandoff } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

const GROK_STATUSES = ["acknowledged", "executed", "rejected"];

/** Grok responds: acknowledged | executed | rejected (+ optional status_reason, grok_response). */
export const PATCH = withAgent(["grok", "claude"], async (req, agent, { params }) => {
  const body = await readJson(req);
  if (agent === "grok" && typeof body.status === "string" && !GROK_STATUSES.includes(body.status)) {
    throw new BadRequest(`Grok may set status to: ${GROK_STATUSES.join(", ")}`);
  }
  const handoff = await respondToHandoff(params.id, pick(body, ["status", "status_reason", "grok_response"]));
  return json({ ok: true, handoff });
});
