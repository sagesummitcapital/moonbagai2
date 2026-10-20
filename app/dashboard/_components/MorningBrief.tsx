// Visual morning brief — same layout every day, built from buildBriefing().brief.
// Prices on the coin cards are LIVE (LivePrice); the desk's stored price and time stay visible as
// "desk check", because that is the number the plan underneath was written against.
import type { buildBriefing, BriefCoin } from "@/lib/moonbag/briefing";
import type { PriceMap } from "@/lib/moonbag/prices";
import { LevelLadder, Meter } from "./charts";
import { LivePrice } from "./LivePrice";
import { best, storedOf } from "./live";
import { Badge, Chip, Chips, Delta, LongText, Tile, Updated, biasGlyph, biasTone, money, money0, num, px, whenShort } from "./ui";

type Brief = Awaited<ReturnType<typeof buildBriefing>>["brief"];

/** Timestamps of the records the brief is drawn from (the brief itself only carries its build time). */
export type BriefMeta = {
  deskCheckedAt?: string | null;   // newest lev_hourly row
  thesisAt?: string | null;        // master thesis created_at
  levEquityAt?: string | null;     // BloFin account snapshot
  rhEquityAt?: string | null;      // Robinhood account snapshot
};

const cap = (s?: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : "");

export function MorningBrief({ brief, live = {}, meta = {} }: { brief: Brief; live?: PriceMap; meta?: BriefMeta }) {
  const m = brief.market;
  const lev = brief.books.leverage;
  const rh = brief.books.robinhood;
  const regimeShort = !!m.regime && m.regime.length <= 28;
  const riskShort = !!m.risk && m.risk.length <= 28;
  return (
    <section className="min-w-0">
      {/* 1 — the market in one line */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="text-[11.5px] uppercase tracking-[0.2em] text-white/45">Morning brief · built {whenShort(brief.date)}</div>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[24px] font-semibold leading-tight text-white">
            <span className={`${biasTone(m.bias) === "green" ? "text-accent-green" : biasTone(m.bias) === "red" ? "text-rose-300" : "text-white/70"}`}>{biasGlyph(m.bias)}</span>
            <span>{m.bias ? cap(m.bias) : "No view"}</span>
            {riskShort && <span className="text-[18px] font-medium text-white/45">· {m.risk}</span>}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {regimeShort && <Badge tone="gray">{m.regime}</Badge>}
          <Badge tone="cyan">confidence {num(m.confidence ?? 0, 0)}/100</Badge>
        </div>
      </div>
      {/* what this brief is drawn from, and how old each piece is */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Updated label="thesis" at={meta.thesisAt} cadenceH={26} verb="written" />
        <Updated label="desk lead" at={meta.deskCheckedAt} cadenceH={11} verb="checked" />
        <span className="font-mono text-[11.5px] text-white/35">prices below are live · plans were written at the desk check</span>
      </div>

      {(!riskShort && m.risk) || (!regimeShort && m.regime) ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {!riskShort && m.risk && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
              <div className="text-[11.5px] uppercase tracking-[0.16em] text-white/45">Risk environment</div>
              <LongText text={m.risk} max={120} className="mt-1 text-[13.5px] leading-snug text-white/85" />
            </div>
          )}
          {!regimeShort && m.regime && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
              <div className="text-[11.5px] uppercase tracking-[0.16em] text-white/45">Market regime</div>
              <LongText text={m.regime} max={120} className="mt-1 text-[13.5px] leading-snug text-white/85" />
            </div>
          )}
        </div>
      ) : null}

      {m.view && <p className="mt-3 max-w-[72ch] text-[14.5px] leading-relaxed text-white/85">{m.view}</p>}
      {m.changeMind && <LongText text={m.changeMind} label="Changes our mind:" max={140} className="mt-1 text-[13px] leading-snug text-white/55" />}

      {/* 2 — BTC and ETH */}
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {brief.coins.map((c) => <Coin key={c.asset} c={c} live={live[c.asset]} />)}
      </div>

      {/* 2b — rotation: the Scout's top 5 vs BTC, ★ = in play */}
      {brief.rotation.top.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[11.5px] uppercase tracking-[0.18em] text-white/45">Rotation · 1M vs BTC</span>
            <Chips>
              {brief.rotation.top.map((r) => (
                <Chip
                  key={r.asset}
                  tone={r.inPlay ? "green" : r.rs1m != null && r.rs1m < 0 ? "red" : "gray"}
                  label={<>{r.asset}{r.inPlay ? " ★" : ""}</>}
                  value={r.rs1m == null ? undefined : `${r.rs1m > 0 ? "+" : ""}${num(r.rs1m, 0)}%`}
                />
              ))}
            </Chips>
            <span className="text-[11.5px] text-white/35">★ in play</span>
          </div>
          {brief.rotation.plays.map((r) => (
            <div key={r.asset} className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px] leading-snug text-white/70">
              <span><strong className="text-white">{r.asset}</strong> · {r.plays.length ? r.plays.join("  ·  ") : "no plays set yet"}</span>
              {live[r.asset] && <LivePrice symbol={r.asset} initial={live[r.asset]} size="inline" />}
            </div>
          ))}
        </div>
      )}

      {/* 3 — stocks · today · books · yesterday */}
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Tile title="Stocks" right={<Badge tone={biasTone(brief.stocks.bias)}>{biasGlyph(brief.stocks.bias)} {brief.stocks.bias ?? "—"}</Badge>}>
          {brief.stocks.view && <LongText text={brief.stocks.view} max={150} className="text-[13px] leading-snug text-white/70" />}
          <p className="mt-2 text-[13px] text-white/85">
            {brief.stocks.best ? (
              <>Best setup <strong>{brief.stocks.best.symbol}</strong> <span className="font-mono tabular-nums">{num(brief.stocks.best.score, 1)}/10</span> <Badge tone={brief.stocks.best.grade === "C" ? "gray" : "green"}>{brief.stocks.best.grade}</Badge></>
            ) : (
              "No equity setup scored yet"
            )}
          </p>
          {brief.stocks.best && live[brief.stocks.best.symbol] && (
            <div className="mt-1.5"><LivePrice symbol={brief.stocks.best.symbol} kind="stock" initial={live[brief.stocks.best.symbol]} size="inline" showChange /></div>
          )}
        </Tile>
        <Tile title="Today">
          {brief.today.length ? (
            <ul className="space-y-1.5 text-[13px] leading-snug text-white/80">
              {brief.today.map((t, i) => <li key={i} className="flex gap-2"><span className="text-white/30">•</span><span>{t}</span></li>)}
            </ul>
          ) : (
            <p className="text-[13px] text-white/50">No major events recorded.</p>
          )}
        </Tile>
        <Tile title="Your books">
          <div className="text-[13px] text-white/80">
            <div className="flex items-baseline justify-between gap-2"><span className="text-white/50">Leverage</span><span className="font-mono tabular-nums text-white">{money(lev.equity)}</span></div>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] text-white/45">
              <span>{lev.milestone ? `→ ${money0(lev.milestone)} next` : "milestones reached"} · {lev.open ? `${lev.open} open trade${lev.open > 1 ? "s" : ""}` : "no open trade"}</span>
              <Updated at={meta.levEquityAt} cadenceH={96} verb="confirmed" />
            </div>
            {lev.milestone && <Meter className="mt-1.5" value={lev.equity} max={lev.milestone} tone="green" height={5} />}
            <div className="mt-3 flex items-baseline justify-between gap-2"><span className="text-white/50">Robinhood</span><span className="font-mono tabular-nums text-white">{money(rh.equity)}</span></div>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] text-white/45">
              <span>long-term buy-and-hold · {rh.ltHeld}/{rh.ltNames} plan names held · {money(rh.ltGap)} to buy</span>
              <Updated at={meta.rhEquityAt} cadenceH={30} verb="" />
            </div>
            {rh.ltNames > 0 && <Meter className="mt-1.5" value={rh.ltHeld} max={rh.ltNames} tone="green" height={5} />}
          </div>
        </Tile>
        <Tile title="Yesterday">
          <div className="font-mono text-[24px] font-semibold leading-none tabular-nums text-white">{brief.yesterday.avg != null ? <>{brief.yesterday.avg}<span className="text-[13px] font-normal text-white/40">/100</span></> : "—"}</div>
          <div className="mt-1 text-[12px] text-white/45">{brief.yesterday.graded ? `${brief.yesterday.graded} forecasts graded` : "not graded yet"}</div>
          {brief.yesterday.lesson && <LongText text={brief.yesterday.lesson} label="Lesson:" max={140} className="mt-2 text-[13px] leading-snug text-white/75" />}
        </Tile>
      </div>
    </section>
  );
}

function Coin({ c, live }: { c: BriefCoin; live?: PriceMap[string] }) {
  const inPlay = c.deskAlert;
  const planLabel = c.plan.match(/^[A-Z ]+:/)?.[0] ?? null;
  const planBody = planLabel ? c.plan.slice(planLabel.length).trim() : c.plan;
  const stored = storedOf(c.price, c.checkedAt);
  const now = best(live, c.price);
  // Which side of the TradingView lines price is on — from the live price when we have it.
  const side = now.price != null && c.rangeLow != null && c.rangeHigh != null
    ? now.price > c.rangeHigh ? "above the range" : now.price < c.rangeLow ? "below the range" : "inside the range"
    : null;
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${inPlay ? "border-accent-green/50 bg-accent-green/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-start gap-x-3">
          <span className="pt-1 text-[15px] font-semibold text-white">{c.asset}</span>
          <LivePrice symbol={c.asset} kind="crypto" initial={live} stored={stored} size="lg" showChange />
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={biasTone(c.bias)}>{biasGlyph(c.bias)} {c.bias}</Badge>
          {c.htf && <Badge tone={biasTone(c.htf)}>4h {c.htf}</Badge>}
          {c.regime && <Badge tone="gray">{c.regime}</Badge>}
        </div>
      </div>
      {/* the decision price: what the plan below was written against */}
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[11.5px] tabular-nums text-white/40">
        <span>desk check</span>
        <span className="text-white/60">{px(c.price)}</span>
        {c.change24 != null && <Delta v={c.change24} d={1} unit="% 24h" className="text-[11px]" />}
        <span>· {c.checkedAt ? whenShort(c.checkedAt) : "—"}</span>
      </p>

      <LevelLadder className="mt-3" price={now.price} below={c.below} above={c.above} live={{ symbol: c.asset, kind: "crypto", initial: live, stored }} />

      {(c.rangeLow != null || c.rangeHigh != null) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-white/45">TradingView lines</span>
          <Badge tone="red">▼ range low {c.rangeLow != null ? num(c.rangeLow) : "—"}</Badge>
          <Badge tone="green">▲ range high {c.rangeHigh != null ? num(c.rangeHigh) : "—"}</Badge>
          {side && <span className="text-white/40">price {side}{now.isLive ? "" : " (stored)"}</span>}
        </div>
      )}
      <div className={`mt-3 text-[13.5px] leading-snug ${inPlay ? "text-white" : "text-white/80"}`}>
        {planLabel && <Badge tone={inPlay ? "green" : planLabel.startsWith("PLAYS") ? "cyan" : "gray"} className="mb-1 mr-1.5 align-middle">{planLabel.replace(":", "")}</Badge>}
        <LongText text={planBody} max={170} className={`text-[13.5px] leading-snug ${inPlay ? "font-medium text-white" : "text-white/80"}`} />
      </div>
    </div>
  );
}
