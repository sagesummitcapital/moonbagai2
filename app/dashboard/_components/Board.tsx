// Trading-hours board — the first thing on the leverage page (Stavros, 2026-10-12): for BTC/ETH/SOL and the top-5 movers,
// the range low (long zone) and range high (short zone) with the limit plan for each, what is getting close, and the
// A+ setups from strategies with a positive record. Same lines as TradingView.
import type { BoardPlan, BoardRow, WeekPlan } from "@/lib/moonbag/board";
import { Badge, Card, num, whenShort } from "./ui";

const gradeTone = (g?: string | null) => (g === "A+" ? "green" : g === "A" ? "cyan" : g === "B" ? "amber" : "gray");
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`);

function Zone({ side, p }: { side: "long" | "short"; p: BoardPlan | null }) {
  if (!p) return null;
  const live = p.grade === "A+" || p.grade === "A" || p.grade === "B";
  const col = side === "long" ? "text-accent-green" : "text-rose-300";
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${p.near && live ? (side === "long" ? "border-accent-green/50 bg-accent-green/[0.06]" : "border-rose-400/50 bg-rose-400/[0.06]") : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[12px] font-semibold uppercase tracking-wide ${col}`}>{side === "long" ? "▲ Long" : "▼ Short"}</span>
        <Badge tone={gradeTone(p.grade)}>{p.grade}</Badge>
        {p.near && live && <Badge tone={side === "long" ? "green" : "red"} dot>getting close</Badge>}
        <span className="ml-auto text-[11.5px] text-white/45">{p.dist_pct.toFixed(2)}% away</span>
      </div>
      {live ? (
        <div className="mt-1 grid grid-cols-4 gap-1 font-mono text-[12.5px] tabular-nums">
          <span><span className="block text-[10.5px] uppercase text-white/40">{p.order === "market" ? "Market" : "Limit"}</span><span className="text-white">{num(p.entry, 6)}</span></span>
          <span><span className="block text-[10.5px] uppercase text-white/40">Stop</span><span className="text-rose-300">{num(p.stop, 6)}</span></span>
          <span><span className="block text-[10.5px] uppercase text-white/40">TP1</span><span className="text-accent-green">{num(p.tp1, 6)}</span></span>
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
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-accent-green/50 via-white/10 to-rose-400/50">
        <div className="absolute -top-1 h-4 w-[3px] rounded bg-white shadow-[0_0_0_2px_#0b0b0d]" style={{ left: `calc(${x}% - 1.5px)` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11.5px] tabular-nums">
        <span className="text-accent-green">{num(lo, 6)} <span className="text-white/35">range low</span></span>
        <span className="text-rose-300"><span className="text-white/35">range high</span> {num(hi, 6)}</span>
      </div>
    </div>
  );
}

function CoinCard({ r, compact = false }: { r: BoardRow; compact?: boolean }) {
  const status = r.cooling ? <Badge tone="gray">cooling — wait</Badge> : r.near ? <Badge tone="cyan" dot>near a zone</Badge> : <Badge tone="gray">in range</Badge>;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-[15px] text-white">{r.asset}</strong>
        <span className="font-mono text-[14px] tabular-nums text-white">{num(r.price, 6)}</span>
        <span className={`font-mono text-[12px] ${Number(r.change_24h) >= 0 ? "text-accent-green" : "text-rose-300"}`}>{pct(r.change_24h)} 24h</span>
        <span className="text-[12px] text-white/45">{r.trend === "up" ? "▲ daily uptrend" : r.trend === "down" ? "▼ daily downtrend" : ""}</span>
        <span className="ml-auto">{status}</span>
      </div>
      <RangeBar r={r} />
      <div className={`mt-2 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <Zone side="long" p={r.long_plan} />
        <Zone side="short" p={r.short_plan} />
      </div>
      <div className="mt-1.5 text-[11px] text-white/35">
        {r.range_source === "tradingview" ? "lines = your TradingView RANGE alerts" : "levels from candles — drawn on TradingView next hour"} · bar {r.last_bar ? whenShort(new Date(new Date(r.last_bar).getTime() + 3600_000).toISOString()) : "—"}
      </div>
    </div>
  );
}

export type APlus = { key: string; coin: string; side: string; entry: number; stop: number; tp1: number | null; rr: number | null; strategy: string; record: string; when?: string };

export function Board({ core, movers, weekPlan, window, aplus, updatedAt }: {
  core: BoardRow[]; movers: BoardRow[]; weekPlan: WeekPlan; window: { open: boolean; monday: boolean }; aplus: APlus[]; updatedAt: string | null;
}) {
  const close = [...core, ...movers].filter((r) => r.near && !r.cooling);
  return (
    <Card
      tone="accent"
      title="Trading hours board"
      sub="Range low = long zone · range high = short zone, with the backtested limit plan for each. Updated every hour 5 AM–3 PM Phoenix on weekdays. Same lines as TradingView."
      right={<Badge tone={window.open ? "green" : "gray"} dot>{window.open ? "trading hours" : "outside trading hours"}{updatedAt ? ` · ${whenShort(updatedAt)}` : ""}</Badge>}
    >
      {window.monday && (
        <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/[0.07] px-3 py-2 text-[13px] text-amber-100">
          <strong>Monday = plan day.</strong> Levels only, no entries pushed today — use it to set the week.{weekPlan ? "" : " The week plan arrives with the morning brief."}
        </div>
      )}
      {weekPlan && (
        <details className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2" open={window.monday}>
          <summary className="cursor-pointer text-[13px] text-white/80"><strong>This week's plan</strong> <span className="text-white/45">· {weekPlan.report_date}</span></summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/80">{weekPlan.markdown.slice(0, 2500)}</pre>
        </details>
      )}

      <div className="mb-3">
        <div className="mb-1.5 flex items-center gap-2"><h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">A+ setups now</h3><span className="text-[11.5px] text-white/35">only from strategies with a positive record</span></div>
        {aplus.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {aplus.map((a) => (
              <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent-green/30 bg-accent-green/[0.05] px-3 py-2 text-[13px]">
                <Badge tone="green">A+</Badge>
                <strong className="text-white">{a.coin} {a.side === "long" ? "▲ LONG" : "▼ SHORT"}</strong>
                <span className="font-mono tabular-nums text-white/85">limit {num(a.entry, 6)} · SL {num(a.stop, 6)} · TP1 {num(a.tp1, 6)} · {a.rr == null ? "—" : `${a.rr.toFixed(1)}R`}</span>
                <span className="w-full text-[11.5px] text-white/50">{a.strategy} · {a.record}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/50">No A+ setup right now. A+ = with the daily trend, R:R 3 or better, entry 0.3–2 daily ranges away, coin not cooling.</p>
        )}
      </div>

      {close.length > 0 && (
        <p className="mb-2 text-[13px] text-white/75"><strong className="text-accent-cyan">Getting close:</strong> {close.map((r) => `${r.asset} ${r.best_side === "short" ? "▼ short zone" : "▲ long zone"}`).join(" · ")}</p>
      )}

      <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">BTC · ETH · SOL</h3>
      <div className="grid gap-3 lg:grid-cols-3">{core.map((r) => <CoinCard key={r.asset} r={r} compact />)}</div>
      {movers.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">Top 5 movers (Scout's rotation)</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{movers.map((r) => <CoinCard key={r.asset} r={r} compact />)}</div>
        </>
      )}
      <p className="mt-3 text-[11.5px] text-white/40">Grades: A+ / A with the daily trend (A+ = 3R or better), B against it (half size), "no trade" when TP1 is under 2R. Limit = half a 1h ATR through the edge so it only fills on a sweep (backtested +0.13R per trade); market only when price is already at the entry. Analysis, not financial advice — you place every order.</p>
    </Card>
  );
}
