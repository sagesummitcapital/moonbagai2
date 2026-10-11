import { listAlerts, listEvaluationDetails, listTheses, listTrades } from "@/lib/moonbag/db";
import { load } from "../_components/data";
import { ScoreBar } from "../_components/charts";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, LongText, Id, Mono, PageHeader, RMult, Stat, StatGrid, Table, biasGlyph, biasTone, money, num, statusTone, when } from "../_components/ui";

const scoreTone = (v: number | null | undefined) => (v == null ? "gray" : Number(v) >= 70 ? "green" : Number(v) >= 50 ? "cyan" : "amber");

export default async function HistoryPage() {
  const { data, error } = await load(async () => {
    const [theses, evals, trades, alerts] = await Promise.all([
      listTheses({ limit: 300 }), listEvaluationDetails(300), listTrades({ limit: 300 }), listAlerts(),
    ]);
    return { theses, evals, trades, alerts };
  });
  const theses = data?.theses ?? [];
  const evals = data?.evals ?? [];
  const trades = data?.trades ?? [];
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="History" sub="History is append-only. Corrections appear as new versions — nothing is rewritten." />

      <StatGrid cols={4}>
        <Card><Stat label="Theses & versions" value={theses.length} size="md" sub={`${theses.filter((t) => t.status === "active").length} active · ${theses.filter((t) => t.supersedes).length} revisions`} /></Card>
        <Card><Stat label="Evaluations" value={evals.length} size="md" sub={evals.length ? `avg ${num(evals.reduce((a, e) => a + Number(e.total_score ?? 0), 0) / evals.length, 1)} / 100` : "none yet"} /></Card>
        <Card><Stat label="Trades" value={trades.length} size="md" sub={`${trades.filter((t) => t.status === "open").length} open · ${trades.filter((t) => t.status === "closed").length} closed`} /></Card>
        <Card><Stat label="Alerts" value={alerts.length} size="md" sub={`${alerts.filter((a) => a.status === "active").length} active · ${alerts.filter((a) => a.status === "triggered").length} triggered`} /></Card>
      </StatGrid>

      <Card title="Every thesis & version" right={<Mono>newest first · up to 300</Mono>}>
        <Table
          head={["Thesis", "Date", "Asset", "Bias", "Setup", "Decision", "Status", "Supersedes / reason", "Published"]}
          align={["l", "l", "l", "l", "r", "l", "l", "l", "l"]}
          minWidth={1000}
          dense
          maxHeight={640}
          rows={theses.map((t) => [
            <Id key="i">{t.thesis_id}</Id>, <span key="d" className="whitespace-nowrap">{t.thesis_date}</span>, <strong key="a" className="text-white">{t.asset}</strong>,
            <Badge key="b" tone={biasTone(t.bias)}>{biasGlyph(t.bias)} {t.bias}</Badge>,
            <span key="s" className="whitespace-nowrap">{num(t.setup_score, 1)} <span className="text-white/45">{t.setup_grade ?? ""}</span></span>,
            <span key="dc" className="whitespace-nowrap uppercase text-[12px] tracking-wide text-white/70">{t.decision.replace("_", " ")}</span>, <Badge key="st" tone={statusTone(t.status)} dot>{t.status}</Badge>,
            t.supersedes ? <span key="v" className="block min-w-[220px]"><Id>{t.supersedes}</Id><LongText text={t.change_reason} max={90} className="text-[12px] leading-snug text-white/45" /></span> : "—",
            <span key="p" className="whitespace-nowrap text-white/60">{when(t.created_at)}</span>,
          ])}
        />
      </Card>

      <Card title="Every evaluation" right={<Mono>component scores out of 100</Mono>}>
        <Table
          head={["Evaluation", "Thesis", "Dir", "Levels", "Setup", "Inval.", "Target", "Total", "Graded"]}
          align={["l", "l", "r", "r", "r", "r", "r", "l", "l"]}
          minWidth={900}
          dense
          maxHeight={640}
          rows={evals.map((e) => [
            <Id key="i">{e.evaluation_id}</Id>, <Id key="t">{e.thesis_id}</Id>,
            num(e.direction_score, 0), num(e.levels_score, 0), num(e.setup_score, 0), num(e.invalidation_score, 0), num(e.target_score, 0),
            <ScoreBar key="x" value={e.total_score} tone={scoreTone(e.total_score)} label={num(e.total_score, 1)} width="w-[120px]" />,
            <span key="g" className="whitespace-nowrap text-white/60">{when(e.evaluated_at)}</span>,
          ])}
        />
      </Card>

      <Card title="Every trade">
        <Table
          head={["Trade", "Thesis", "Venue", "Symbol", "Dir", "Status", "P&L", "R", "Created"]}
          align={["l", "l", "l", "l", "l", "l", "r", "r", "l"]}
          minWidth={900}
          dense
          maxHeight={640}
          rows={trades.map((t) => [
            <Id key="i">{t.trade_id}</Id>, <Id key="t">{t.thesis_id}</Id>, t.venue, <strong key="s" className="text-white">{t.symbol}</strong>,
            <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
            <Badge key="st" tone={statusTone(t.status)} dot>{t.status}</Badge>,
            <span key="p" className={t.realized_pnl == null ? "text-white/40" : Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
            <RMult key="r" v={t.r_multiple} />,
            <span key="c" className="whitespace-nowrap text-white/60">{when(t.created_at)}</span>,
          ])}
        />
      </Card>

      <Card title="Every alert">
        <Table
          head={["Alert", "Thesis", "Asset", "Condition", "Trigger", "Status", "Created"]}
          align={["l", "l", "l", "l", "r", "l", "l"]}
          minWidth={820}
          dense
          maxHeight={640}
          rows={alerts.map((a) => [
            <Id key="i">{a.alert_id}</Id>, <Id key="t">{a.thesis_id}</Id>, <strong key="a" className="text-white">{a.asset}</strong>, <span key="c" className="whitespace-nowrap">{a.condition === "cross_up" ? "↑ " : a.condition === "cross_down" ? "↓ " : ""}{a.condition}</span>, num(a.trigger_price),
            <Badge key="s" tone={statusTone(a.status)} dot>{a.status}</Badge>, <span key="cr" className="whitespace-nowrap text-white/60">{when(a.created_at)}</span>,
          ])}
        />
      </Card>
    </div>
  );
}
