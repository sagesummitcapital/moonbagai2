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
import { Action, Badge, Id, Ticket, TicketField, TicketFoot, TicketHead, TicketRow, Updated, ago, money, num, px2, whenShort } from "./ui";

export type Flag = { key: string; tone: "amber" | "red" | "cyan" | "green"; title: string; detail?: string; href?: string; hrefLabel?: string };

/** What the desk already knows, handed over as finished values for the status read at the top of the page. Display only:
 *  every field is a flag or a number the leverage page already loads or already prints somewhere else on the page. */
export type DeskState = {
  /** feedHealth() verdict for the BloFin bars. */
  feedTone?: string | null;
  /** Sweep machine: sides not blocked / all sides / unblocked sides with a trigger, and when it last scanned. */
  sweepLive: number; sweepTotal: number; sweepTriggers: number; scanAt?: string | null;
  /** Your own resting limits, and how many limits (yours or paper) were touched. */
  yourLimits: number; touched: number;
  /** Open risk in dollars and the 2% day stop in dollars — the same two figures as the account card. */
  openRisk: number; dayStop: number;
  windowOpen?: boolean;
};

const VERDICT = {
  red: { dot: "bg-rose-400 motion-safe:animate-pulse-dot", text: "text-rose-200", bar: "bg-rose-400" },
  green: { dot: "bg-accent-green motion-safe:animate-pulse-dot", text: "text-white", bar: "bg-accent-green" },
  ready: { dot: "bg-accent-green", text: "text-white", bar: "bg-accent-green" },
  amber: { dot: "bg-amber-300", text: "text-amber-100", bar: "bg-amber-300" },
  gray: { dot: "bg-white/30", text: "text-white/85", bar: "bg-white/20" },
} as const;

/** One instrument on the status row: label, figure, one line under it. */
function Gauge({ k, v, sub, cls = "text-white" }: { k: string; v: ReactNode; sub?: ReactNode; cls?: string }) {
  return (
    <div className="min-w-0 border-l border-white/[0.08] pl-3 first:border-l-0 first:pl-0 max-sm:[&:nth-child(odd)]:border-l-0 max-sm:[&:nth-child(odd)]:pl-0">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">{k}</div>
      <div className={`fig mt-1 font-mono text-[20px] font-semibold leading-none ${cls}`}>{v}</div>
      {sub && <div className="mt-1 text-[11.5px] leading-snug text-white/45">{sub}</div>}
    </div>
  );
}

export function NeedsYou({ trades, live, storedFor, aplus, aplusTotal, flags, nextCheck, clocks, desk }: {
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
  /** The desk's state for the 3-second read at the top of the card. Without it the card keeps its plain title. */
  desk?: DeskState;
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
  // The 3-second read. It only names the state the page is already in — the first of these that is true, most serious
  // first — and decides nothing: the flags, tiles and tickets below are unchanged and still carry the detail.
  const s = desk;
  const stale = s?.feedTone === "red" || danger.length > 0;
  const verdict: { tone: keyof typeof VERDICT; head: string; sub: string } = stale
    ? { tone: "red", head: "Data is stale — don't trade", sub: "The market data on this page is behind. Wait for the clocks to turn green before placing or moving anything." }
    : trades.length
      ? { tone: "green", head: `${trades.length} open trade${trades.length === 1 ? "" : "s"} — manage ${trades.length === 1 ? "it" : "them"}`, sub: "Stop, entry, targets and the live price are in the ticket below." }
      : s && s.touched > 0
        ? { tone: "amber", head: `${s.touched} limit${s.touched === 1 ? "" : "s"} touched — check BloFin`, sub: "Price reached a limit. Confirm on BloFin whether it filled, then tell Grok." }
        : s && s.sweepTriggers > 0
          ? { tone: "ready", head: "Sweep trigger — ticket ready", sub: "The Sweep machine has all four steps on a side. The ticket is in the Sweep machine card below." }
          : total > 0
            ? { tone: "ready", head: `${total} A+ setup${total === 1 ? "" : "s"} ready to place`, sub: "Limit, stop and both targets are in the ticket below. You place every order." }
            : { tone: "gray", head: "Nothing to place — stand down", sub: s ? `No open trade and no A+ setup${s.sweepTotal ? `; the Sweep machine has ${s.sweepLive} of ${s.sweepTotal} sides tradable` : ""}. No trade is the default.` : "No open trade and no A+ setup. No trade is the default." };
  const v = VERDICT[verdict.tone];
  const ring = stale ? "border-rose-400/30 bg-rose-400/[0.04]" : trades.length || aplus.length ? "border-accent-green/25 bg-accent-green/[0.035]" : urgent ? "border-amber-300/25 bg-amber-300/[0.035]" : "border-white/[0.06] bg-white/[0.025]";
  return (
    <section className={`min-w-0 rounded-2xl border p-4 md:p-5 ${ring}`}>
      <div className="mb-4">
        <div className="flex gap-3">
          <span className={`w-[3px] shrink-0 self-stretch rounded-full ${v.bar}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/45">Needs you now</h2>
              {s && <span className="font-mono text-[11.5px] tabular-nums text-white/40">{s.windowOpen ? "trading hours" : "outside trading hours"}</span>}
            </div>
            <p className={`mt-1.5 flex items-center gap-2.5 text-[21px] font-semibold leading-tight tracking-tight sm:text-[24px] ${v.text}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${v.dot}`} aria-hidden />
              <span className="min-w-0">{verdict.head}</span>
            </p>
            <p className="mt-1 max-w-[70ch] text-[13px] leading-snug text-white/55">{verdict.sub}</p>
          </div>
        </div>
        {s ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-white/[0.06] pt-3.5 sm:grid-cols-4">
              <Gauge k="In the market" v={trades.length} cls={trades.length ? "text-accent-green" : "text-white/60"} sub={trades.length ? <>open risk <span className="font-mono tabular-nums text-white/75">{money(s.openRisk)}</span></> : "no open trade"} />
              <Gauge k="Ready to place" v={total} cls={total ? "text-accent-green" : "text-white/60"} sub={<>A+ setup{total === 1 ? "" : "s"}{s.sweepTotal ? <> · Sweep machine {s.sweepLive} of {s.sweepTotal} sides tradable</> : null}{s.scanAt ? <span className="block font-mono tabular-nums text-white/40">scan {whenShort(s.scanAt)} ({ago(s.scanAt)})</span> : null}</>} />
              <Gauge k="Resting limits" v={s.yourLimits} cls={s.touched ? "text-amber-200" : s.yourLimits ? "text-accent-cyan" : "text-white/60"} sub={s.touched ? `${s.touched} touched — filled?` : s.yourLimits ? "yours, working on BloFin" : "none of yours"} />
              <Gauge k="Day stop · 2%" v={money(s.dayStop)} cls="text-rose-300" sub="lose this today = done · two losses = done" />
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-white/50">
            <Badge tone={trades.length ? "green" : "gray"} dot>{trades.length} open trade{trades.length === 1 ? "" : "s"}</Badge>
            <Badge tone={total ? "green" : "gray"} dot>{total} A+ setup{total === 1 ? "" : "s"}</Badge>
          </div>
        )}
      </div>
      {quiet ? (
        <p className="text-[13px] leading-relaxed text-white/55">{total ? "Nothing else needs you — the A+ setups are above." : "Nothing is late."} Waiting for price to reach a level is the normal state.{nextCheck ? ` ${nextCheck}` : ""}</p>
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
            <div className="grid gap-3 md:grid-cols-2">
              {aplus.map((a) => (
                <Ticket key={a.key} tone="ready">
                  <TicketHead coin={a.coin} side={a.side} right={a.rr == null ? undefined : <span>plan R:R <strong className="text-white">{fmtRR(a.rr)}</strong></span>}>
                    <Badge tone="green">A+</Badge>
                  </TicketHead>
                  <TicketRow className="mt-3" label="Order">
                    <TicketField k={a.side === "long" ? "Buy limit" : "Sell limit"} v={px2(a.entry)} />
                    <TicketField k="Stop loss" v={px2(a.stop)} cls="text-rose-300" />
                    <TicketField k="TP1" v={px2(a.tp1)} sub={a.rr == null ? undefined : `${a.rr.toFixed(1)}R`} cls="text-accent-green" />
                    <TicketField k="TP2 · runner" v={a.tp2 == null ? "—" : px2(a.tp2)} cls="text-accent-green" />
                  </TicketRow>
                  <TicketFoot>
                    {a.when && <Updated label="data" at={a.when} cadenceH={12} verb="" />}
                    <span className="font-sans text-white/50">{a.strategy} · {a.record}</span>
                  </TicketFoot>
                </Ticket>
              ))}
            </div>
          )}
          {rest.length > 0 && <FlagList items={rest} />}
          {onlyTrades && (
            <p className="text-[13px] leading-snug text-white/55">Nothing else needs you — no A+ setup, nothing late. Manage the open trade and wait.{nextCheck ? ` ${nextCheck}` : ""}</p>
          )}
        </div>
      )}
    </section>
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
    <Ticket tone="live">
      {/* header: coin + side, the same header every ticket on the desk uses */}
      <TicketHead coin={t.symbol} side={long ? "long" : "short"} right={<span>plan R:R <strong className="text-white">{fmtRR(m.rr)}</strong></span>}>
        <Badge tone="gray">{num(t.leverage, 0)}x</Badge>
        {riskFree && <Badge tone="green" dot>risk-free</Badge>}
        {t.status === "pending" && <Badge tone="amber" dot>pending fill</Badge>}
      </TicketHead>
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
      <TicketFoot>
        <span>risk {money(t.risk_dollars)} <span className="text-rose-300/80">{fmtPct(m.riskPct)}</span> / <span className="text-accent-green/80">{fmtPct(m.rewardPct)}</span> acct</span>
        <span>open {num(t.qty_open ?? t.quantity, 4)}{t.quantity ? ` (${num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)` : ""}</span>
        {Number(t.banked_pnl) ? <span className={Number(t.banked_pnl) > 0 ? "text-accent-green" : "text-rose-300"}>banked {Number(t.banked_pnl) > 0 ? "+" : ""}{money(t.banked_pnl)}</span> : null}
        <span>opened {whenShort(t.opened_at)}</span>
        <span className="text-white/35">record {whenShort(t.updated_at)}</span>
        <Id>{t.trade_id}</Id>
      </TicketFoot>
    </Ticket>
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
  const cells = (rows: [string, string, string, string?][]) => rows.map(([k, v, c, sub]) => <TicketField key={k} k={k} v={v} cls={c} sub={sub} />);
  return (
    <div className="mt-3 space-y-3">
      <TicketRow label="Levels" cols={levels.length > 5 ? 6 : 5}>{cells(levels)}</TicketRow>
      <TicketRow label="Position" cols={4}>{cells(position)}</TicketRow>
    </div>
  );
}
