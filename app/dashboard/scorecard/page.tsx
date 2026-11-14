import Link from "next/link";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, PageHeader, Stamps, Updated, whenShort } from "../_components/ui";
import { clean, getScorecard, rr, usd } from "@/lib/moonbag/site";
import { PRE_TRADE_CHECKLIST } from "@/lib/moonbag/propPlan";

export const dynamic = "force-dynamic";

/**
 * SCORECARD (CR-78, Stavros 2026-11-13): "tracking against my metrics ... you keep my emotions in check, help me keep my rules ...
 * journal so i dont repeat mistakes". His numbers, his rules and whether he kept them, the habits that cost money, the latest lessons.
 */
const tone = (v: number | null | undefined) => (v == null || v === 0 ? "text-white" : v > 0 ? "text-accent-green" : "text-rose-300");

function Big({ k, v, sub, t = "text-white" }: { k: string; v: string; sub?: string; t?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className={`mt-1 font-mono text-[22px] tabular-nums ${t}`}>{v}</div>
      {sub && <div className="mt-1 text-[12px] leading-snug text-white/50">{sub}</div>}
    </div>
  );
}

export default async function ScorecardPage() {
  const { data, error } = await load(getScorecard);
  const n = data?.numbers ?? null;
  const p = data?.plan ?? null;
  const d = data?.discipline ?? null;
  const days = data?.days ?? [];
  const maxAbs = Math.max(1, ...days.map((x) => Math.abs(Number(x.pnl ?? 0))));
  const l20 = n?.last20;
  // The win rate needed to break even at his real average win and loss.
  const need = l20 && l20.avg_win_r > 0 ? Math.round((Math.abs(l20.avg_loss_r) / (l20.avg_win_r + Math.abs(l20.avg_loss_r))) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Scorecard" sub="Your numbers, your rules and whether you kept them, and the habits that cost you money. This is the edge." />
      <Stamps><Updated at={data?.as_of} label="scorecard" verb="as of" cadenceH={1} /></Stamps>
      <DataNotice error={error} />

      <Card title="Your numbers" sub="Leverage and prop trades. R = one unit of the risk you planned on the trade.">
        {!n ? <Empty>No closed trades yet.</Empty> : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Big k="Last 20 trades" v={rr(l20?.expectancy_r)} t={tone(l20?.expectancy_r)} sub="average per trade — this has to be above zero" />
              <Big k="Win rate (last 20)" v={`${l20?.win_pct ?? "—"}%`} sub={need != null ? `you need ${need}% at your current win and loss size` : undefined} t={need != null && l20 && l20.win_pct < need ? "text-rose-300" : "text-white"} />
              <Big k="Average win" v={rr(l20?.avg_win_r)} sub={`all time ${rr(n.avg_win_r)} · ${n.wins_under_half_r} of ${n.wins} wins were under 0.5R`} />
              <Big k="Average loss" v={rr(l20?.avg_loss_r)} sub={`all time ${rr(n.avg_loss_r)} · ${n.full_stop_losses} full stops`} t="text-rose-300" />
            </div>
            <div className="mt-3 grid gap-2 text-[12.5px] text-white/70 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] px-3 py-2">Shorts <span className={`font-mono ${tone(n.shorts.avg_r)}`}>{rr(n.shorts.avg_r)}</span> ({n.shorts.n}) · Longs <span className={`font-mono ${tone(n.longs.avg_r)}`}>{rr(n.longs.avg_r)}</span> ({n.longs.n})</div>
              <div className="rounded-xl border border-white/[0.06] px-3 py-2">Held over 1h <span className={`font-mono ${tone(n.over_1h.avg_r)}`}>{rr(n.over_1h.avg_r)}</span> ({n.over_1h.n}) · under 1h <span className={`font-mono ${tone(n.under_1h.avg_r)}`}>{rr(n.under_1h.avg_r)}</span> ({n.under_1h.n})</div>
              {n.reviews_72h && (
                <div className="rounded-xl border border-white/[0.06] px-3 py-2 sm:col-span-2">
                  Exits: on {n.reviews_72h.exited_early} trades you closed early for {rr(n.reviews_72h.exited_early_took_r)} when the plan paid {rr(n.reviews_72h.exited_early_plan_r)}. The average trade showed {rr(n.reviews_72h.avg_best_r_seen)} at its best.
                </div>
              )}
            </div>
            <div className="mt-3 text-right text-[12px]"><Link href="/dashboard/performance" className="text-white/70 hover:text-white">Full performance →</Link></div>
          </>
        )}
      </Card>

      <Card title="Your rules" right={<Link href="/dashboard/prop" className="text-white/70 hover:text-white">Prop account →</Link>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-white/80">
            <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-white/40">Prop plan</div>
            {p ? (
              <ul className="space-y-0.5">
                <li>Risk up to ${p.rules.risk_cap} a trade; never bigger after a win or a loss</li>
                <li>Take profit at 2R; alert at +1R, you manage it</li>
                <li>{p.rules.max_trades} trades a day · {p.rules.max_losses} losses = done · day stop −${p.rules.day_stop}</li>
                <li>New York open · no entries 6 PM–5 AM · {p.rules.cooloff_min} min after a loss</li>
              </ul>
            ) : <span className="text-white/45">No plan loaded.</span>}
          </div>
          <div className="rounded-xl border border-white/[0.06] px-3 py-2.5 text-[13px] text-white/80">
            <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-white/40">Kept them? · last 14 days</div>
            {d && d.trades > 0 ? (
              <ul className="space-y-0.5">
                <li><span className="font-mono text-white">{d.trades}</span> trades · <span className={`font-mono ${tone(d.net_r)}`}>{rr(d.net_r)}</span> · <span className={`font-mono ${tone(d.net_usd)}`}>{usd(d.net_usd)}</span></li>
                <li><span className={`font-mono ${d.off_plan > 0 ? "text-rose-300" : "text-accent-green"}`}>{d.off_plan}</span> taken off plan</li>
                <li><span className={`font-mono ${d.away_from_level > 0 ? "text-rose-300" : "text-accent-green"}`}>{d.away_from_level}</span> entered away from a level</li>
              </ul>
            ) : <span className="text-white/45">No trades in the last 14 days.</span>}
          </div>
        </div>
        <details className="mt-3 rounded-xl border border-white/[0.06] px-3 py-2.5">
          <summary className="cursor-pointer list-none text-[12.5px] text-white/60 hover:text-white">Your 11 checks before every trade</summary>
          <ol className="mt-2 grid gap-x-6 gap-y-1 text-[12.5px] text-white/75 sm:grid-cols-2">
            {PRE_TRADE_CHECKLIST.map((x, i) => <li key={i} className="flex gap-2"><span className="w-4 shrink-0 text-right font-mono text-white/35">{i + 1}</span><span>{x}</span></li>)}
          </ol>
        </details>
      </Card>

      <Card title="Habits that cost you money" sub="From your own reviewed trades. Fix the top one first.">
        {(data?.mistakes ?? []).length === 0 ? <Empty>No tagged mistakes yet.</Empty> : (
          <div className="space-y-2">
            {data!.mistakes!.map((m) => (
              <div key={m.cost_rank} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-white">{m.cost_rank}. {clean(m.label)}</span>
                  <span className="flex items-center gap-2 font-mono text-[12px] tabular-nums text-white/65">
                    <span className="text-rose-300">{rr(m.r_cost)}</span> · {m.times}× · {m.last_7d} this week
                    <Badge tone={m.trend === "improving" ? "green" : m.trend === "repeating" ? "red" : "gray"}>{m.trend}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-white/60">Rule: {clean(m.rule)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Latest lessons" right={<Link href="/dashboard/journal" className="text-white/70 hover:text-white">Journal →</Link>}>
          {(data?.reviews ?? []).filter((r) => r.lesson).length === 0 ? <Empty>No reviewed trades yet.</Empty> : (
            <div className="space-y-2">
              {data!.reviews!.filter((r) => r.lesson).slice(0, 6).map((r) => (
                <div key={r.trade_id} className="border-t border-white/[0.05] pt-2 text-[12.5px] first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2 text-white/45">
                    <span>{r.trade_id.replace("MBT-", "")} · {whenShort(r.reviewed_at)}</span>
                    <span className={`font-mono ${tone(r.r_multiple)}`}>{rr(r.r_multiple)}{r.followed_plan === false ? " · off plan" : ""}</span>
                  </div>
                  <p className="mt-0.5 leading-snug text-white/80">{clean(r.lesson)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Last 30 days" right={<Link href="/dashboard/tracker" className="text-white/70 hover:text-white">Trade tracker →</Link>}>
          {days.length === 0 ? <Empty>No closed trades in the last 30 days.</Empty> : (
            <div className="space-y-1">
              {days.map((x) => {
                const v = Number(x.pnl ?? 0);
                return (
                  <div key={x.day} className="grid grid-cols-[64px_minmax(0,1fr)_84px] items-center gap-2 text-[12px]">
                    <span className="font-mono text-white/45">{x.day.slice(5)}</span>
                    <div className="h-2 rounded-full bg-white/[0.04]"><div className={`h-2 rounded-full ${v >= 0 ? "bg-accent-green/70" : "bg-rose-400/70"}`} style={{ width: `${Math.max(2, (Math.abs(v) / maxAbs) * 100)}%` }} /></div>
                    <span className={`text-right font-mono tabular-nums ${tone(v)}`}>{usd(v)} <span className="text-white/35">{x.n}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <p className="px-1 text-[12px] text-white/40">
        Long-term holds: <Link href="/dashboard/robinhood" className="text-white/70 hover:text-white">Robinhood</Link> · <Link href="/dashboard/coinbase" className="text-white/70 hover:text-white">Coinbase</Link>
      </p>
    </div>
  );
}
