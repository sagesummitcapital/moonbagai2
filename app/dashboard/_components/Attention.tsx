// "Needs you now" — the first thing on the leverage desk (Stavros, 2026-10-15: "anything worth my attention
// should be prominent; everything else I can expand"). Display only: every item here is built from numbers the
// page already loads. Open trades get the live rail; A+ setups not already shown in full in the A+ strip above get a small
// card with limit / stop / TP1 / TP2 and the data time; everything else is one line + a link.
import type { ReactNode } from "react";
import type { Trade } from "@/lib/moonbag/types";
import type { LivePrice as LP } from "@/lib/moonbag/prices";
import { fmtPct, fmtRR, tradeMetrics } from "@/lib/moonbag/desk";
import type { APlus } from "./Board";
import { LiveMetric, TradeRail, type Stored } from "./LivePrice";
import { Action, Badge, Card, Id, Tile, Updated, money, num, px2, whenShort } from "./ui";

export type Flag = { key: string; tone: "amber" | "red" | "cyan" | "green"; title: string; detail?: string; href?: string; hrefLabel?: string };

export function NeedsYou({ trades, live, storedFor, aplus, aplusTotal, flags, nextCheck, clocks }: {
  trades: Trade[];
  live: Record<string, LP>;
  storedFor: (asset: string) => Stored | undefined;
  aplus: APlus[];
  /** Total A+ setups on the page, when some are shown in full in the A+ strip above and not repeated here. */
  aplusTotal?: number;
  flags: Flag[];
  /** One calm line for the quiet state, e.g. "Next hourly check at :25." */
  nextCheck?: string;
  /** Per-coin data clocks (FeedStamps). Shown right under a red stale-data flag so "which coin is stale?" is answered on the spot. */
  clocks?: ReactNode;
}) {
  const total = aplusTotal ?? aplus.length;
  const quiet = !trades.length && !aplus.length && !flags.length;
  // Only the open trade is here: say so in one line, so "nothing else to do" never has to be inferred from what is missing.
  const onlyTrades = trades.length > 0 && !aplus.length && !flags.length;
  const urgent = flags.some((f) => f.tone === "amber" || f.tone === "red");
  // Red flags (stale market data — "don't trade off this page") sit ABOVE the trade tiles so the warning is never below
  // the fold on a phone; everything else keeps its place under the trades and A+ cards. Same flags, same order otherwise.
  const danger = flags.filter((f) => f.tone === "red");
  const rest = flags.filter((f) => f.tone !== "red");
  const FlagList = ({ items }: { items: Flag[] }) => (
    <div className="space-y-1.5">
      {items.map((f) => (
        <Action key={f.key} tone={f.tone} title={f.title} detail={f.detail} right={f.href ? <a href={f.href} className="inline-flex min-h-[40px] items-center text-[12.5px] font-medium text-accent-cyan hover:underline">{f.hrefLabel ?? "Open →"}</a> : undefined} />
      ))}
    </div>
  );
  return (
    <Card
      title="Needs you now"
      tone={trades.length || aplus.length ? "accent" : urgent ? "warn" : undefined}
      right={
        <>
          <Badge tone={trades.length ? "green" : "gray"} dot>{trades.length} open trade{trades.length === 1 ? "" : "s"}</Badge>
          <Badge tone={total ? "green" : "gray"} dot>{total} A+ setup{total === 1 ? "" : "s"}</Badge>
        </>
      }
    >
      {quiet ? (
        <p className="text-[14px] leading-relaxed text-white/65">{total ? "Nothing else needs you — the A+ setups are above." : "Nothing needs you right now — no open trade, no A+ setup, nothing late."} Waiting for price to reach a level is the normal state.{nextCheck ? ` ${nextCheck}` : ""}</p>
      ) : (
        <div className="space-y-3">
          {danger.length > 0 && <FlagList items={danger} />}
          {danger.length > 0 && clocks && <div className="-mt-1 px-1">{clocks}</div>}
          {trades.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {trades.map((t) => <OpenTradeTile key={t.trade_id} t={t} live={live[t.symbol]} stored={storedFor(t.symbol)} />)}
            </div>
          )}
          {aplus.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {aplus.map((a) => (
                <div key={a.key} className="min-w-0 rounded-xl border border-accent-green/30 bg-accent-green/[0.05] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green">A+</Badge>
                      <strong className="text-[15px] text-white">{a.coin} <span className={a.side === "long" ? "text-accent-green" : "text-rose-300"}>{a.side === "long" ? "▲ LONG" : "▼ SHORT"}</span></strong>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[13px] tabular-nums sm:grid-cols-4">
                    <span className="min-w-0 rounded-lg bg-black/20 px-2 py-1.5"><span className="block text-[10.5px] uppercase text-white/40">Limit</span><span className="break-words text-white">{px2(a.entry)}</span></span>
                    <span className="min-w-0 rounded-lg bg-black/20 px-2 py-1.5"><span className="block text-[10.5px] uppercase text-white/40">Stop</span><span className="break-words text-rose-300">{px2(a.stop)}</span></span>
                    <span className="min-w-0 rounded-lg bg-black/20 px-2 py-1.5"><span className="block text-[10.5px] uppercase text-white/40">TP1{a.rr == null ? "" : ` · ${a.rr.toFixed(1)}R`}</span><span className="break-words text-accent-green">{px2(a.tp1)}</span></span>
                    <span className="min-w-0 rounded-lg bg-black/20 px-2 py-1.5"><span className="block text-[10.5px] uppercase text-white/40">TP2 · runner</span><span className="break-words text-accent-green/80">{a.tp2 == null ? "—" : px2(a.tp2)}</span></span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] leading-snug text-white/50">
                    <span>{a.strategy} · {a.record}</span>
                    {a.when && <Updated label="data" at={a.when} cadenceH={12} verb="" />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {rest.length > 0 && <FlagList items={rest} />}
          {onlyTrades && (
            <p className="text-[13px] leading-snug text-white/55">Nothing else needs you — no A+ setup, nothing late. Manage the open trade and wait.{nextCheck ? ` ${nextCheck}` : ""}</p>
          )}
        </div>
      )}
    </Card>
  );
}

/** One open trade as a picture: stop → entry → target rail with the live price, R now and what is still open. */
export function OpenTradeTile({ t, live, stored }: { t: Trade; live?: LP; stored?: Stored }) {
  const m = tradeMetrics(t);
  const long = t.direction !== "short";
  const riskFree = t.direction === "short" ? Number(t.current_stop) <= Number(t.entry) : Number(t.current_stop) >= Number(t.entry);
  const stopNow = t.current_stop ?? t.stop;
  const tp1 = t.current_tp1 ?? t.tp1 ?? t.target;
  const liveProps = { symbol: t.symbol, kind: "crypto" as const, initial: live, stored };
  return (
    <Tile tone="accent">
      {/* header: coin + side, the same way the A+ and Woods tickets say it */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[16px] text-white">{t.symbol}</strong>
          <span className={`text-[13px] font-semibold ${long ? "text-accent-green" : "text-rose-300"}`}>{long ? "▲ LONG" : "▼ SHORT"}</span>
          <Badge tone="gray">{num(t.leverage, 0)}x</Badge>
          {riskFree && <Badge tone="green" dot>risk-free</Badge>}
          {t.status === "pending" && <Badge tone="amber" dot>pending fill</Badge>}
        </div>
        <span className="font-mono text-[12px] tabular-nums text-white/50">plan R:R <strong className="text-white">{fmtRR(m.rr)}</strong></span>
      </div>
      <TradeRail
        className="mt-3"
        {...liveProps}
        direction={t.direction}
        entry={t.entry}
        stop={stopNow}
        origStop={t.stop}
        target={tp1}
        qty={t.qty_open ?? t.quantity}
        equity={t.account_equity}
        plusR
      />
      {/* how far price is from the two lines that matter, live */}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11.5px] tabular-nums text-white/45">
        {stopNow != null && <span className="inline-flex items-baseline gap-1.5">stop <LiveMetric {...liveProps} metric="distPct" level={stopNow} tag={false} /></span>}
        {tp1 != null && <span className="inline-flex items-baseline gap-1.5">TP1 <LiveMetric {...liveProps} metric="distPct" level={tp1} tag={false} /></span>}
        <span className="text-white/35">from the live price</span>
      </div>
      <TradeFacts t={t} />
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 font-mono text-[11.5px] tabular-nums text-white/45">
        <span>risk {money(t.risk_dollars)} <span className="text-rose-300/80">{fmtPct(m.riskPct)}</span> / <span className="text-accent-green/80">{fmtPct(m.rewardPct)}</span> acct</span>
        <span>open {num(t.qty_open ?? t.quantity, 4)}{t.quantity ? ` (${num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)` : ""}</span>
        {Number(t.banked_pnl) ? <span className={Number(t.banked_pnl) > 0 ? "text-accent-green" : "text-rose-300"}>banked {Number(t.banked_pnl) > 0 ? "+" : ""}{money(t.banked_pnl)}</span> : null}
        <span>opened {whenShort(t.opened_at)}</span>
        <span className="text-white/35">record {whenShort(t.updated_at)}</span>
        <Id>{t.trade_id}</Id>
      </div>
    </Tile>
  );
}

/** Every number for an open leverage trade at a glance (Stavros 2026-10-16: "make sure i have all data i need to easily see
 *  where things are for a lev trade"). Display only. Liquidation is an isolated-margin estimate — BloFin's own number rules. */
function TradeFacts({ t }: { t: Trade }) {
  const sg = t.direction === "short" ? -1 : 1;
  const e = Number(t.entry), lev = Number(t.leverage);
  const liq = e > 0 && lev > 0 ? e * (1 - sg * (1 / lev - 0.005)) : null;
  const stop = Number(t.current_stop ?? t.stop);
  const liqOk = liq != null && stop > 0 ? Math.abs(e - liq) >= 1.25 * Math.abs(e - stop) : true;
  const tp1 = t.current_tp1 ?? t.tp1 ?? t.target, tp2 = t.current_tp2 ?? t.tp2, tp3 = t.current_tp3 ?? t.tp3;
  // "+1R" is one original risk past entry (the rail measures R the same way), so it stays put after the stop moves to entry.
  const stop0 = Number(t.stop);
  const risk = Math.abs(e - stop);
  const risk0 = e > 0 && stop0 > 0 ? Math.abs(e - stop0) : risk;
  const plusOneR = risk0 ? e + sg * risk0 : null;
  const rAt = (x: unknown) => (x == null || !risk ? "" : ` · ${((sg * (Number(x) - e)) / risk).toFixed(1)}R`);
  const stopMoved = stop0 > 0 && stop !== stop0;
  const openMs = t.opened_at ? Date.now() - new Date(t.opened_at).getTime() : null;
  const openFor = openMs == null ? "—" : openMs < 3600_000 ? `${Math.max(1, Math.round(openMs / 60_000))}m` : openMs < 86400_000 ? `${(openMs / 3600_000).toFixed(1)}h` : `${(openMs / 86400_000).toFixed(1)}d`;
  // Row 1 — the lines on the chart, in price order the way he reads them: stop, entry, +1R, targets.
  const levels: [string, string, string, string?][] = [
    ["Stop" + (stopMoved ? " · moved" : ""), px2(stop), "text-rose-300", stopMoved ? `was ${px2(stop0)}` : undefined],
    ["Entry", px2(t.entry), "text-white"],
    ["+1R", plusOneR == null ? "—" : px2(plusOneR), "text-white/85", "stop to entry here"],
    ["TP1", tp1 == null ? "—" : px2(tp1), "text-accent-green", tp1 == null ? undefined : rAt(tp1).replace(" · ", "")],
    ["TP2", tp2 == null ? "—" : px2(tp2), "text-accent-green", tp2 == null ? undefined : rAt(tp2).replace(" · ", "")],
    ...(tp3 != null ? ([["TP3", px2(tp3), "text-accent-green", rAt(tp3).replace(" · ", "")]] as [string, string, string, string?][]) : []),
  ];
  // Row 2 — the position itself.
  const position: [string, string, string, string?][] = [
    ["Size", t.position_notional == null ? `${num(t.qty_open ?? t.quantity, 4)}` : money(t.position_notional), "text-white"],
    ["Lev · margin", `${t.leverage == null ? "—" : `${num(t.leverage, 0)}x`} · ${t.margin == null ? "—" : money(t.margin)}`, "text-white"],
    ["Liq ≈", liq == null ? "—" : `${px2(liq)}${liqOk ? "" : " ⚠"}`, liqOk ? "text-amber-200" : "text-rose-300", liq == null ? undefined : liqOk ? "beyond 1.25× stop" : "too close to stop"],
    ["Open for", openFor, "text-white"],
  ];
  const Row = ({ cells, cols }: { cells: [string, string, string, string?][]; cols: string }) => (
    <div className={`grid gap-1.5 font-mono text-[13px] tabular-nums ${cols}`}>
      {cells.map(([k, v, c, sub]) => (
        <span key={k} className="min-w-0 rounded-lg bg-black/20 px-2 py-1.5">
          <span className="block text-[10.5px] uppercase tracking-wide text-white/40">{k}</span>
          <span className={`block break-words font-semibold leading-tight ${c}`}>{v}</span>
          {sub && <span className="block text-[10.5px] text-white/40">{sub}</span>}
        </span>
      ))}
    </div>
  );
  return (
    <div className="mt-3 space-y-1.5">
      <Row cells={levels} cols={levels.length > 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"} />
      <Row cells={position} cols="grid-cols-2 sm:grid-cols-4" />
    </div>
  );
}
