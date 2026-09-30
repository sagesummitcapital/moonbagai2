import { withAgent, json, readJson, requireFields, pick } from "@/lib/moonbag/apiAuth";
import { createThesis, listTheses } from "@/lib/moonbag/db";
import type { NewThesis, ThesisStatus } from "@/lib/moonbag/types";

export const dynamic = "force-dynamic";

const THESIS_FIELDS = [
  "thesis_date", "asset", "market", "time_horizon", "bias", "thesis_confidence", "system_confidence",
  "setup_score", "market_regime", "risk_environment", "levels", "trade_plan", "primary_scenario",
  "alternative_scenario", "what_changes_our_mind", "catalysts", "conditions_for_entry",
  "conditions_to_cancel", "reasoning", "decision", "supersedes", "change_reason", "source",
] as const;

export const GET = withAgent(["claude", "grok"], async (req) => {
  const p = new URL(req.url).searchParams;
  const theses = await listTheses({
    date: p.get("date") ?? undefined,
    status: (p.get("status") as ThesisStatus) ?? undefined,
    asset: p.get("asset") ?? undefined,
  });
  return json({ ok: true, theses });
});

/** Publish a thesis. To change one, POST a new one with `supersedes` + `change_reason`. */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  requireFields(body, ["asset", "market", "bias"]);
  const thesis = await createThesis(pick(body, THESIS_FIELDS) as NewThesis);
  return json({ ok: true, thesis }, 201);
});
