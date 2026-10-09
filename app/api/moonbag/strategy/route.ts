import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getStrategyDoc } from "@/lib/moonbag/agents";

export const dynamic = "force-dynamic";

/**
 * The source-of-truth strategy file (MOONBAG_STRATEGY.md) plus the live coin universe.
 * Every agent reads this instead of keeping its own copy of the rules.
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const d = await getStrategyDoc();
  return json({ ok: true, ...d });
});
