import { listTrades } from "@/lib/moonbag/db";
import { kindForVenue, type PriceMap } from "@/lib/moonbag/prices";
import type { Trade } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { LiveMetric, LivePrice, TradeRail } from "../_components/LivePrice";
import { getLivePricesMixed } from "@/lib/moonbag/prices";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Id, PageHeader, Stat, StatGrid, Table, Tile, biasGlyph, biasTone, money, num, statusTone, when, whenShort } from "../_components/ui";

const VENUES: { key: string; label: string }[] = [
  { key: "robinhood", label: "Robinhood (Grok)" },
  { key: "blofin", label: "BloFin (manual leverage)" },
  { key: "coinbase", label: "Coinbase (Grok, spot crypto)" },
  { key: "other", label: "Other venues" },
];

export default async function PositionsPage() {
  const { data, error } = await load(async () => {
    const [open, pending] = await Promise.all([listTrades({ status: "open" }), listTrades({ status: "pending" })]);
    return [...open, ...pending];
  });
  const trades = data ?? [];
  const openCount = trades.filter((t) => t.status === "open").length;
  const pendingCount = trades.filter((t) => t.status === "pending").length;
  const riskTotal = trades.reduce((a, t) => a + Number(t.risk_dollars ?? 0), 0);
  const symbols = Array.from(new Set(trades.map((t) => t.symbol)));
  // Live prices by venue: BloFin / Coinbase symbols are crypto (Coinbase spot), Robinhood symbols are stocks (Yahoo).
  let live: PriceMap = {};
  try {
    live = await getLivePricesMixed(
      trades.filter((t) => kindForVenue(t.venue) === "crypto").map((t) => t.symbol),
      trades.filter((t) => kindForVenue(t.venue) === "stock").map((t) => t.symbol),
    );
  } catch { live = {}; }
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="Positions" sub="Everything open or pending across the three books, with the stop and targets that are live right now. Prices (Coinbase spot for coins, Yahoo for stocks) refresh hourly, each with its timestamp." />

      <StatGrid cols={4}>
        <Card><Stat label="Open" value={openCount} size="md" tone={openCount ? "green" : undefined} sub={pendingCount ? `${pendingCount} pending` : "none pending"} /></Card>
        <Card><Stat label="Risk to stops" value={money(riskTotal)} size="md" sub="sum of each trade's risk $" /></Card>
        <Card><Stat label="Markets" value={symbols.length} size="md" sub={symbols.length ? symbols.join(", ") : "—"} /></Card>
        <Card><Stat label="Venues in use" value={VENUES.filter((v) => trades.some((t) => t.venue === v.key)).length} size="md" sub={VENUES.filter((v) => trades.some((t) => t.venue === v.key)).map((v) => v.key).join(", ") || "—"} /></Card>
      </StatGrid>

      {trades.length > 0 && (
        <Card title="Where each trade stands" sub="Stop → entry → target, with the live price marked. R is measured against the original stop; the account % uses the equity at entry.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trades.map((t) => (
              <Tile key={t.trade_id} tone="accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[15px] text-white">{t.symbol}</strong>
                    <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
                    <Badge tone="gray">{VENUES.find((v) => v.key === t.venue)?.label.split(" ")[0] ?? t.venue}{t.leverage ? ` · ${num(t.leverage, 0)}x` : ""}</Badge>
                    {t.status === "pending" && <Badge tone="amber">pending</Badge>}
                  </div>
                  <span className="text-[11.5px] text-white/40">opened {whenShort(t.opened_at ?? t.created_at)}</span>
                </div>
                <TradeRail className="mt-2.5" compact symbol={t.symbol} kind={kindForVenue(t.venue)} initial={live[t.symbol]} direction={t.direction} entry={t.entry} stop={t.current_stop ?? t.stop} origStop={t.stop} target={t.current_tp1 ?? t.tp1 ?? t.target} qty={t.qty_open ?? t.quantity} equity={t.account_equity} />
                <div className="mt-1.5 text-[11.5px] text-white/40"><Id>{t.trade_id}</Id>{t.risk_dollars != null && <> · risk {money(t.risk_dollars)}</>}</div>
              </Tile>
            ))}
          </div>
        </Card>
      )}

      {VENUES.map((v) => {
        const ts = trades.filter((t) => t.venue === v.key);
        return (
          <Card key={v.key} title={v.label} right={<Badge tone={ts.length ? "green" : "gray"} dot>{ts.length} position{ts.length === 1 ? "" : "s"}</Badge>}>
            <PositionsTable trades={ts} live={live} />
          </Card>
        );
      })}
    </div>
  );
}

function PositionsTable({ trades, live }: { trades: Trade[]; live: PriceMap }) {
  return (
    <Table
      head={["Symbol", "Dir", "Entry", "Now", "R now", "Stop (orig / now)", "Targets", "Risk", "Size / Lev.", "Status", "Opened"]}
      align={["l", "l", "r", "r", "r", "r", "r", "r", "r", "l", "l"]}
      minWidth={1100}
      rows={trades.map((t) => [
        <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id>{t.thesis_id && <><br /><Id>{t.thesis_id}</Id></>}</span>,
        <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
        num(t.entry),
        <LivePrice key="n" symbol={t.symbol} kind={kindForVenue(t.venue)} initial={live[t.symbol]} size="sm" />,
        t.stop != null && Number(t.stop) !== Number(t.entry)
          ? <LiveMetric key="r" symbol={t.symbol} kind={kindForVenue(t.venue)} initial={live[t.symbol]} metric="r" entry={t.entry} stop={t.stop} direction={t.direction} />
          : <LiveMetric key="r" symbol={t.symbol} kind={kindForVenue(t.venue)} initial={live[t.symbol]} metric="pct" entry={t.entry} direction={t.direction} />,
        <span key="s">{num(t.stop)} <span className="text-white/30">/</span> {num(t.current_stop)}</span>,
        [t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp2 ?? t.tp2, t.current_tp3 ?? t.tp3].map((x) => num(x)).join(" · "),
        t.risk_dollars != null ? <span key="r">{money(t.risk_dollars)} <span className="text-white/45">({num(t.risk_percent)}%)</span></span> : "—",
        t.venue === "blofin" ? `${money(t.position_notional)} · ${num(t.leverage)}x · m ${money(t.margin)}` : `${num(t.quantity, 4)} · ${money(t.position_value)}`,
        <Badge key="st" tone={statusTone(t.status)} dot>{t.status}</Badge>,
        <span key="o" className="whitespace-nowrap text-white/60">{when(t.opened_at)}</span>,
      ])}
      empty="No open or pending positions."
    />
  );
}
