// The top of the leverage desk (Stavros, 2026-10-15): the $10M goal bar and today's open plan.
import type { OpenPlan as Plan, OpenRecord } from "@/lib/moonbag/openPlan";
import { GOAL_TICKS, goalPct } from "@/lib/moonbag/openPlan";
import { Badge, Card, px2, whenShort } from "./ui";

const usd0 = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const short$ = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : v >= 1e3 ? `$${v / 1e3}k` : `$${v}`);
const biasTone = (b?: string | null) => (b === "long" ? "green" : b === "short" ? "red" : "gray");
const biasWord = (b?: string | null) => (b === "long" ? "▲ LONG" : b === "short" ? "▼ SHORT" : "◆ NEUTRAL");

export function GoalBar({ total, blofin, coinbase, robinhood, pnlBlofin, deposits }: {
  total: number; blofin: number; coinbase: number; robinhood: number; pnlBlofin: number; deposits: number;
}) {
  const x = goalPct(total);
  const pctOfGoal = (total / 10_000_000) * 100;
  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">Goal · $10,000,000</span>
        <strong className="font-mono text-[20px] tabular-nums text-white">{usd0(total)}</strong>
        <span className="text-[12px] text-white/50">{pctOfGoal < 0.01 ? pctOfGoal.toFixed(4) : pctOfGoal.toFixed(2)}% of the goal · all three accounts</span>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-accent-cyan/70 to-accent-green" style={{ width: `${Math.max(1, x)}%` }} />
        {GOAL_TICKS.map((t) => (
          <div key={t} className="absolute -top-1 h-5 w-px bg-white/30" style={{ left: `${goalPct(t)}%` }} />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 font-mono text-[11px] tabular-nums text-white/45">
        <span className="absolute left-0">$100</span>
        {GOAL_TICKS.map((t) => (
          <span key={t} className={`absolute -translate-x-1/2 ${total >= t ? "text-accent-green" : ""}`} style={{ left: `${Math.min(97, goalPct(t))}%` }}>{short$(t)}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55">
        <span>BloFin <b className="font-mono text-white/85">{usd0(blofin)}</b> <span className={pnlBlofin >= 0 ? "text-accent-green" : "text-rose-300"}>({pnlBlofin >= 0 ? "+" : "−"}{usd0(Math.abs(pnlBlofin))} trading{deposits ? `, ${usd0(deposits)} deposited` : ""})</span></span>
        <span>Coinbase <b className="font-mono text-white/85">{usd0(coinbase)}</b></span>
        <span>Robinhood <b className="font-mono text-white/85">{usd0(robinhood)}</b></span>
        <span className="text-white/35">log scale — each tick is 10×</span>
      </div>
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
  return (
    <Card
      tone={plan.red_day ? "warn" : "accent"}
      title={<>{isToday ? "Today's open plan" : `Last open plan · ${plan.plan_date}`}</>}
      sub={plan.headline ?? undefined}
      right={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={biasTone(plan.market_bias)}>{biasWord(plan.market_bias)}</Badge>
          {plan.confidence != null && <Badge tone={plan.confidence >= 70 ? "green" : plan.confidence >= 55 ? "cyan" : "gray"}>{plan.confidence}% confidence</Badge>}
          {plan.red_day && <Badge tone="amber" dot>red-folder day · half risk below A+</Badge>}
        </div>
      }
    >
      {plan.thesis && <p className="text-[13.5px] leading-relaxed text-white/80">{plan.thesis}</p>}
      {plan.events && <p className="mt-1 text-[12px] text-white/50">Data today: {plan.events}</p>}

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {plan.coins.map((c) => (
          <div key={c.coin} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[15px] text-white">{c.coin}</strong>
              {c.price != null && <span className="font-mono text-[13px] tabular-nums text-white/80">{px2(c.price)}</span>}
              <Badge tone={biasTone(c.bias)}>{biasWord(c.bias)}</Badge>
              {c.confidence != null && <span className="ml-auto text-[11.5px] text-white/45">{c.confidence}%</span>}
            </div>
            {c.plan && c.plan.length > 0 && (
              <div className="mt-2 space-y-0.5 text-[12.5px] leading-snug text-white/85">
                {c.plan.map((l) => <div key={l}>{l}</div>)}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[11.5px] tabular-nums text-white/55">
              {c.overnight_high != null && <span>O/N high <span className="text-rose-300">{px2(c.overnight_high)}</span></span>}
              {c.overnight_low != null && <span>O/N low <span className="text-accent-green">{px2(c.overnight_low)}</span></span>}
              {c.pdh != null && <span>Prev high <span className="text-rose-300">{px2(c.pdh)}</span></span>}
              {c.pdl != null && <span>Prev low <span className="text-accent-green">{px2(c.pdl)}</span></span>}
            </div>
            {(c.long_plan || c.short_plan) && (
              <div className="mt-2 space-y-0.5 text-[12px] text-white/65">
                {c.long_plan && <div><span className="text-accent-green">▲</span> {c.long_plan}</div>}
                {c.short_plan && <div><span className="text-rose-300">▼</span> {c.short_plan}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {plan.open_strategy && (
        <div className="mt-3 rounded-xl border border-accent-cyan/30 bg-accent-cyan/[0.05] p-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-accent-cyan">At the open</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/90">{plan.open_strategy}</p>
          {plan.no_trade_if && <p className="mt-1 text-[12.5px] text-white/60">No trade if: {plan.no_trade_if}</p>}
        </div>
      )}

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
            <div key={p.name} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[12px]">
              <span className="text-white/85">{p.name}</span> {p.status && <Badge tone={p.status === "live" ? "green" : p.status === "paper" ? "cyan" : "gray"}>{p.status}</Badge>}
              {p.record && <div className="text-white/50">{p.record}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.06] pt-2 text-[12px] text-white/50">
        <span>Plan record (30d): bias right <b className="text-white/80">{record?.bias_hit_pct_30d == null ? "—" : `${record.bias_hit_pct_30d}%`}</b> · avg grade <b className="text-white/80">{record?.avg_grade_30d ?? "—"}</b> · {record?.graded ?? 0} graded</span>
        <span>Open Drive paper: <b className="text-white/80">{record?.drive_trades ?? 0}</b> trades{record?.drive_avg_r != null ? ` · ${Number(record.drive_avg_r).toFixed(2)}R avg` : ""}</span>
        {plan.lesson && <span>Yesterday's lesson: <span className="text-white/75">{plan.lesson}</span></span>}
        <span className="text-white/35">Analysis only — you place every order.</span>
      </div>
    </Card>
  );
}
