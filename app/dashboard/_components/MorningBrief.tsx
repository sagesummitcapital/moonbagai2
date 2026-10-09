// Visual morning brief — same layout every day, built from buildBriefing().brief.
import type { ReactNode } from "react";
import type { buildBriefing, BriefCoin } from "@/lib/moonbag/briefing";
import { Badge, biasTone, money, num, when } from "./ui";

type Brief = Awaited<ReturnType<typeof buildBriefing>>["brief"];

const pct = (v: number | null) => (v == null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
const arrow = (b?: string | null) => (b === "bullish" ? "▲" : b === "bearish" ? "▼" : "◆");

export function MorningBrief({ brief }: { brief: Brief }) {
  const m = brief.market;
  const lev = brief.books.leverage;
  const rh = brief.books.robinhood;
  return (
    <section className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 md:p-6">
      {/* 1 — the market in one line */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Morning brief · {when(brief.date)}</div>
          <h2 className="mt-1 text-[22px] font-semibold text-white">
            {arrow(m.bias)} {m.bias ? m.bias[0].toUpperCase() + m.bias.slice(1) : "No view"}
            <span className="text-white/45"> · {m.risk ?? "—"}</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {m.regime && <Badge tone="gray">{m.regime}</Badge>}
          <Badge tone="cyan">confidence {num(m.confidence ?? 0, 0)}/100</Badge>
        </div>
      </div>
      {m.view && <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-white/80">{m.view}</p>}
      {m.changeMind && <p className="mt-1 text-[13px] text-white/50">Changes our mind: {m.changeMind}</p>}

      {/* 2 — BTC and ETH */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {brief.coins.map((c) => <Coin key={c.asset} c={c} />)}
      </div>

      {/* 2b — rotation: the Scout's top 5 vs BTC, ★ = in play */}
      {brief.rotation.top.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">Rotation · 1M vs BTC</span>
            {brief.rotation.top.map((r) => (
              <Badge key={r.asset} tone={r.inPlay ? "green" : "gray"}>
                {r.asset} {r.rs1m == null ? "" : `${r.rs1m > 0 ? "+" : ""}${num(r.rs1m, 0)}%`}{r.inPlay ? " ★" : ""}
              </Badge>
            ))}
          </div>
          {brief.rotation.plays.map((r) => (
            <div key={r.asset} className="mt-1.5 text-[12.5px] text-white/70">
              <strong className="text-white">{r.asset}</strong> · {r.plays.length ? r.plays.join("  ·  ") : "no plays set yet"}
            </div>
          ))}
        </div>
      )}

      {/* 3 — stocks · today · books · yesterday */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Tile title="Stocks">
          <div className="flex items-center gap-2"><Badge tone={biasTone(brief.stocks.bias)}>{brief.stocks.bias ?? "—"}</Badge></div>
          {brief.stocks.view && <p className="mt-2 text-[13px] leading-snug text-white/70">{brief.stocks.view}</p>}
          <p className="mt-2 text-[13px] text-white/85">
            {brief.stocks.best ? <>Best setup <strong>{brief.stocks.best.symbol}</strong> {num(brief.stocks.best.score, 1)}/10 <Badge tone={brief.stocks.best.grade === "C" ? "gray" : "green"}>{brief.stocks.best.grade}</Badge></> : "No equity setup scored yet"}
          </p>
        </Tile>
        <Tile title="Today">
          {brief.today.length ? (
            <ul className="space-y-1.5 text-[13px] text-white/80">{brief.today.map((t, i) => <li key={i}>• {t}</li>)}</ul>
          ) : (
            <p className="text-[13px] text-white/50">No major events recorded.</p>
          )}
        </Tile>
        <Tile title="Your books">
          <div className="text-[13px] text-white/80">
            <div className="flex justify-between"><span className="text-white/50">Leverage</span><span className="font-mono">{money(lev.equity)}</span></div>
            <div className="mt-0.5 text-[12px] text-white/45">{lev.milestone ? `→ ${money(lev.milestone)} next` : ""} · {lev.open ? `${lev.open} open trade` : "no open trade"}</div>
            {lev.milestone && (
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full bg-accent-green/70" style={{ width: `${Math.max(2, Math.min(100, (lev.equity / lev.milestone) * 100))}%` }} />
              </div>
            )}
            <div className="mt-3 flex justify-between"><span className="text-white/50">Robinhood</span><span className="font-mono">{money(rh.equity)}</span></div>
            <div className="mt-0.5 text-[12px] text-white/45">{rh.positions.length ? rh.positions.join(", ") : "cash"} · box {money(rh.boxUsed)}/{money(rh.boxLimit)} · fills {rh.fills}/{rh.maxFills}</div>
          </div>
        </Tile>
        <Tile title="Yesterday">
          <div className="font-mono text-[22px] text-white">{brief.yesterday.avg != null ? `${brief.yesterday.avg}/100` : "—"}</div>
          <div className="text-[12px] text-white/45">{brief.yesterday.graded ? `${brief.yesterday.graded} forecasts graded` : "not graded yet"}</div>
          {brief.yesterday.lesson && <p className="mt-2 text-[13px] leading-snug text-white/75">Lesson: {brief.yesterday.lesson}</p>}
        </Tile>
      </div>
    </section>
  );
}

function Coin({ c }: { c: BriefCoin }) {
  // Level ladder: the two nearest levels each side, with price placed between them.
  const pts = [...c.below.slice().reverse(), ...(c.price != null ? [c.price] : []), ...c.above];
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const pos = (x: number) => (hi > lo ? ((x - lo) / (hi - lo)) * 100 : 50);
  const up = c.change24 != null && c.change24 >= 0;
  return (
    <div className={`rounded-xl border p-4 ${c.deskAlert ? "border-accent-green/50 bg-accent-green/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-white">{c.asset}</span>
          <span className="font-mono text-[24px] font-semibold text-white">{num(c.price)}</span>
          {c.change24 != null && <span className={`font-mono text-[13px] ${up ? "text-accent-green" : "text-rose-300"}`}>{pct(c.change24)} 24h</span>}
        </div>
        <div className="flex gap-1">
          <Badge tone={biasTone(c.bias)}>{arrow(c.bias)} {c.bias}</Badge>
          {c.htf && <Badge tone={biasTone(c.htf)}>4h {c.htf}</Badge>}
        </div>
      </div>

      {pts.length > 1 && (
        <div className="relative mt-6 mb-7 h-1.5 rounded-full bg-gradient-to-r from-rose-400/40 via-white/10 to-accent-green/40">
          {c.below.map((x) => (
            <Tick key={`b${x}`} left={pos(x)} label={num(x)} tone="text-rose-200/80" />
          ))}
          {c.above.map((x) => (
            <Tick key={`a${x}`} left={pos(x)} label={num(x)} tone="text-accent-green/90" />
          ))}
          {c.price != null && (
            <div className="absolute -top-2.5 h-6 w-1 -translate-x-1/2 rounded bg-white" style={{ left: `${pos(c.price)}%` }} title="price now" />
          )}
        </div>
      )}

      {(c.rangeLow != null || c.rangeHigh != null) && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-white/45">TradingView lines</span>
          <Badge tone="red">range low {c.rangeLow != null ? num(c.rangeLow) : "—"}</Badge>
          <Badge tone="green">range high {c.rangeHigh != null ? num(c.rangeHigh) : "—"}</Badge>
        </div>
      )}
      <p className={`text-[13.5px] leading-snug ${c.deskAlert ? "font-medium text-white" : "text-white/75"}`}>▸ {c.plan}</p>
      {c.checkedAt && <p className="mt-1 text-[11.5px] text-white/35">checked {when(c.checkedAt)}</p>}
    </div>
  );
}

function Tick({ left, label, tone }: { left: number; label: string; tone: string }) {
  return (
    <div className="absolute top-0 -translate-x-1/2" style={{ left: `${left}%` }}>
      <div className="mx-auto h-3 w-px -translate-y-[3px] bg-white/40" />
      <div className={`mt-1 whitespace-nowrap font-mono text-[11px] ${tone}`}>{label}</div>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/45">{title}</div>
      {children}
    </div>
  );
}
