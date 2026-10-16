import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { quickInputs } from "@/lib/moonbag/quick";

export const dynamic = "force-dynamic";

/**
 * FAST INPUTS — GET /quick?coin=BTC&side=long&entry=80150&stop=79800[&grade=A][&margin=cross]
 * Returns `text`: the full order card (3-line plan, TP1/TP2 from recorded levels, size, leverage, margin, liq, risk).
 * Grok relays it word for word.
 */
export const GET = withAgent(["grok", "claude"], async (req) => {
  const u = new URL(req.url);
  const side = (u.searchParams.get("side") ?? "").toLowerCase();
  if (side !== "long" && side !== "short") throw new BadRequest('side must be "long" or "short"');
  const coin = u.searchParams.get("coin");
  const entry = Number(u.searchParams.get("entry"));
  const stop = Number(u.searchParams.get("stop"));
  if (!coin || !entry || !stop) throw new BadRequest("coin, entry and stop are required");
  const margin = u.searchParams.get("margin") === "isolated" ? "isolated" : "cross"; // house rule 2026-10-16: cross by default
  const r = await quickInputs({ coin, side, entry, stop, grade: u.searchParams.get("grade"), margin });
  return json(r);
});
