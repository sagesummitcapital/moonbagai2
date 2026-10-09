import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getAgentsBoard } from "@/lib/moonbag/agents";

export const dynamic = "force-dynamic";

/** The agent map as data: registry, pipelines, last activity per agent, rotation universe. */
export const GET = withAgent(["claude", "grok"], async () => {
  const b = await getAgentsBoard();
  return json({ ok: true, ...b, strategy: b.strategy ? { version: b.strategy.version, created_at: b.strategy.created_at } : null });
});
