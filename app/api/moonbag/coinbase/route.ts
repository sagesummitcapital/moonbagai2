import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getCoinbaseBook } from "@/lib/moonbag/desk";

export const dynamic = "force-dynamic";

/**
 * Book 3 — Coinbase spot trend book, in one call (docs/strategy/COINBASE_STRATEGY.md).
 * Regime + triggers per coin (cb_universe), account snapshot, open/closed trades, pending handoffs,
 * the system's recent decisions (cb_signals) and the risk limits. Grok reads this before acting.
 */
export const GET = withAgent(["claude", "grok"], async () => {
  const book = await getCoinbaseBook();
  return json({ ok: true, ...book });
});
