import { getActiveTheses, listAlerts, listHandoffs } from "@/lib/moonbag/db";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Table, biasTone, list, num, statusTone, when } from "../_components/ui";

export default async function OpportunitiesPage() {
  const { data, error } = await load(async () => {
    const [theses, handoffs, alerts] = await Promise.all([getActiveTheses(), listHandoffs(), listAlerts()]);
    return { theses, handoffs, alerts };
  });
  const setups = (data?.theses ?? [])
    .filter((t) => t.asset !== "MASTER")
    .sort((a, b) => Number(b.setup_score ?? -1) - Number(a.setup_score ?? -1));
  const liveAlerts = (data?.alerts ?? []).filter((a) => ["active", "triggered", "stale"].includes(a.status));
  const openHandoffs = (data?.handoffs ?? []).filter((h) => ["pending", "acknowledged"].includes(h.status));

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <Card title="Setups (active theses)">
        <Table
          head={["Asset", "Direction", "Setup score", "Entry", "Stop", "Targets", "Invalidation", "Status"]}
          rows={setups.map((t) => [
            <span key="a"><strong className="text-white">{t.asset}</strong><br /><Mono>{t.thesis_id}</Mono></span>,
            <Badge key="d" tone={biasTone(t.trade_plan?.direction ?? t.bias)}>{t.trade_plan?.direction ?? t.bias}</Badge>,
            <span key="s" className="font-mono">{num(t.setup_score, 1)} <span className="text-accent-green">{t.setup_grade}</span></span>,
            list(t.trade_plan?.entry_zone),
            num(t.trade_plan?.stop),
            [t.trade_plan?.tp1, t.trade_plan?.tp2, t.trade_plan?.tp3].map((x) => num(x)).join(" · "),
            num(t.levels?.invalidation),
            <Badge key="st" tone={statusTone(t.decision)}>{t.decision.replace("_", " ").toUpperCase()}</Badge>,
          ])}
          empty="No active setups. NO TRADE is a valid outcome."
        />
      </Card>

      <Card title="Grok handoffs (Robinhood)">
        <Table
          head={["Handoff", "Symbol", "Direction", "Entry condition", "Invalidation", "Score", "Status"]}
          rows={openHandoffs.map((h) => [
            <Mono key="i">{h.handoff_id}</Mono>, h.symbol,
            <Badge key="d" tone={biasTone(h.direction)}>{h.direction}</Badge>,
            h.entry_condition ?? "—", h.invalidation ?? "—", num(h.setup_score, 1),
            <Badge key="s" tone={statusTone(h.status)}>{h.status}</Badge>,
          ])}
          empty="No open handoffs for Grok."
        />
      </Card>

      <Card title="TradingView alerts">
        <Table
          head={["Alert", "Asset", "Condition", "Trigger", "Action", "Status", "Updated"]}
          rows={liveAlerts.map((a) => [
            <span key="i"><Mono>{a.alert_id}</Mono><br /><Mono>{a.thesis_id}</Mono></span>,
            a.tv_symbol ?? a.asset, a.condition, num(a.trigger_price), a.action,
            <span key="s"><Badge tone={statusTone(a.status)}>{a.status}</Badge>{a.status_reason && <div className="mt-1 text-[12px] text-white/45">{a.status_reason}</div>}</span>,
            when(a.updated_at),
          ])}
          empty="No live alerts recorded."
        />
      </Card>
    </div>
  );
}
