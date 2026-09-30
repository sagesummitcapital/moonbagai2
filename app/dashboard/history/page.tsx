import { listAlerts, listEvaluationDetails, listTheses, listTrades } from "@/lib/moonbag/db";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Table, biasTone, money, num, statusTone, when } from "../_components/ui";

export default async function HistoryPage() {
  const { data, error } = await load(async () => {
    const [theses, evals, trades, alerts] = await Promise.all([
      listTheses({ limit: 300 }), listEvaluationDetails(300), listTrades({ limit: 300 }), listAlerts(),
    ]);
    return { theses, evals, trades, alerts };
  });

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <p className="text-[13.5px] text-white/50">History is append-only. Corrections appear as new versions — nothing is rewritten.</p>

      <Card title="Every thesis & version">
        <Table
          head={["Thesis", "Date", "Asset", "Bias", "Setup", "Decision", "Status", "Supersedes / reason", "Published"]}
          rows={(data?.theses ?? []).map((t) => [
            <Mono key="i">{t.thesis_id}</Mono>, t.thesis_date, t.asset,
            <Badge key="b" tone={biasTone(t.bias)}>{t.bias}</Badge>,
            `${num(t.setup_score, 1)} ${t.setup_grade ?? ""}`,
            t.decision, <Badge key="s" tone={statusTone(t.status)}>{t.status}</Badge>,
            t.supersedes ? <span key="v"><Mono>{t.supersedes}</Mono><div className="text-[12px] text-white/45">{t.change_reason}</div></span> : "—",
            when(t.created_at),
          ])}
        />
      </Card>

      <Card title="Every evaluation">
        <Table
          head={["Evaluation", "Thesis", "Dir", "Levels", "Setup", "Inval.", "Target", "Total", "Graded"]}
          rows={(data?.evals ?? []).map((e) => [
            <Mono key="i">{e.evaluation_id}</Mono>, <Mono key="t">{e.thesis_id}</Mono>,
            num(e.direction_score, 0), num(e.levels_score, 0), num(e.setup_score, 0), num(e.invalidation_score, 0), num(e.target_score, 0),
            <strong key="x" className="text-white">{num(e.total_score, 1)}</strong>, when(e.evaluated_at),
          ])}
        />
      </Card>

      <Card title="Every trade">
        <Table
          head={["Trade", "Thesis", "Venue", "Symbol", "Dir", "Status", "P&L", "R", "Created"]}
          rows={(data?.trades ?? []).map((t) => [
            <Mono key="i">{t.trade_id}</Mono>, <Mono key="t">{t.thesis_id}</Mono>, t.venue, t.symbol,
            <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
            <Badge key="s" tone={statusTone(t.status)}>{t.status}</Badge>,
            money(t.realized_pnl), t.r_multiple == null ? "—" : `${num(t.r_multiple)}R`, when(t.created_at),
          ])}
        />
      </Card>

      <Card title="Every alert">
        <Table
          head={["Alert", "Thesis", "Asset", "Condition", "Trigger", "Status", "Created"]}
          rows={(data?.alerts ?? []).map((a) => [
            <Mono key="i">{a.alert_id}</Mono>, <Mono key="t">{a.thesis_id}</Mono>, a.asset, a.condition, num(a.trigger_price),
            <Badge key="s" tone={statusTone(a.status)}>{a.status}</Badge>, when(a.created_at),
          ])}
        />
      </Card>
    </div>
  );
}
