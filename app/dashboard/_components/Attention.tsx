// "Needs you now" — the first thing on the leverage desk (Stavros, 2026-10-15: "anything worth my attention
// should be prominent; everything else I can expand"). Display only: every item here is built from numbers the
// page already loads. Open trades get the live rail; A+ setups not already shown in full in the A+ strip above get a small
// card with limit / stop / TP1 / TP2 and the data time; everything else is one line + a link.
import type { Trade } from "@/lib/moonbag/types";
import type { LivePrice as LP } from "@/lib/moonbag/prices";
import { fmtPct, fmtRR, tradeMetrics } from "@/lib/moonbag/desk";
import type { APlus } from "./Board";
import { TradeRail, type Stored } from "./LivePrice";
import { Action, Badge, Card, Id, Tile, Updated, biasGlyph, biasTone, money, num, px2, whenShort } from "./ui";

export type Flag = { key: string; tone: "amber" | "red" | "cyan" | "green"; title: string; detail?: string; href?: string; hrefLabel?: string };

export function NeedsYou({ trades, live, storedFor, aplus, aplusTotal, flags, nextCheck }: {
  trades: Trade[];
  live: Record<string, LP>;
  storedFor: (asset: string) => Stored | undefined;
  aplus: APlus[];
  /** Total A+ setups on the page, when some are shown in full in the A+ strip above and not repeated here. */
  aplusTotal?: number;
  flags: Flag[];
  /** One calm line for the quiet state, e.g. "Next hourly check at :25." */
  nextCheck?: string;
}) {
  const total = aplusTotal ?? aplus.length;
  const quiet = !trades.length && !aplus.length && !flags.length;
  const urgent = flags.some((f) => f.tone === "amber" || f.tone === "red");
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
          {flags.length > 0 && (
            <div className="space-y-1.5">
              {flags.map((f) => (
                <Action key={f.key} tone={f.tone} title={f.title} detail={f.detail} right={f.href ? <a href={f.href} className="text-[12.5px] font-medium text-accent-cyan hover:underline">{f.hrefLabel ?? "Open →"}</a> : undefined} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** One open trade as a picture: stop → entry → target rail with the live price, R now and what is still open. */
export function OpenTradeTile({ t, live, stored }: { t: Trade; live?: LP; stored?: Stored }) {
  const m = tradeMetrics(t);
  const riskFree = t.direction === "short" ? Number(t.current_stop) <= Number(t.entry) : Number(t.current_stop) >= Number(t.entry);
  return (
    <Tile tone="accent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="text-[15px] text-white">{t.symbol}</strong>
          <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
          <Badge tone="gray">{num(t.leverage, 0)}x</Badge>
          {riskFree && <Badge tone="green">risk-free</Badge>}
          {t.status === "pending" && <Badge tone="amber">pending fill</Badge>}
        </div>
        <span className="font-mono text-[12px] text-white/50">plan R:R <strong className="text-white">{fmtRR(m.rr)}</strong></span>
      </div>
      <TradeRail
        className="mt-3"
        symbol={t.symbol}
        kind="crypto"
        initial={live}
        stored={stored}
        direction={t.direction}
        entry={t.entry}
        stop={t.current_stop ?? t.stop}
        origStop={t.stop}
        target={t.current_tp1 ?? t.tp1 ?? t.target}
        qty={t.qty_open ?? t.quantity}
        equity={t.account_equity}
      />
      <TradeFacts t={t} />
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px] tabular-nums text-white/45">
        <span>risk {money(t.risk_dollars)} <span className="text-rose-300/80">{fmtPct(m.riskPct)}</span> / <span className="text-accent-green/80">{fmtPct(m.rewardPct)}</span> acct</span>
        <span>open {num(t.qty_open ?? t.quantity, 4)}{t.quantity ? ` (${num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)` : ""}</span>
        {Number(t.banked_pnl) ? <span className={Number(t.banked_pnl) > 0 ? "text-accent-green" : "text-rose-300"}>banked {Number(t.banked_pnl) > 0 ? "+" : ""}{money(t.banked_pnl)}</span> : null}
        <span>opened {whenShort(t.opened_at)}</span>
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
  const tp1 = t.current_tp1 ?? t.tp1 ?? t.target, tp2 = t.current_tp2 ?? t.tp2;
  const risk = Math.abs(e - stop);
  const rAt = (x: unknown) => (x == null || !risk ? "" : ` · ${((sg * (Number(x) - e)) / risk).toFixed(1)}R`);
  const openMs = t.opened_at ? Date.now() - new Date(t.opened_at).getTime() : null;
  const openFor = openMs == null ? "—" : openMs < 3600_000 ? `${Math.max(1, Math.round(openMs / 60_000))}m` : openMs < 86400_000 ? `${(openMs / 3600_000).toFixed(1)}h` : `${(openMs / 86400_000).toFixed(1)}d`;
  const cells: [string, string, string][] = [
    ["Entry", px2(t.entry), "text-white"],
    ["Stop", px2(stop), "text-rose-300"],
    ["TP1", tp1 == null ? "—" : `${px2(tp1)}${rAt(tp1)}`, "text-accent-green"],
    ["TP2", tp2 == null ? "—" : `${px2(tp2)}${rAt(tp2)}`, "text-accent-green"],
    ["Size", t.position_notional == null ? `${num(t.qty_open ?? t.quantity, 4)}` : money(t.position_notional), "text-white"],
    ["Lev · margin", `${t.leverage == null ? "—" : `${num(t.leverage, 0)}x`} · ${t.margin == null ? "—" : money(t.margin)}`, "text-white"],
    ["Liq ≈", liq == null ? "—" : `${px2(liq)}${liqOk ? "" : " ⚠"}`, liqOk ? "text-amber-200" : "text-rose-300"],
    ["Open for", openFor, "text-white"],
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[13px] tabular-nums sm:grid-cols-4">
      {cells.map(([k, v, c]) => (
        <span key={k} className="min-w-0"><span className="block text-[10.5px] uppercase tracking-wide text-white/40">{k}</span><span className={`break-words ${c}`}>{v}</span></span>
      ))}
    </div>
  );
}
