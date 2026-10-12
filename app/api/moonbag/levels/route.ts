import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { buildLevels } from "@/lib/moonbag/levels";

export const dynamic = "force-dynamic";

/**
 * The single canonical answer to "what are the current TradingView levels / alerts / setups?".
 * Any agent relays `text` word for word (Stavros, 2026-10-12).
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const b = await buildLevels();
  return json({ ok: true, ...b });
});
