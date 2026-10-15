// "What needs my attention now" — one strip at the top of the Command tab.
// Open trades with their live R, DESK ALERTs with live distance to trigger, pending hand-offs to Grok,
// and the age of every stored record the page is drawn from. Everything here links to its tab.
import Link from "next/link";
import type { PriceMap } from "@/lib/moonbag/prices";
import type { Handoff, Trade } from "@/lib/moonbag/types";
import type { LevSignal } from "@/lib/moonbag/desk";
import { LiveMetric, TradeRail } from "./LivePrice";
import { kindFor, storedOf } from "./live";
import { Badge, Card, Id, Updated, biasGlyph, biasTone, gradeTone, num, px, whenShort } from "./ui";

const VENUE: Record<string, { label: string; href: string }> = {
  blofin: { label: "BloFin", href: "/dashboard/leverage" },
  robinhood: { label: "Robinhood", href: "/dashboard/robinhood" },
  coinbase: { label: "Coinbase", href: "/dashboard/coinbase" },
  other: { label: "Other", href: "/dashboard/positions" },
};

export type Freshness = { label: string; at: string | null | undefined; cadenceH: number; verb?: string; href?: string };

export function RightNow({ trades, alerts, handoffs, armedAlerts, live, cryptoSet, stored, freshness }: {
  trades: (Trade & { qty_open?: number | null })[];
  /** DESK ALERTs that are armed or triggered. */
  alerts: LevSignal[];
  handoffs: Handoff[];
  /** TradingView alerts live on the desk's coins. */
  armedAlerts: number;
  live: PriceMap;
  cryptoSet: Set<string>;
  /** Stored decision price per symbol (lev_hourly), for the fallback and the "at desk check" tick. */
  stored: Record<string, { price: number; ts: string }>;
  freshness: Freshness[];
}) {
  const quiet = !trades.length && !alerts.length && !handoffs.length;
  const late = freshness.filter((f) => f.at && Date.now() - new Date(f.at).getTime() > f.cadenceH * 2 * 3600_000);
  const missing = freshness.filter((f) => !f.at);
  return (
    <Card
      title="Right now"
      tone={trades.length || alerts.length ? "accent" : late.length ? "warn" : undefined}
      right={
        <>
          {trades.length > 0 && <Badge tone="green" dot>{trades.length} open trade{trades.length === 1 ? "" : "s"}</Badge>}
          {alerts.length > 0 && <Badge tone="green" dot>{alerts.length} desk alert{alerts.length === 1 ? "" : "s"}</Badge>}
          {handoffs.length > 0 && <Badge tone="cyan" dot>{handoffs.length} hand-off{handoffs.length === 1 ? "" : "s"} pending</Badge>}
          {late.length > 0 && <Badge tone="amber" dot>{late.length} feed{late.length === 1 ? "" : "s"} late</Badge>}
          <span className="text-[12px] text-white/40">{armedAlerts} TradingView alert{armedAlerts === 1 ? "" : "s"} armed</span>
        </>
      }
    >
      {quiet ? (
        <p className="text-[14px] leading-relaxed text-white/65">
          Nothing needs you right now — no open trade, no DESK ALERT, no hand-off waiting on Grok. Waiting for price to reach a level is the normal state.
          {late.length > 0 && <> <span className="text-amber-200">{late.map((f) => f.label).join(", ")} {late.length === 1 ? "is" : "are"} late.</span></>}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trades.map((t) => {
            const v = VENUE[t.venue] ?? VENUE.other;
            const kind = kindFor(t.symbol, cryptoSet);
            const st = stored[t.symbol];
            const equity = t.account_equity ?? null;
            return (
              <div key={t.trade_id} className="min-w-0 rounded-xl border border-accent-green/30 bg-accent-green/[0.04] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[14px] text-white">{t.symbol}</strong>
                    <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
                    <Badge tone="gray">{v.label}{t.leverage ? ` · ${num(t.leverage, 0)}x` : ""}</Badge>
                    {t.status === "pending" && <Badge tone="amber">pending fill</Badge>}
                  </div>
                  <Link href={v.href} className="text-[12px] text-accent-cyan hover:underline">Open →</Link>
                </div>
                <TradeRail
                  className="mt-2.5"
                  compact
                  symbol={t.symbol}
                  kind={kind}
                  initial={live[t.symbol]}
                  stored={st ? storedOf(st.price, st.ts) : undefined}
                  direction={t.direction}
                  entry={t.entry}
                  stop={t.current_stop ?? t.stop}
                  origStop={t.stop}
                  target={t.current_tp1 ?? t.tp1 ?? t.target}
                  qty={t.qty_open ?? t.quantity}
                  equity={equity}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-white/40">
                  <Id>{t.trade_id}</Id>
                  <span>· opened {whenShort(t.opened_at ?? t.created_at)}</span>
                  {t.risk_dollars != null && <span>· risk ${num(t.risk_dollars)}</span>}
                </div>
              </div>
            );
          })}

          {alerts.map((s) => {
            const st = stored[s.asset];
            const lvl = s.trigger_price ?? s.entry;
            return (
              <div key={s.signal_id} className="min-w-0 rounded-xl border border-accent-cyan/30 bg-accent-cyan/[0.04] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[14px] text-white">{s.asset}</strong>
                    <Badge tone={biasTone(s.direction)}>{biasGlyph(s.direction)} {s.direction}</Badge>
                    <Badge tone="green">DESK ALERT · {s.status}</Badge>
                    <Badge tone={gradeTone(s.confidence_grade)}>grade {s.confidence_grade} · {num(s.confidence_score, 0)}</Badge>
                  </div>
                  <Link href="/dashboard/leverage" className="text-[12px] text-accent-cyan hover:underline">Open →</Link>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12.5px]">
                  <div><div className="text-[11px] uppercase tracking-[0.1em] text-white/40">Trigger</div><div className="font-mono tabular-nums text-white">{px(lvl)}</div></div>
                  <div><div className="text-[11px] uppercase tracking-[0.1em] text-white/40">Stop · TP1</div><div className="font-mono tabular-nums"><span className="text-rose-300">{px(s.stop)}</span> <span className="text-white/30">·</span> <span className="text-accent-green">{px(s.tp1)}</span></div></div>
                  <div><div className="text-[11px] uppercase tracking-[0.1em] text-white/40">To trigger</div><LiveMetric symbol={s.asset} kind={kindFor(s.asset, cryptoSet)} initial={live[s.asset]} stored={st ? storedOf(st.price, st.ts) : undefined} metric="distPct" level={lvl} /></div>
                </div>
                {s.trigger_condition && <p className="mt-2 text-[12.5px] leading-snug text-white/65">{s.trigger_condition}</p>}
                <div className="mt-1.5 text-[11.5px] text-white/40"><Id>{s.signal_id}</Id>{s.expires_at ? <> · expires {whenShort(s.expires_at)}</> : null}</div>
              </div>
            );
          })}

          {handoffs.length > 0 && (
            <div className="min-w-0 rounded-xl border border-white/[0.1] bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11.5px] uppercase tracking-[0.14em] text-white/45">Waiting on Grok</div>
                <Link href="/dashboard/opportunities" className="text-[12px] text-accent-cyan hover:underline">Open →</Link>
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {handoffs.slice(0, 6).map((h) => (
                  <li key={h.handoff_id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="text-white">{h.symbol}</strong>
                    <Badge tone={biasTone(h.direction)}>{biasGlyph(h.direction)} {h.direction}</Badge>
                    <Badge tone="gray">{VENUE[h.broker]?.label ?? h.broker}</Badge>
                    <Badge tone={h.status === "pending" ? "amber" : "cyan"} dot>{h.status}</Badge>
                    <span className="text-[11.5px] text-white/40">{whenShort(h.created_at)}</span>
                  </li>
                ))}
                {handoffs.length > 6 && <li className="text-[12px] text-white/40">+{handoffs.length - 6} more on the Opportunities tab</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* how old is what you are looking at — one tap away unless something is late */}
      <details open={late.length > 0} className="group mt-4 border-t border-white/[0.06] pt-2.5">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40 hover:text-white/70 [&::-webkit-details-marker]:hidden">
          <span className="uppercase tracking-[0.14em]">Data age</span>
          <span className={late.length ? "text-amber-200" : "text-white/40"}>
            {late.length ? `${late.length} late` : missing.length === freshness.length ? "no records yet" : "all feeds on time"}
          </span>
          <span className="ml-auto group-open:hidden">show ▾</span>
          <span className="ml-auto hidden group-open:inline">hide ▴</span>
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {freshness.map((f) => (
            f.href ? (
              <Link key={f.label} href={f.href} className="hover:underline"><Updated label={f.label} at={f.at} cadenceH={f.cadenceH} verb={f.verb ?? "updated"} /></Link>
            ) : (
              <Updated key={f.label} label={f.label} at={f.at} cadenceH={f.cadenceH} verb={f.verb ?? "updated"} />
            )
          ))}
        </div>
      </details>
    </Card>
  );
}
