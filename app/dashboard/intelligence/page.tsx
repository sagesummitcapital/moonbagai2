import { accuracyBy, getSystemState, listEvaluationDetails, listSystemStates } from "@/lib/moonbag/db";
import { GRADING_WEIGHTS } from "@/lib/moonbag/scoring";
import { load } from "../_components/data";
import { Bars, LineChart, Meter, ScoreBar } from "../_components/charts";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Fold, Id, LongText, Mono, Note, PageHeader, Quiet, Stat, Table, Unit, Updated, num } from "../_components/ui";

const scoreTone = (v: number | null | undefined) => (v == null ? "gray" : v >= 70 ? "green" : v >= 50 ? "cyan" : "amber");

export default async function IntelligencePage() {
  const { data, error } = await load(async () => {
    const [state, history, evals] = await Promise.all([getSystemState(), listSystemStates(30), listEvaluationDetails(500)]);
    return { state, history, evals };
  });
  const s = data?.state;
  const evals = data?.evals ?? [];
  const history = data?.history ?? [];
  const components: [string, number | null | undefined, number][] = [
    ["Direction", s?.direction_accuracy, GRADING_WEIGHTS.direction],
    ["Key levels", s?.level_accuracy, GRADING_WEIGHTS.levels],
    ["Setup", s?.setup_accuracy, GRADING_WEIGHTS.setup],
    ["Invalidation", s?.invalidation_accuracy, GRADING_WEIGHTS.invalidation],
    ["Targets", s?.target_accuracy, GRADING_WEIGHTS.target],
  ];
  const conf = Number(s?.system_confidence ?? 0);
  const confSeries = history.slice().reverse().map((h) => Number(h.system_confidence));
  const confLabels = history.slice().reverse().map((h) => h.state_date);
  const flagged = evals.filter((e) => e.methodology_change_warranted).length;

  const accTable = (rows: ReturnType<typeof accuracyBy>) => (
    <Table
      head={["", "Graded", "Avg score", "Direction avg"]}
      align={["l", "r", "l", "r"]}
      minWidth={0}
      dense
      rows={rows.map((r) => [
        <LongText key="k" text={r.key} max={60} className="min-w-[120px] max-w-[260px] text-[13px] font-medium leading-snug text-white" />,
        r.graded,
        <ScoreBar key="s" value={r.avgScore} tone={scoreTone(r.avgScore)} label={num(r.avgScore, 1)} width="w-[150px]" />,
        num(r.directionAvg, 1),
      ])}
      empty="No graded forecasts yet."
    />
  );

  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="Intelligence" sub="How good the forecasts have been, graded after the fact against what price did — by component, by asset, by regime." right={<Badge tone="gray">{evals.length} graded forecasts</Badge>} />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <Stat
            label="30-day System Confidence"
            value={<>{num(conf, 0)}<Unit>/ 100</Unit></>}
            tone={scoreTone(conf)}
            meter={<Meter value={conf} max={100} tone={scoreTone(conf)} height={6} labels={["0", "100"]} />}
            sub={<>{s?.forecasts_graded ?? 0} graded · reaches full weight at 20 graded forecasts · <Updated at={s?.computed_at} cadenceH={26} verb="computed" /></>}
          />
        </Card>
        <Card title="Component accuracy (30d)" className="md:col-span-2" right={<span>weight in the total score</span>}>
          <Bars
            max={100}
            tone="cyan"
            labelWidth="minmax(110px, 30%)"
            items={components.map(([label, v, w]) => ({ label, sub: `${w * 100}%`, value: v == null ? null : Number(v), tone: scoreTone(v == null ? null : Number(v)) }))}
          />
        </Card>
      </div>

      <Quiet title="The record" sub="tap any row to open it">
      <Fold count={history.length} title="Confidence history" right={<Mono>{history.length} days</Mono>}>
        {confSeries.length > 1 ? (
          <LineChart series={confSeries} labels={confLabels} baseline={null} format={(v) => num(v, 0)} tone="cyan" height={130} />
        ) : (
          <Empty>The history line starts after the second graded day.</Empty>
        )}
        <div className="mt-4">
          <Table
            head={["Date", "Confidence", "Graded", "Avg score", "Regime"]}
            align={["l", "l", "r", "r", "l"]}
            dense
            maxHeight={360}
            rows={history.map((h) => [
              <span key="d" className="whitespace-nowrap">{h.state_date}</span>,
              <ScoreBar key="c" value={h.system_confidence} tone={scoreTone(Number(h.system_confidence))} label={num(h.system_confidence, 0)} width="w-[140px]" />,
              h.forecasts_graded,
              num(h.avg_total_score, 1),
              <LongText key="r" text={h.current_regime ?? "—"} max={70} className="min-w-[200px] text-[12.5px] leading-snug text-white/65" />,
            ])}
          />
        </div>
      </Fold>

      <div className="space-y-2">
        <Fold title="Accuracy by asset">{accTable(accuracyBy(evals, (e) => e.asset))}</Fold>
        <Fold title="Accuracy by regime">{accTable(accuracyBy(evals, (e) => e.market_regime))}</Fold>
        <Fold title="Accuracy by setup grade">{accTable(accuracyBy(evals, (e) => e.setup_grade))}</Fold>
        <Fold title="Accuracy by direction">{accTable(accuracyBy(evals, (e) => e.planned_direction ?? e.bias))}</Fold>
      </div>

      <Fold title="Historical lessons" right={flagged ? <Badge tone="amber">{flagged} method change{flagged === 1 ? "" : "s"} flagged</Badge> : undefined}>
        <Table
          head={["Thesis", "Asset", "Score", "Error type", "Lesson"]}
          align={["l", "l", "l", "l", "l"]}
          dense
          maxHeight={640}
          rows={evals.filter((e) => e.lesson).slice(0, 50).map((e) => [
            <Id key="i">{e.thesis_id}</Id>,
            <strong key="a" className="text-white">{e.asset}</strong>,
            <ScoreBar key="s" value={e.total_score} tone={scoreTone(e.total_score == null ? null : Number(e.total_score))} label={num(e.total_score, 0)} width="w-[110px]" />,
            e.error_type && e.error_type !== "none" ? <Badge key="e" tone="amber">{e.error_type}</Badge> : <span key="e" className="text-white/40">{e.error_type ?? "—"}</span>,
            <span key="l" className="block min-w-[260px]">
              <LongText text={e.lesson} max={150} className="text-[13px] leading-snug text-white/75" />
              {e.methodology_change_warranted && <span className="mt-1 inline-block text-[12px] text-amber-200">· method change flagged</span>}
            </span>,
          ])}
          empty="Lessons appear here after forecasts are graded."
        />
        <Note>Scores: green ≥ 70 · cyan ≥ 50 · amber below 50.</Note>
      </Fold>
      </Quiet>
    </div>
  );
}
