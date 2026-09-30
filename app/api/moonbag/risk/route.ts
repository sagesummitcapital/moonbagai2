import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getRiskStatus } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** Current risk limits + exposure, so Grok can double-check before placing an order. */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const venue = new URL(req.url).searchParams.get("venue") ?? "robinhood";
  return json({ ok: true, ...(await getRiskStatus(venue)) });
});
