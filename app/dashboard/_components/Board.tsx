// Trading-hours board (Stavros, 2026-10-12): for BTC/ETH/SOL and the top-5 movers, the range low (long zone) and
// range high (short zone) with the limit plan for each, and what is getting close. Same lines as TradingView.
// 2026-10-15 redesign: the A+ setups are shown in the "needs you now" strip above the board (see Attention.tsx);
// the board itself is the three core coins, with movers, the week plan and the reading guide one tap away.
import type { BoardPlan, BoardRow, WeekPlan } from "@/lib/moonbag/board";
import { Badge, Card, Expander, px2, whenShort } from "./ui";

const gradeTone = (g?: string | null) => (g === "A+" ? "green" : g === "A" ? "cyan" : g === "B" ? "amber" : "gray");
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`);

function Zone({ side, p }: { side: "long" | "short"; p: BoardPlan | null }) {
  if (!p) return null;
  const live = p.grade === "A+" || p.grade === "A" || p.grade === "B";
  const col = side === "long" ? "text-accent-green" : "text-rose-300";
  const hot = p.near && live;
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${hot ? (side === "long" ? "border-accent-green/40 bg-accent-green/[0.06]" : "border-rose-400/40 bg-rose-400/[0.06]") : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[12px] font-semibold uppercase tracking-wide ${col}`}>{side === "long" ? "▲ Long" : "▼ Short"}</span>
        <Badge tone={gradeTone(p.grade)}>{p.grade}</Badge>
        {hot && <Badge tone={side === "long" ? "green" : "red"} dot>getting close</Badge>}
        <span className="ml-auto font-mono text-[11.5px] tabular-nums text-white/45">{p.dist_pct.toFixed(2)}% away</span>
      </div>
      {live ? (
        <div className="mt-1.5 grid grid-cols-4 gap-1 font-mono text-[12.5px] tabular-nums">
          <span><span className="block text-[10.5px] uppercase text-white/40">{p.order === "market" ? "Market" : "Limit"}</span><span className="text-white">{px2(p.entry)}</span></span>
          <span><span className="block text-[10.5px] uppercase text-white/40">Stop</span><span className="text-rose-300">{px2(p.stop)}</span></span>
          <span><span className="block text-[10.5px] uppercase text-white/40">TP1</span><span className="text-accent-green">{px2(p.tp1)}</span></span>
          <span><span className="block text-[10.5px] uppercase text-white/40">R : R</span><span className="text-white">{p.rr == null ? "—" : `${p.rr.toFixed(1)}R`}</span></span>
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-white/50">{p.note}</p>
      )}
    </div>
  );
}

function RangeBar({ r }: { r: BoardRow }) {
  const lo = r.range_low, hi = r.range_high, p = r.price;
  if (lo == null || hi == null || p == null || hi <= lo) return null;
  const x = Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
  return (
    <div className="mt-2" role="img" aria-label={`${r.asset} ${px2(p)} between range low ${px2(lo)} and range high ${px2(hi)}`}>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-accent-green/50 via-white/10 to-rose-400/50">
        <div className="absolute -top-[5px] h-4 w-[3px] rounded bg-white shadow-[0_0_0_2px_#0b0b0d]" style={{ left: `calc(${x}% - 1.5px)` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums">
        <span className="text-accent-green">{px2(lo)} <span className="text-white/35">low</span></span>
        <span className="text-rose-300"><span className="text-white/35">high</span> {px2(hi)}</span>
      </div>
    </div>
  );
}

function CoinCard({ r }: { r: BoardRow }) {
  const status = r.cooling ? <Badge tone="gray">cooling — wait</Badge> : r.near ? <Badge tone="cyan" dot>near a zone</Badge> : null;
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${r.near && !r.cooling ? "border-accent-cyan/25 bg-accent-cyan/[0.03]" : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-[15px] text-white">{r.asset}</strong>
        <span className="font-mono text-[14px] tabular-nums text-white">{px2(r.price)}</span>
        <span className={`font-mono text-[12px] tabular-nums ${Number(r.change_24h) >= 0 ? "text-accent-green" : "text-rose-300"}`}>{pct(r.change_24h)}</span>
        {r.trend && <span className="text-[11.5px] text-white/45">{r.trend === "up" ? "▲ daily up" : r.trend === "down" ? "▼ daily down" : ""}</span>}
        {status && <span className="ml-auto">{status}</span>}
      </div>
      <RangeBar r={r} />
      <div className="mt-2 grid gap-2">
        <Zone side="long" p={r.long_plan} />
        <Zone side="short" p={r.short_plan} />
      </div>
      <div className="mt-1.5 text-[11px] text-white/35">
        {r.range_source === "tradingview" ? "lines = your TradingView RANGE alerts" : "levels from candles — drawn on TradingView next hour"} · bar {r.last_bar ? whenShort(new Date(new Date(r.last_bar).getTime() + 3600_000).toISOString()) : "—"}
      </div>
    </div>
  );
}

export type APlus = { key: string; coin: string; side: string; entry: number; stop: number; tp1: number | null; tp2?: number | null; rr: number | null; strategy: string; record: string; /** when this setup's data was written — shown on the card so its age is never in doubt */ when?: string | null };

export function Board({ core, movers, weekPlan, window, updatedAt }: {
  core: BoardRow[]; movers: BoardRow[]; weekPlan: WeekPlan; window: { open: boolean; monday: boolean }; updatedAt: string | null;
}) {
  const close = [...core, ...movers].filter((r) => r.near && !r.cooling);
  const moversHot = movers.some((r) => r.near && !r.cooling);
  return (
    <Card
      title="Range board"
      sub="Range low = long zone · range high = short zone, each with its backtested limit plan. Same lines as TradingView."
      right={<Badge tone={window.open ? "green" : "gray"} dot>{window.open ? "trading hours" : "outside trading hours"}{updatedAt ? ` · ${whenShort(updatedAt)}` : ""}</Badge>}
    >
      {window.monday && (
        <div className="mb-3 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[13px] text-amber-100">
          <strong>Monday = plan day.</strong> Levels only, no entries pushed today — use it to set the week.{weekPlan ? "" : " The week plan arrives with the morning brief."}
        </div>
      )}

      {close.length > 0 && (
        <p className="mb-3 text-[13.5px] text-white/80"><strong className="text-accent-cyan">Getting close:</strong> {close.map((r) => `${r.asset} ${r.best_side === "short" ? "▼ short zone" : "▲ long zone"}`).join(" · ")}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-3">{core.map((r) => <CoinCard key={r.asset} r={r} />)}</div>

      <div className="mt-3 space-y-2">
        {movers.length > 0 && (
          <Expander open={moversHot} summary={<span><strong className="text-white/85">Top 5 movers</strong> <span className="text-white/45">· Scout&apos;s rotation · {movers.map((r) => r.asset).join(", ")}{moversHot ? " · one is near a zone" : ""}</span></span>}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{movers.map((r) => <CoinCard key={r.asset} r={r} />)}</div>
          </Expander>
        )}
        {weekPlan && (
          <Expander open={window.monday} summary={<span><strong className="text-white/85">This week&apos;s plan</strong> <span className="text-white/45">· {weekPlan.report_date}</span></span>}>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/80">{weekPlan.markdown.slice(0, 2500)}</pre>
          </Expander>
        )}
        <Expander summary={<span className="text-white/60">How to read the board</span>}>
          <p className="text-[12.5px] leading-relaxed text-white/55">
            Updated every hour 5 AM–3 PM Phoenix on weekdays. Grades: A+ / A with the daily trend (A+ = 3R or better), B against it (half size), &quot;no trade&quot; when TP1 is under 2R.
            A+ also needs the entry 0.15–2 daily ranges away and the coin not cooling. Limit = half a 1h ATR through the edge so it only fills on a sweep (backtested +0.13R per trade); market only when price is already at the entry.
            Analysis, not financial advice — you place every order.
          </p>
        </Expander>
      </div>
    </Card>
  );
}
