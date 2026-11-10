// Command strip (layered flow, Stavros 2026-11-01; money first since 2026-11-09): one hero number (today's BloFin result),
// then month, prop room and discipline as a hairline instrument row, then the environment chips — about six numbers.
// Detail lives one click deeper (Retail gauge, Performance, Monthly audit). Display only.
import Link from "next/link";
import type { ReactNode } from "react";
import type { CommandData } from "@/lib/moonbag/command";
import { Updated } from "./ui";

const usd = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Number(v)).toFixed(2)}R`);
const tone = (v: number) => (v > 0 ? "text-accent-green" : v < 0 ? "text-rose-300" : "text-white");
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

// Environment chip. Calm by default (hairline, no fill) so the only colour in this row is an amber warning.
function Chip({ href, label, value, warn }: { href?: string; label: string; value: string; warn?: boolean }) {
  const body = (
    <span className={`inline-flex min-h-[40px] max-w-full flex-wrap items-center gap-x-2 rounded-lg border px-3 py-1 text-[12.5px] ${warn ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/[0.07] text-white/70"}`}>
      <span className={`text-[11px] uppercase tracking-[0.14em] ${warn ? "text-amber-200/70" : "text-white/40"}`}>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
  return href ? <Link href={href} className="max-w-full hover:opacity-90">{body}</Link> : body;
}

const LABEL = "text-[11px] font-medium uppercase tracking-[0.16em] text-white/45";
// One cell of the instrument row: hairline top/left (the grid's negative margin hides the outer ones), no box of its own.
const CELL = "block min-w-0 border-l border-t border-white/[0.06] px-4 py-3.5 hover:bg-white/[0.03] md:px-5";

function Metric({ label, value, sub, href, valueClass = "text-white" }: { label: string; value: string; sub?: ReactNode; href: string; valueClass?: string }) {
  return (
    <Link href={href} className={CELL}>
      <div className={LABEL}>{label}</div>
      <div className={`fig mt-1.5 font-mono text-[20px] font-semibold leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-white/45">{sub}</div>}
    </Link>
  );
}

export function CommandStrip({ c }: { c: CommandData }) {
  const d = c.discipline;
  const offPlanShare = d && d.trades ? Math.round((d.off_plan.n / d.trades) * 100) : null;
  const rail = c.todayPnl > 0 ? "bg-accent-green" : c.todayPnl < 0 ? "bg-rose-400" : "bg-white/20";
  return (
    <section aria-label="Today" className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Money first: today's BloFin result is the one hero number on the page — nothing else comes close in size. */}
        <Link href="/dashboard/performance" className="relative block min-w-0 px-4 py-5 pl-5 hover:bg-white/[0.03] md:px-6 md:py-6 md:pl-7">
          <span className={`absolute inset-y-4 left-0 w-[3px] rounded-r ${rail}`} aria-hidden />
          <div className={LABEL}>Today · BloFin</div>
          <div className={`fig mt-2.5 whitespace-nowrap font-mono text-[40px] font-semibold leading-none sm:text-[48px] lg:text-[44px] xl:text-[56px] ${tone(c.todayPnl)}`}>{usd(c.todayPnl)}</div>
          <div className="mt-3 text-[12.5px] text-white/50">
            <span className="font-mono tabular-nums text-white/75">{c.todayTrades}</span> trade{c.todayTrades === 1 ? "" : "s"} closed <span className="text-white/25">·</span> <span className="font-mono tabular-nums">{c.phxToday}</span>
          </div>
        </Link>
        {/* Supporting readouts: same numbers as before, one quiet instrument row divided by hairlines. */}
        <div className="min-w-0 overflow-hidden">
          <div className="-ml-px grid h-full grid-cols-2 lg:-mt-px lg:ml-0">
            <Metric label="This month · BloFin" value={usd(c.monthPnl)} valueClass={tone(c.monthPnl)} sub={`${c.greenDays}/${c.greenDays + c.redDays} green days`} href="/dashboard/performance" />
            {c.prop.map((p) => {
              const out = p.room_today <= 0 || p.room_to_floor <= 0;
              return (
                <Link key={p.account_id} href="/dashboard/prop" className={CELL}>
                  <div className={LABEL}>Prop · {p.stage}</div>
                  <div className={`fig mt-1.5 font-mono text-[20px] font-semibold leading-none ${out ? "text-rose-300" : "text-white"}`}>{usd0(p.balance)}</div>
                  {/* Room is what protects the account, so it reads as numbers, not as a sentence. */}
                  <dl className="mt-2 space-y-0.5 text-[12px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-white/45">room today</dt>
                      <dd className={`font-mono tabular-nums ${p.room_today <= 0 ? "text-rose-300" : "text-white/90"}`}>{usd0(p.room_today)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-white/45">to floor</dt>
                      <dd className={`font-mono tabular-nums ${p.room_to_floor <= 0 ? "text-rose-300" : "text-white/90"}`}>{usd0(p.room_to_floor)}</dd>
                    </div>
                    {p.to_target != null && p.to_target > 0 && (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-white/45">to pass</dt>
                        <dd className="font-mono tabular-nums text-white/70">{usd0(p.to_target)}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-1.5"><Updated label="snapshot" at={p.last_snapshot_at} cadenceH={24} verb="" /></div>
                </Link>
              );
            })}
            <Metric label="On plan this month" value={offPlanShare == null ? "—" : `${100 - offPlanShare}%`} sub={d ? `off-plan ${d.off_plan.n} trades ${r(d.off_plan.r)} · on-plan ${r(d.off_plan.on_plan_r)}` : undefined} href="/dashboard/audit" />
            <Metric label="Discipline" value={d ? `${d.overnight.n} overnight` : "—"} sub={d ? `away from levels ${d.away_from_level.n} · max ${d.per_day.max ?? 0}/day` : undefined} href="/dashboard/audit" />
          </div>
        </div>
      </div>
      {/* Environment second: only what changes how he sizes today. */}
      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3 md:px-5">
        <Chip href="/dashboard/gauge" label="Retail" value={c.gauge ? `${c.gauge.score}/100 · ${c.gauge.zone} · ${c.gauge.day}` : "—"} warn={c.gauge != null && c.gauge.score < 35} />
        <Chip label="News today" value={c.redFolder?.red ? `big-news day (red folder)${c.redFolder.events ? ` · ${c.redFolder.events}` : ""}` : "no major news"} warn={Boolean(c.redFolder?.red)} />
        {c.weekend && <Chip label="Weekend" value="thin liquidity · half risk suggested" warn />}
      </div>
    </section>
  );
}
