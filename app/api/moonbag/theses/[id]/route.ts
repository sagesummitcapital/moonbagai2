import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { getThesis, setThesisStatus } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

export const GET = withAgent(["claude", "grok"], async (_req, _a, { params }) => {
  const thesis = await getThesis(params.id);
  if (!thesis) return json({ ok: false, error: "Not found" }, 404);
  return json({ ok: true, thesis });
});

/** Only the status can change: expired | invalidated | cancelled. Content is immutable. */
export const PATCH = withAgent(["claude"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const status = body.status;
  if (status !== "expired" && status !== "invalidated" && status !== "cancelled") {
    throw new BadRequest('status must be "expired", "invalidated" or "cancelled". To change content, create a new version.');
  }
  const thesis = await setThesisStatus(params.id, status);
  return json({ ok: true, thesis });
});
