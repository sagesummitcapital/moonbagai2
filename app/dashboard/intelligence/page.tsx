import { accuracyBy, getSystemState, listEvaluationDetails, listSystemStates } from "@/lib/moonbag/db";
import { GRADING_WEIGHTS } from "@/lib/moonbag/scoring";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Card, Mono, Stat, Table, num } from "../_components/ui";

export default async function IntelligencePage() {
  const { data, error } = await load(async () => {
    const [state, history, evals] = await Promise.all([getSystemState(), listSystemStates(30), listEvaluationDetails(500)]);
    return { state, history, evals };
  });
  const s = data?.state;
  const evals = data?.evals ?? [];
  const components: [string, number | null | undefined, number][] = [
    ["Direction", s?.direction_accuracy, GRADING_WEIGHTS.direction],
    ["Key levels", s?.level_accuracy, GRADING_WEIGHTS.levels],
    ["Setup", s?.setup_accuracy, GRADING_WEIGHTS.setup],
    ["Invalidation", s?.invalidation_accuracy, GRADING_WEIGHTS.invalidation],
    ["Targets", s?.target_accuracy, GRADING_WEIGHTS.target],
  ];
  const acc = (rows: ReturnType<typeof accuracyBy>) =>
    rows.map((r) => [r.key, r.graded, num(r.avgScore, 1), num(r.directionAvg, 1)]);
  const head = ["", "Graded", "Avg score", "Direction avg"];

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <Stat
            label="30-day System Confidence"
            value={<>{num(s?.system_confidence ?? 0, 0)}<span className="text-[16px] text-white/40"> / 100</span></>}
            sub={`${s?.forecasts_graded ?? 0} graded · reaches full weight at 20 graded forecasts`}
          />
        </Card>
        <Card title="Component accuracy (30d)" className="md:col-span-2">
          <div className="space-y-2.5">
            {components.map(([label, v, w]) => (
              <div key={label} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-[13px]">
                <span className="text-white/60">{label} <span className="text-white/30">{w * 100}%</span></span>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-accent-gradient" style={{ width: `${Math.max(0, Math.min(100, Number(v ?? 0)))}%` }} />
                </div>
                <span className="text-right font-mono text-white/80">{num(v, 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Accuracy by asset"><Table head={head} rows={acc(accuracyBy(evals, (e) => e.asset))} empty="No graded forecasts yet." /></Card>
        <Card title="Accuracy by regime"><Table head={head} rows={acc(accuracyBy(evals, (e) => e.market_regime))} empty="No graded forecasts yet." /></Card>
        <Card title="Accuracy by setup grade"><Table head={head} rows={acc(accuracyBy(evals, (e) => e.setup_grade))} empty="No graded forecasts yet." /></Card>
        <Card title="Accuracy by direction"><Table head={head} rows={acc(accuracyBy(evals, (e) => e.planned_direction ?? e.bias))} empty="No graded forecasts yet." /></Card>
      </div>

      <Card title="Historical lessons">
        <Table
          head={["Thesis", "Asset", "Score", "Error type", "Lesson"]}
          rows={evals.filter((e) => e.lesson).slice(0, 50).map((e) => [
            <Mono key="i">{e.thesis_id}</Mono>, e.asset, num(e.total_score, 0), e.error_type ?? "—",
            <span key="l" className="text-white/75">{e.lesson}{e.methodology_change_warranted && <span className="ml-2 text-amber-200">· method change flagged</span>}</span>,
          ])}
          empty="Lessons appear here after forecasts are graded."
        />
      </Card>

      <Card title="Confidence history">
        <Table
          head={["Date", "Confidence", "Graded", "Avg score", "Regime"]}
          rows={(data?.history ?? []).map((h) => [h.state_date, num(h.system_confidence, 0), h.forecasts_graded, num(h.avg_total_score, 1), h.current_regime ?? "—"])}
        />
      </Card>
    </div>
  );
}
