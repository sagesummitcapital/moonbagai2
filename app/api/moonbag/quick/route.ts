import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { quickInputs, quickLive } from "@/lib/moonbag/quick";

export const dynamic = "force-dynamic";

/**
 * FAST INPUTS — GET /quick?coin=BTC&side=long[&entry=80150&stop=79800][&risk=1][&grade=A][&margin=cross]
 * Without entry/stop: a LIVE card — entry = BloFin live price now, stop = just past the nearest structure.
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
  if (!coin) throw new BadRequest("coin is required");
  const margin = u.searchParams.get("margin") === "isolated" ? "isolated" : "cross"; // house rule 2026-10-16: cross by default
  // No entry/stop → LIVE card (Stavros 2026-10-18): entry = BloFin live price, stop = past the nearest structure; never a stale plan price.
  const risk = Number(u.searchParams.get("risk")) || null; // caller's risk % (Woods/Eliz/Johnny) — lowers the house risk only
  if (!entry || !stop) return json(await quickLive(coin, side, margin, u.searchParams.get("grade"), risk));
  const r = await quickInputs({ coin, side, entry, stop, grade: u.searchParams.get("grade"), margin, risk });
  return json(r);
});
