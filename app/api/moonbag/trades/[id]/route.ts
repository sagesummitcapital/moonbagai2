import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { updateTrade, TRADE_WRITABLE_FIELDS } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** Open / manage / close a trade. Plan fields are write-once (enforced by the DB). */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const trade = await updateTrade(params.id, pick(body, TRADE_WRITABLE_FIELDS) as never);
  return json({ ok: true, trade });
});
