import { withAgent, json, readJson, requireFields, pick } from "@/lib/moonbag/apiAuth";
import { createEvaluation, getSystemState, listEvaluationDetails } from "@/lib/moonbag/db";
import type { NewEvaluation } from "@/lib/moonbag/types";

export const dynamic = "force-dynamic";

const EVAL_FIELDS = [
  "thesis_id", "evaluation_date", "direction_score", "levels_score", "setup_score", "invalidation_score",
  "target_score", "setup_triggered", "actual_result", "what_worked", "what_failed", "error_type",
  "missed_information", "overweighted_information", "lesson", "methodology_change_warranted",
] as const;

export const GET = withAgent(["claude", "grok"], async () => {
  return json({ ok: true, evaluations: await listEvaluationDetails(200) });
});

/** Grade a thesis (immutable). System Confidence is recomputed automatically. */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  requireFields(body, ["thesis_id"]);
  const evaluation = await createEvaluation(pick(body, EVAL_FIELDS) as NewEvaluation);
  return json({ ok: true, evaluation, system_state: await getSystemState() }, 201);
});
