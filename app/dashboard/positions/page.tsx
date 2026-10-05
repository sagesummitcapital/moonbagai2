import { listTrades } from "@/lib/moonbag/db";
import type { Trade } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Table, biasTone, money, num, statusTone, when } from "../_components/ui";

const VENUES: { key: string; label: string }[] = [
  { key: "robinhood", label: "Robinhood (Grok)" },
  { key: "blofin", label: "BloFin (manual leverage)" },
  { key: "other", label: "Other venues" },
];

export default async function PositionsPage() {
  const { data, error } = await load(async () => {
    const [open, pending] = await Promise.all([listTrades({ status: "open" }), listTrades({ status: "pending" })]);
    return [...open, ...pending];
  });
  const trades = data ?? [];
  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      {VENUES.map((v) => (
        <Card key={v.key} title={v.label}>
          <PositionsTable trades={trades.filter((t) => t.venue === v.key)} />
        </Card>
      ))}
    </div>
  );
}

function PositionsTable({ trades }: { trades: Trade[] }) {
  return (
    <Table
      head={["Trade", "Symbol", "Dir", "Entry", "Stop (orig / now)", "Targets", "Risk", "Size / Lev.", "Status", "Opened"]}
      rows={trades.map((t) => [
        <span key="i"><Mono>{t.trade_id}</Mono><br /><Mono>{t.thesis_id}</Mono></span>,
        t.symbol,
        <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
        num(t.entry),
        `${num(t.stop)} / ${num(t.current_stop)}`,
        [t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp2 ?? t.tp2, t.current_tp3 ?? t.tp3].map((x) => num(x)).join(" · "),
        t.risk_dollars != null ? `${money(t.risk_dollars)} (${num(t.risk_percent)}%)` : "—",
        t.venue === "blofin" ? `${money(t.position_notional)} · ${num(t.leverage)}x · m ${money(t.margin)}` : `${num(t.quantity, 4)} · ${money(t.position_value)}`,
        <Badge key="s" tone={statusTone(t.status)}>{t.status}</Badge>,
        when(t.opened_at),
      ])}
      empty="No open or pending positions."
    />
  );
}
