import { getSystemState, listTrades } from "@/lib/moonbag/db";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Stat, Table, biasTone, money, num, when } from "../_components/ui";

export default async function PerformancePage() {
  const { data, error } = await load(async () => {
    const [closed, state] = await Promise.all([listTrades({ status: "closed" }), getSystemState()]);
    return { closed, state };
  });
  const closed = data?.closed ?? [];
  const pnl = closed.reduce((a, t) => a + Number(t.realized_pnl ?? 0), 0);
  const wins = closed.filter((t) => Number(t.realized_pnl ?? 0) > 0).length;
  const rs = closed.map((t) => t.r_multiple).filter((r): r is number => r != null).map(Number);
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  const ex = closed.map((t) => t.execution_score).filter((x): x is number => x != null).map(Number);
  const execAcc = ex.length ? ex.reduce((a, b) => a + b, 0) / ex.length : null;

  const byVenue = ["robinhood", "blofin", "other"].map((v) => {
    const ts = closed.filter((t) => t.venue === v);
    return [v, ts.length, money(ts.reduce((a, t) => a + Number(t.realized_pnl ?? 0), 0))];
  });

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <div className="grid gap-4 md:grid-cols-5">
        <Card><Stat label="Realized P&L" value={money(pnl)} sub={`${closed.length} closed trades`} /></Card>
        <Card><Stat label="Win rate" value={closed.length ? `${num((wins / closed.length) * 100, 0)}%` : "—"} /></Card>
        <Card><Stat label="Avg R multiple" value={avgR == null ? "—" : `${num(avgR, 2)}R`} sub={`Total ${num(rs.reduce((a, b) => a + b, 0), 2)}R`} /></Card>
        <Card><Stat label="Forecast accuracy" value={num(data?.state?.avg_total_score, 0)} sub="30-day avg graded score" /></Card>
        <Card><Stat label="Execution accuracy" value={num(execAcc, 0)} sub="avg execution score" /></Card>
      </div>
      <Card title="By venue">
        <Table head={["Venue", "Closed trades", "Realized P&L"]} rows={byVenue} />
      </Card>
      <Card title="Closed trades">
        <Table
          head={["Trade", "Venue", "Symbol", "Dir", "Entry → Exit", "P&L", "R", "Exec.", "Closed"]}
          rows={closed.map((t) => [
            <Mono key="i">{t.trade_id}</Mono>, t.venue, t.symbol,
            <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
            `${num(t.entry)} → ${num(t.exit_price)}`,
            <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
            t.r_multiple == null ? "—" : `${num(t.r_multiple)}R`,
            num(t.execution_score, 0),
            when(t.closed_at),
          ])}
          empty="No closed trades yet."
        />
      </Card>
    </div>
  );
}
