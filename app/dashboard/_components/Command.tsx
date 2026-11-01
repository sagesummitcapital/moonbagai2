// Command strip (layered flow, Stavros 2026-11-01): environment first, then today's money and discipline — about six numbers.
// Detail lives one click deeper (Retail gauge, Performance, Monthly audit). Display only.
import Link from "next/link";
import type { CommandData } from "@/lib/moonbag/command";
import { Card } from "./ui";

const usd = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Number(v)).toFixed(2)}R`);
const tone = (v: number) => (v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-white");

function Chip({ href, label, value, warn }: { href?: string; label: string; value: string; warn?: boolean }) {
  const body = (
    <span className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12.5px] ${warn ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
      <span className="text-white/45">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
  return href ? <Link href={href} className="hover:opacity-90">{body}</Link> : body;
}

function Metric({ label, value, sub, href, valueClass = "text-white" }: { label: string; value: string; sub?: string; href: string; valueClass?: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04]">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      <div className={`mt-1 font-mono text-[20px] font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-white/45">{sub}</div>}
    </Link>
  );
}

export function CommandStrip({ c }: { c: CommandData }) {
  const d = c.discipline;
  const offPlanShare = d && d.trades ? Math.round((d.off_plan.n / d.trades) * 100) : null;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip href="/dashboard/gauge" label="Retail" value={c.gauge ? `${c.gauge.score}/100 · ${c.gauge.zone}` : "—"} warn={c.gauge != null && c.gauge.score < 35} />
        <Chip label="Today" value={c.redFolder?.red ? `red-folder day${c.redFolder.events ? ` · ${c.redFolder.events}` : ""}` : "no red-folder news"} warn={Boolean(c.redFolder?.red)} />
        {c.weekend && <Chip label="Weekend" value="thin liquidity · half risk suggested" warn />}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Today · BloFin" value={usd(c.todayPnl)} valueClass={tone(c.todayPnl)} sub={`${c.todayTrades} trade${c.todayTrades === 1 ? "" : "s"} closed`} href="/dashboard/performance" />
        <Metric label="This month" value={usd(c.monthPnl)} valueClass={tone(c.monthPnl)} sub={`${c.greenDays}/${c.greenDays + c.redDays} green days`} href="/dashboard/performance" />
        <Metric label="On plan this month" value={offPlanShare == null ? "—" : `${100 - offPlanShare}%`} sub={d ? `off-plan ${d.off_plan.n} trades ${r(d.off_plan.r)} · on-plan ${r(d.off_plan.on_plan_r)}` : undefined} href="/dashboard/audit" />
        <Metric label="Discipline" value={d ? `${d.overnight.n} overnight` : "—"} sub={d ? `away from levels ${d.away_from_level.n} · max ${d.per_day.max ?? 0}/day` : undefined} href="/dashboard/audit" />
      </div>
    </Card>
  );
}
