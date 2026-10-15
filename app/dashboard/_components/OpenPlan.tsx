// The top of the leverage desk (Stavros, 2026-10-15): today's open plan and the $10M goal bar.
// Redesigned for a glance: bias + confidence + the one instruction for the open are the loud part;
// per-coin levels, the Open Drive check, the playbook and the plan's record fold away underneath.
import type { OpenPlan as Plan, OpenRecord } from "@/lib/moonbag/openPlan";
import { GOAL_TICKS, goalPct } from "@/lib/moonbag/openPlan";
import { Badge, Card, Expander, LongText, px2, whenShort } from "./ui";

const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const short$ = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : v >= 1e3 ? `$${v / 1e3}k` : `$${v}`);
const biasText = (b?: string | null) => (b === "long" ? "text-accent-green" : b === "short" ? "text-rose-300" : "text-white/70");
const biasWord = (b?: string | null) => (b === "long" ? "▲ LONG" : b === "short" ? "▼ SHORT" : "◆ NEUTRAL");

/**
 * The $10M goal. `compact` is the leverage-desk version: one thin bar and one line, with the account
 * breakdown one tap away — motivating, not dominant.
 */
export function GoalBar({ total, blofin, coinbase, robinhood, pnlBlofin, deposits, compact = false }: {
  total: number; blofin: number; coinbase: number; robinhood: number; pnlBlofin: number; deposits: number; compact?: boolean;
}) {
  const x = goalPct(total);
  const pctOfGoal = (total / 10_000_000) * 100;
  const pctText = `${pctOfGoal < 0.01 ? pctOfGoal.toFixed(4) : pctOfGoal.toFixed(2)}%`;
  const breakdown = (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55">
      <span>BloFin <b className="font-mono text-white/85">{usd0(blofin)}</b> <span className={pnlBlofin >= 0 ? "text-accent-green" : "text-rose-300"}>({pnlBlofin >= 0 ? "+" : "−"}{usd0(Math.abs(pnlBlofin))} trading{deposits ? `, ${usd0(deposits)} deposited` : ""})</span></span>
      <span>Coinbase <b className="font-mono text-white/85">{usd0(coinbase)}</b></span>
      <span>Robinhood <b className="font-mono text-white/85">{usd0(robinhood)}</b></span>
      <span className="text-white/35">log scale — each tick is 10×</span>
    </div>
  );
  const bar = (
    <>
      <div className="relative h-2 rounded-full bg-white/[0.07]" role="img" aria-label={`${usd0(total)} of $10,000,000 — ${pctText}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-accent-cyan/70 to-accent-green" style={{ width: `${Math.max(1, x)}%` }} />
        {GOAL_TICKS.map((t) => (
          <div key={t} className="absolute -top-1 h-4 w-px bg-white/25" style={{ left: `${goalPct(t)}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10.5px] tabular-nums text-white/40">
        <span className="absolute left-0">$100</span>
        {GOAL_TICKS.map((t) => (
          <span key={t} className={`absolute -translate-x-1/2 ${total >= t ? "text-accent-green" : ""}`} style={{ left: `${Math.min(97, goalPct(t))}%` }}>{short$(t)}</span>
        ))}
      </div>
    </>
  );
  if (compact) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[11.5px] uppercase tracking-[0.14em] text-white/45">Goal · $10M</span>
          <span className="text-[12.5px] text-white/60"><b className="font-mono tabular-nums text-white">{usd0(total)}</b> · {pctText} · all three accounts</span>
        </div>
        <div className="mt-2">{bar}</div>
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-[12px] text-white/40 hover:text-white/70 [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">by account ▾</span><span className="hidden group-open:inline">by account ▴</span></summary>
          <div className="mt-1.5">{breakdown}</div>
        </details>
      </div>
    );
  }
  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Goal · $10,000,000</span>
        <strong className="font-mono text-[20px] tabular-nums text-white">{usd0(total)}</strong>
        <span className="text-[12px] text-white/50">{pctText} of the goal · all three accounts</span>
      </div>
      <div className="mt-3">{bar}</div>
      <div className="mt-2">{breakdown}</div>
    </Card>
  );
}

export function OpenPlanCard({ plan, record, isToday }: { plan: Plan | null; record: OpenRecord | null; isToday: boolean }) {
  if (!plan) {
    return (
      <Card title="Today's open plan" sub="Written every weekday before the US open (6:30 AM Phoenix) for BTC, ETH and SOL.">
        <p className="text-[13px] text-white/60">The first plan is written by the morning routine at 5:15 AM Phoenix on the next weekday.</p>
      </Card>
    );
  }
  const confTone = plan.confidence == null ? "gray" : plan.confidence >= 70 ? "green" : plan.confidence >= 55 ? "cyan" : "gray";
  return (
    <Card
      tone={plan.red_day ? "warn" : undefined}
      title={isToday ? "Today's open plan" : `Last open plan · ${plan.plan_date}`}
      right={
        <>
          {plan.red_day && <Badge tone="amber" dot>red-folder day · half risk below A+</Badge>}
          {!isToday && <Badge tone="amber">not today&apos;s</Badge>}
        </>
      }
    >
      {/* the loud part: bias, confidence, headline */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className={`font-mono text-[26px] font-semibold leading-none tracking-tight md:text-[30px] ${biasText(plan.market_bias)}`}>{biasWord(plan.market_bias)}</div>
          {plan.headline && <p className="mt-2 max-w-[60ch] text-[15px] font-medium leading-snug text-white/90">{plan.headline}</p>}
        </div>
        {plan.confidence != null && (
          <div className="shrink-0 text-right">
            <div className="text-[11.5px] uppercase tracking-[0.14em] text-white/45">Confidence</div>
            <div className={`mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums ${confTone === "green" ? "text-accent-green" : confTone === "cyan" ? "text-accent-cyan" : "text-white/70"}`}>{plan.confidence}<span className="text-[13px] font-normal text-white/40">%</span></div>
          </div>
        )}
      </div>

      {/* the one instruction */}
      {plan.open_strategy && (
        <div className="mt-4 rounded-xl border border-accent-cyan/25 bg-accent-cyan/[0.05] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-accent-cyan">At the open</div>
          <p className="mt-1 text-[14.5px] leading-relaxed text-white">{plan.open_strategy}</p>
          {plan.no_trade_if && <p className="mt-1.5 text-[12.5px] text-white/60"><span className="text-white/45">No trade if:</span> {plan.no_trade_if}</p>}
        </div>
      )}

      {/* the coins: bias, the plan lines, both limits */}
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {plan.coins.map((c) => (
          <div key={c.coin} className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <strong className="text-[15px] text-white">{c.coin}</strong>
              {c.price != null && <span className="font-mono text-[13px] tabular-nums text-white/70">{px2(c.price)}</span>}
              <span className={`ml-auto font-mono text-[12px] font-semibold ${biasText(c.bias)}`}>{biasWord(c.bias)}{c.confidence != null && <span className="ml-1 font-normal text-white/40">{c.confidence}%</span>}</span>
            </div>
            {c.plan && c.plan.length > 0 && (
              <div className="mt-2 space-y-0.5 text-[12.5px] leading-snug text-white/85">
                {c.plan.map((l) => <div key={l}>{l}</div>)}
              </div>
            )}
            {(c.long_plan || c.short_plan) && (
              <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2 text-[12.5px] text-white/75">
                {c.long_plan && <div className="flex gap-1.5"><span className="shrink-0 text-accent-green">▲</span><span>{c.long_plan}</span></div>}
                {c.short_plan && <div className="flex gap-1.5"><span className="shrink-0 text-rose-300">▼</span><span>{c.short_plan}</span></div>}
              </div>
            )}
            {(c.overnight_high != null || c.overnight_low != null || c.pdh != null || c.pdl != null) && (
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[11px] tabular-nums text-white/45">
                {c.overnight_high != null && <span>O/N high <span className="text-rose-300/90">{px2(c.overnight_high)}</span></span>}
                {c.overnight_low != null && <span>O/N low <span className="text-accent-green/90">{px2(c.overnight_low)}</span></span>}
                {c.pdh != null && <span>Prev high <span className="text-rose-300/90">{px2(c.pdh)}</span></span>}
                {c.pdl != null && <span>Prev low <span className="text-accent-green/90">{px2(c.pdl)}</span></span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* the why, the checks and the record — one tap away */}
      <Expander
        className="mt-3"
        summary={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-white/80">Why, Open Drive check, playbook &amp; record</span>
            <span className="text-[12px] text-white/45">
              bias right {record?.bias_hit_pct_30d == null ? "—" : `${record.bias_hit_pct_30d}%`} (30d) · avg grade {record?.avg_grade_30d ?? "—"} · {record?.graded ?? 0} graded
            </span>
          </span>
        }
      >
        {plan.thesis && <LongText text={plan.thesis} label="Why:" max={220} className="text-[13.5px] leading-relaxed text-white/80" />}
        {plan.events && <p className="mt-1.5 text-[12.5px] text-white/55"><span className="text-white/45">Data today:</span> {plan.events}</p>}

        {plan.drive && plan.drive.length > 0 && (
          <div className="mt-3 text-[12.5px] text-white/75">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Open Drive check{plan.drive_checked_at ? ` · ${whenShort(plan.drive_checked_at)}` : ""}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {plan.drive.map((d) => (
                <Badge key={d.coin} tone={d.fired ? (d.side === "long" ? "green" : "red") : "gray"}>
                  {d.coin} {d.fired ? `${d.side?.toUpperCase()} @ ${px2(d.entry)} · SL ${px2(d.stop)} · TP ${px2(d.tp)}` : `no drive (${d.move_atr == null ? "—" : d.move_atr.toFixed(2)} ATR)`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {plan.playbook.length > 0 && (
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {plan.playbook.map((p) => (
              <div key={p.name} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[12px]">
                <span className="text-white/85">{p.name}</span> {p.status && <Badge tone={p.status === "live" ? "green" : p.status === "paper" ? "cyan" : "gray"}>{p.status}</Badge>}
                {p.record && <div className="text-white/50">{p.record}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-2 text-[12px] text-white/50">
          <span>Plan record (30d): bias right <b className="text-white/80">{record?.bias_hit_pct_30d == null ? "—" : `${record.bias_hit_pct_30d}%`}</b> · avg grade <b className="text-white/80">{record?.avg_grade_30d ?? "—"}</b> · {record?.graded ?? 0} graded</span>
          <span>Open Drive paper: <b className="text-white/80">{record?.drive_trades ?? 0}</b> trades{record?.drive_avg_r != null ? ` · ${Number(record.drive_avg_r).toFixed(2)}R avg` : ""}</span>
          {plan.lesson && <span>Yesterday&apos;s lesson: <span className="text-white/75">{plan.lesson}</span></span>}
          <span className="text-white/35">Analysis only — you place every order.</span>
        </div>
      </Expander>
    </Card>
  );
}
