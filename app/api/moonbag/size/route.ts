import { withAgent, json, readJson } from "@/lib/moonbag/apiAuth";
import { sizePosition, type SizingInput } from "@/lib/moonbag/risk";

export const dynamic = "force-dynamic";

/** Position-sizing calculator (leverage comes last). Returns NO_TRADE when inputs are missing. */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  return json({ ok: true, result: sizePosition(body as unknown as SizingInput) });
});
