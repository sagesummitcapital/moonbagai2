import { getSystemState, listTrades } from "@/lib/moonbag/db";
import { load } from "../_components/data";
import { DivergingBars, LineChart, Meter } from "../_components/charts";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Delta, Empty, Id, Mono, Note, PageHeader, RMult, Stat, Table, Unit, biasGlyph, biasTone, money, num, when } from "../_components/ui";

const VENUE_LABEL: Record<string, string> = { robinhood: "Robinhood", blofin: "BloFin", coinbase: "Coinbase", other: "Other" };

export default async function PerformancePage() {
  const { data, error } = await load(async () => {
    const [closed, state] = await Promise.all([listTrades({ status: "closed" }), getSystemState()]);
    return { closed, state };
  });
  const closed = data?.closed ?? [];
  const pnl = closed.reduce((a, t) => a + Number(t.realized_pnl ?? 0), 0);
  const wins = closed.filter((t) => Number(t.realized_pnl ?? 0) > 0).length;
  const rs = closed.map((t) => t.r_multiple).filter((r): r is number => r != null).map(Number);
  const totalR = rs.reduce((a, b) => a + b, 0);
  const avgR = rs.length ? totalR / rs.length : null;
  const ex = closed.map((t) => t.execution_score).filter((x): x is number => x != null).map(Number);
  const execAcc = ex.length ? ex.reduce((a, b) => a + b, 0) / ex.length : null;
  const winRate = closed.length ? (wins / closed.length) * 100 : null;

  const byVenue = ["robinhood", "blofin", "coinbase", "other"].map((v) => {
    const ts = closed.filter((t) => t.venue === v);
    return { venue: v, n: ts.length, pnl: ts.reduce((a, t) => a + Number(t.realized_pnl ?? 0), 0) };
  });

  // Cumulative R over time, oldest → newest, from the same closed trades.
  const closedKey = (t: (typeof closed)[number]) => String(t.closed_at ?? t.updated_at ?? t.created_at);
  const chrono = closed.filter((t) => t.r_multiple != null).sort((a, b) => closedKey(a).localeCompare(closedKey(b)));
  let run = 0;
  const curve = [0, ...chrono.map((t) => (run += Number(t.r_multiple)))];
  const curveLabels = ["start", ...chrono.map((t) => when(t.closed_at ?? t.updated_at))];

  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="Performance" sub="Every closed trade across the three books, with the forecasting and execution scores that go with them." right={<Badge tone="gray">{closed.length} closed trades</Badge>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Card><Stat label="Realized P&L" value={<Delta v={pnl} prefix="$" arrow={false} className="text-[26px] md:text-[30px]" />} sub={`${closed.length} closed trades`} /></Card>
        <Card>
          <Stat
            label="Win rate"
            value={winRate == null ? "—" : `${num(winRate, 0)}%`}
            tone={winRate == null ? undefined : winRate >= 50 ? "green" : "amber"}
            meter={winRate == null ? undefined : <Meter value={winRate} max={100} tone={winRate >= 50 ? "green" : "amber"} limit={50} height={6} />}
            sub={closed.length ? `${wins} won · ${closed.length - wins} not` : "No closed trades yet"}
          />
        </Card>
        <Card><Stat label="Avg R multiple" value={avgR == null ? "—" : <Delta v={avgR} unit="R" arrow={false} className="text-[26px] md:text-[30px]" />} sub={<>Total <RMult v={totalR} /> over {rs.length} trades</>} /></Card>
        <Card>
          <Stat
            label="Forecast accuracy"
            value={<>{num(data?.state?.avg_total_score, 0)}<Unit>/ 100</Unit></>}
            meter={<Meter value={Number(data?.state?.avg_total_score ?? 0)} max={100} tone="cyan" height={6} />}
            sub="30-day avg graded score"
          />
        </Card>
        <Card>
          <Stat
            label="Execution accuracy"
            value={<>{num(execAcc, 0)}<Unit>/ 100</Unit></>}
            meter={<Meter value={Number(execAcc ?? 0)} max={100} tone="cyan" height={6} />}
            sub="avg execution score"
          />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Cumulative R" right={<Mono>{chrono.length} closed trades with an R</Mono>}>
          {curve.length > 1 ? (
            <LineChart series={curve} labels={curveLabels} format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`} />
          ) : (
            <Empty>The curve starts with the first closed trade that has an R multiple.</Empty>
          )}
        </Card>
        <Card title="By venue">
          <DivergingBars
            className="mb-4"
            labelWidth="minmax(90px, 36%)"
            format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`}
            items={byVenue.map((v) => ({ label: VENUE_LABEL[v.venue], sub: `${v.n} trade${v.n === 1 ? "" : "s"}`, value: v.n ? v.pnl : null }))}
          />
          <Table
            head={["Venue", "Closed trades", "Realized P&L"]}
            align={["l", "r", "r"]}
            dense
            rows={byVenue.map((v) => [v.venue, v.n, <span key="p" className={v.pnl > 0 ? "text-accent-green" : v.pnl < 0 ? "text-rose-300" : "text-white/60"}>{money(v.pnl)}</span>])}
          />
        </Card>
      </div>

      <Card title="R by trade" right={<Mono>newest first</Mono>}>
        {rs.length ? (
          <DivergingBars
            labelWidth="minmax(120px, 34%)"
            format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`}
            items={closed.filter((t) => t.r_multiple != null).slice(0, 20).map((t) => ({ label: `${t.symbol} ${t.direction}`, sub: `${VENUE_LABEL[t.venue] ?? t.venue} · ${when(t.closed_at)}`, value: Number(t.r_multiple) }))}
          />
        ) : (
          <Empty>No closed trades with an R multiple yet.</Empty>
        )}
        {closed.filter((t) => t.r_multiple != null).length > 20 && <Note>Showing the latest 20; the full list is in the table below.</Note>}
      </Card>

      <Card title="Closed trades">
        <Table
          head={["Trade", "Venue", "Symbol", "Dir", "Entry → Exit", "P&L", "R", "Exec.", "Closed"]}
          align={["l", "l", "l", "l", "r", "r", "r", "r", "l"]}
          minWidth={880}
          rows={closed.map((t) => [
            <Id key="i">{t.trade_id}</Id>, t.venue, <strong key="s" className="text-white">{t.symbol}</strong>,
            <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
            `${num(t.entry)} → ${num(t.exit_price)}`,
            <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
            <RMult key="r" v={t.r_multiple} />,
            num(t.execution_score, 0),
            <span key="c" className="whitespace-nowrap text-white/60">{when(t.closed_at)}</span>,
          ])}
          empty="No closed trades yet."
        />
      </Card>
    </div>
  );
}
