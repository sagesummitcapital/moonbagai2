// Command strip (layered flow, Stavros 2026-11-01): environment first, then today's money and discipline — about six numbers.
// Detail lives one click deeper (Retail gauge, Performance, Monthly audit). Display only.
import Link from "next/link";
import type { ReactNode } from "react";
import type { CommandData } from "@/lib/moonbag/command";
import { Card, Updated } from "./ui";

const usd = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Number(v)).toFixed(2)}R`);
const tone = (v: number) => (v > 0 ? "text-accent-green" : v < 0 ? "text-rose-300" : "text-white");
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

function Chip({ href, label, value, warn }: { href?: string; label: string; value: string; warn?: boolean }) {
  const body = (
    <span className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-[12.5px] ${warn ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
      <span className="text-white/45">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
  return href ? <Link href={href} className="hover:opacity-90">{body}</Link> : body;
}

function Metric({ label, value, sub, href, valueClass = "text-white", hero = false }: { label: string; value: string; sub?: ReactNode; href: string; valueClass?: string; hero?: boolean }) {
  return (
    <Link href={href} className={`block rounded-xl border p-3 hover:bg-white/[0.04] ${hero ? "col-span-2 border-white/[0.12] bg-white/[0.04] md:col-span-1" : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="text-[11.5px] uppercase tracking-[0.12em] text-white/45">{label}</div>
      <div className={`mt-1 font-mono font-semibold leading-none tabular-nums ${hero ? "text-[26px] md:text-[30px]" : "text-[20px]"} ${valueClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-white/45">{sub}</div>}
    </Link>
  );
}

export function CommandStrip({ c }: { c: CommandData }) {
  const d = c.discipline;
  const offPlanShare = d && d.trades ? Math.round((d.off_plan.n / d.trades) * 100) : null;
  return (
    <Card>
      {/* Money first: today's BloFin result is the biggest number on the page; the prop account sits next to it. */}
      <div className={`grid grid-cols-2 gap-2 ${c.prop.length ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <Metric hero label="Today · BloFin" value={usd(c.todayPnl)} valueClass={tone(c.todayPnl)} sub={`${c.todayTrades} trade${c.todayTrades === 1 ? "" : "s"} closed · ${c.phxToday}`} href="/dashboard/performance" />
        <Metric label="This month · BloFin" value={usd(c.monthPnl)} valueClass={tone(c.monthPnl)} sub={`${c.greenDays}/${c.greenDays + c.redDays} green days`} href="/dashboard/performance" />
        {c.prop.map((p) => (
          <Metric
            key={p.account_id}
            label={`Prop · ${p.stage}`}
            value={usd0(p.balance)}
            valueClass={p.room_today <= 0 || p.room_to_floor <= 0 ? "text-rose-300" : "text-white"}
            sub={<>room today {usd0(p.room_today)} · to floor {usd0(p.room_to_floor)}{p.to_target != null && p.to_target > 0 ? ` · ${usd0(p.to_target)} to pass` : ""}<br /><Updated label="snapshot" at={p.last_snapshot_at} cadenceH={24} verb="" /></>}
            href="/dashboard/prop"
          />
        ))}
        <Metric label="On plan this month" value={offPlanShare == null ? "—" : `${100 - offPlanShare}%`} sub={d ? `off-plan ${d.off_plan.n} trades ${r(d.off_plan.r)} · on-plan ${r(d.off_plan.on_plan_r)}` : undefined} href="/dashboard/audit" />
        <Metric label="Discipline" value={d ? `${d.overnight.n} overnight` : "—"} sub={d ? `away from levels ${d.away_from_level.n} · max ${d.per_day.max ?? 0}/day` : undefined} href="/dashboard/audit" />
      </div>
      {/* Environment second: only what changes how he sizes today. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip href="/dashboard/gauge" label="Retail" value={c.gauge ? `${c.gauge.score}/100 · ${c.gauge.zone} · ${c.gauge.day}` : "—"} warn={c.gauge != null && c.gauge.score < 35} />
        <Chip label="News today" value={c.redFolder?.red ? `big-news day (red folder)${c.redFolder.events ? ` · ${c.redFolder.events}` : ""}` : "no major news"} warn={Boolean(c.redFolder?.red)} />
        {c.weekend && <Chip label="Weekend" value="thin liquidity · half risk suggested" warn />}
      </div>
    </Card>
  );
}
