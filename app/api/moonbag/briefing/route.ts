import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { buildBriefing } from "@/lib/moonbag/briefing";

export const dynamic = "force-dynamic";

/**
 * The single canonical briefing. Any agent asked for a "daily summary" or
 * "what are we looking at today?" relays `text` word for word.
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const b = await buildBriefing();
  return json({ ok: true, ...b });
});
