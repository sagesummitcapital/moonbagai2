import { withAgent, json, readJson } from "@/lib/moonbag/apiAuth";
import { getSystemState, listSystemStates, refreshSystemState } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

export const GET = withAgent(["claude", "grok"], async () => {
  const [current, history] = await Promise.all([getSystemState(), listSystemStates(30)]);
  return json({ ok: true, current, history });
});

/** Recompute today's System Confidence and record regime / risk environment. */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
  const state = await refreshSystemState({
    regime: typeof body.current_regime === "string" ? body.current_regime : null,
    riskEnvironment: typeof body.risk_environment === "string" ? body.risk_environment : null,
  });
  return json({ ok: true, system_state: state });
});
