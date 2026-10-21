import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { buildFocus } from "@/lib/moonbag/focus";

export const dynamic = "force-dynamic";

/**
 * FOCUS BRIEF — GET /focus[?refresh=0]  (Stavros, 2026-10-21: "a short brief on what to look at ... with setups and limits etc.
 * a way to spend my attention in a way that is maximally efficient"). Refreshes the data if it is older than 10 minutes, uses live
 * BloFin prices, and returns `text`: open trades → his limits (cancel / close to fill) → Moonbag A+/A setups → what changes the
 * plan → admin → DO NOW. Grok relays `text` word for word.
 */
export const GET = withAgent(["grok", "claude"], async (req) => {
  const refresh = new URL(req.url).searchParams.get("refresh") !== "0";
  return json(await buildFocus({ refresh }));
});
