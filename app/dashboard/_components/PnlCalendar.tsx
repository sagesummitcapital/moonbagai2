"use client";
// Daily P&L calendar (Stavros 2026-11-01): each day shows that day's realized $ — green up day, red down day, blank no-trade day.
// Phoenix days (no DST). Month total, green-day count, prev/next month, venue toggle. Display only.
import { useMemo, useState } from "react";
import type { PnlDay } from "@/lib/moonbag/pnlCalendar";

const VENUES = [
  { k: "blofin", label: "BloFin" },
  { k: "robinhood", label: "Robinhood" },
  { k: "coinbase", label: "Coinbase" },
  { k: "all", label: "All real money" },
  { k: "breakout", label: "Prop (eval)" },
] as const;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const usd = (v: number, cents = true) =>
  `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

function phxToday(): { y: number; m: number; d: string } {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" }); // YYYY-MM-DD
  return { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1, d: s };
}

export function PnlCalendar({ days }: { days: PnlDay[] }) {
  const today = phxToday();
  const [ym, setYm] = useState({ y: today.y, m: today.m });
  const [venue, setVenue] = useState<(typeof VENUES)[number]["k"]>("blofin");

  const byDay = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: number }>();
    for (const d of days) {
      if (venue === "all" ? d.venue === "breakout" : d.venue !== venue) continue; // "all" = real money; the prop evaluation has its own toggle
      const cur = map.get(d.day) ?? { pnl: 0, trades: 0 };
      map.set(d.day, { pnl: cur.pnl + d.pnl_usd, trades: cur.trades + d.trades });
    }
    return map;
  }, [days, venue]);

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const nDays = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const key = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const monthRows = Array.from({ length: nDays }, (_, i) => byDay.get(key(i + 1))).filter(Boolean) as { pnl: number; trades: number }[];
  const total = monthRows.reduce((a, r) => a + r.pnl, 0);
  const green = monthRows.filter((r) => r.pnl > 0).length;
  const red = monthRows.filter((r) => r.pnl < 0).length;
  const maxAbs = Math.max(1, ...monthRows.map((r) => Math.abs(r.pnl)));
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const isCurrent = ym.y === today.y && ym.m === today.m;
  const step = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} className="h-10 w-10 rounded-lg border border-white/10 text-white/70 hover:bg-white/5" aria-label="Previous month">‹</button>
          <div className="min-w-[9.5rem] text-center text-[15px] font-semibold text-white">{label}</div>
          <button type="button" onClick={() => step(1)} disabled={isCurrent} className="h-10 w-10 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-30" aria-label="Next month">›</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {VENUES.map((v) => (
            <button key={v.k} type="button" onClick={() => setVenue(v.k)}
              className={`min-h-[40px] rounded-full px-3 text-[12.5px] ${venue === v.k ? "bg-white text-black" : "border border-white/10 text-white/60 hover:bg-white/5"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <span className="text-white/50">Month <b className={`font-mono tabular-nums ${total > 0 ? "text-emerald-400" : total < 0 ? "text-rose-400" : "text-white"}`}>{usd(total)}</b></span>
        <span className="text-white/50">Green days <b className="font-mono tabular-nums text-white">{green}/{green + red}</b></span>
        {red > 0 && <span className="text-white/50">Red days <b className="font-mono tabular-nums text-white">{red}</b></span>}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => <div key={d} className="pb-1 text-[11px] uppercase tracking-wider text-white/35">{d}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />;
          const r = byDay.get(key(d));
          const isToday = key(d) === today.d;
          const a = r ? 0.12 + 0.38 * Math.min(1, Math.abs(r.pnl) / maxAbs) : 0;
          const bg = !r || r.pnl === 0 ? undefined : r.pnl > 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`;
          return (
            <div key={d} title={r ? `${key(d)} · ${usd(r.pnl)} · ${r.trades} trade${r.trades === 1 ? "" : "s"}` : key(d)}
              className={`flex min-h-[52px] flex-col justify-between rounded-lg border p-1.5 text-left ${isToday ? "border-white/40" : "border-white/[0.06]"}`}
              style={{ background: bg }}>
              <span className="text-[11px] text-white/40">{d}</span>
              {r && <span className={`truncate font-mono text-[11.5px] font-semibold tabular-nums sm:text-[12.5px] ${r.pnl > 0 ? "text-emerald-300" : r.pnl < 0 ? "text-rose-300" : "text-white/60"}`}>{usd(r.pnl, Math.abs(r.pnl) < 100)}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-white/35">Realized $ per day (exits and closes), Phoenix time. No-trade days stay blank.</p>
    </div>
  );
}
