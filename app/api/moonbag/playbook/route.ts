import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { ACTIVE_TRADE, POTENTIAL_TRADE, RULES, getTraderNumbers, numberLines, playbookText } from "@/lib/moonbag/playbook";

export const dynamic = "force-dynamic";

/**
 * GET /playbook (CR-64) — Stavros's rules, the fixed structure for critiquing a potential trade and an active trade, and his live numbers.
 * Grok uses `potential_trade` when he asks "should I take this?" and `active_trade` when he asks "move the stop / take profit / let it ride?".
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const numbers = await getTraderNumbers();
  return json({ ok: true, text: playbookText(numbers), rules: RULES, potential_trade: POTENTIAL_TRADE, active_trade: ACTIVE_TRADE, numbers, number_lines: numberLines(numbers) });
});
