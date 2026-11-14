import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Card, Empty, PageHeader, Stamps, Updated, whenShort } from "../_components/ui";
import { fmtPx, getLevelsBoard, LEVEL_NAME, statusWord, type BoardRow, type Level } from "@/lib/moonbag/levelsBoard";
import { biasWord, type Bias, type Outlook } from "@/lib/moonbag/outlook";

export const dynamic = "force-dynamic";

/**
 * LEVELS (CR-72, Stavros 2026-11-11): "a super simple display ... my range levels at a glance and highlights changes."
 * Core · Top 5 · Traded. One row per coin: where price sits between its nearest levels, one status word, three checks.
 * Tap a row for every level, the Monday range and the chart. Same numbers as GET /levels/board and the TradingView lines.
 */
const SHORT: Record<string, string> = {
  mo: "Month open", pmo: "Prev month open", pmc: "Prev month close", mon_h: "Mon high", mon_l: "Mon low",
  pdh: "Yday high", pdl: "Yday low", sup: "Range low", res: "Range high", flip: "Flip",
  wo: "Week open", pwh: "Prev wk high", pwl: "Prev wk low", mine: "Yours",
};

/** Colour per source: white = range levels, blue = Moonbag's range, amber = yours (CR-77). */
const SRC_TICK: Record<Level["src"], string> = { range: "bg-white/45", moonbag: "bg-accent-cyan/70", yours: "bg-amber-300" };
const SRC_TEXT: Record<Level["src"], string> = { range: "text-white/40", moonbag: "text-accent-cyan/70", yours: "text-amber-200" };
const BIAS_TONE: Record<Bias, string> = { bullish: "text-accent-green", bearish: "text-rose-300", neutral: "text-white/70" };

function BiasChip({ label, b }: { label: string; b: Bias | null }) {
  return (
    <span className="whitespace-nowrap text-[11px]">
      <span className="text-white/35">{label} </span>
      <span className={`font-semibold ${b ? BIAS_TONE[b] : "text-white/30"}`}>{biasWord(b)}</span>
    </span>
  );
}

/** His own view (CR-77): HTF / LTF bias, notes, flip line, invalidation, plans. */
function MyView({ o, title }: { o: Outlook; title: string }) {
  const line = (k: string, v: string | null | undefined) =>
    v ? (
      <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
        <span className="text-white/40">{k}</span>
        <span className="text-white/85">{v}</span>
      </div>
    ) : null;
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-[12.5px] ${o.stale ? "border-white/10 bg-white/[0.02]" : "border-amber-300/25 bg-amber-300/[0.04]"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">{title}</span>
        <span className={`text-[11px] ${o.stale ? "text-rose-300" : "text-white/40"}`}>
          {o.stale ? `${o.age_days} days old — give Grok a fresh view` : `given ${whenShort(o.given_at)}`}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {line("Higher TF", `${biasWord(o.htf_bias)}${o.htf_note ? ` — ${o.htf_note}` : ""}`)}
        {line("Lower TF", `${biasWord(o.ltf_bias)}${o.ltf_note ? ` — ${o.ltf_note}` : ""}`)}
        {line("Macro", o.macro_note)}
        {line("Flip line", o.flip != null ? `${fmtPx(Number(o.flip))} — above bullish, below bearish` : null)}
        {line("Wrong if", o.invalidation != null ? fmtPx(Number(o.invalidation)) : null)}
        {line("Long if", o.long_plan)}
        {line("Short if", o.short_plan)}
        {line("Watching", o.indicators)}
        {line("Chart", o.chart_note)}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<BoardRow["status"], string> = {
  "A+ SETUP": "border-accent-green/40 bg-accent-green/[0.12] text-accent-green",
  TRIGGERED: "border-accent-cyan/40 bg-accent-cyan/[0.10] text-accent-cyan",
  "AT LEVEL": "border-amber-300/40 bg-amber-300/[0.10] text-amber-200",
  WAIT: "border-white/10 bg-white/[0.03] text-white/45",
};

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${on ? "text-white/85" : "text-white/30"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent-green" : "bg-white/20"}`} aria-hidden />
      {label}
    </span>
  );
}

/** Price between its nearest levels: up to 2 below and 2 above, on one track. */
function Ladder({ r }: { r: BoardRow }) {
  const pts: Level[] = [...(r.below ?? []), ...(r.above ?? [])];
  const price = r.price;
  if (price == null || pts.length === 0) return <div className="h-9 text-[11px] text-white/30">no levels on file</div>;
  const all = [...pts.map((l) => Number(l.px)), price];
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || hi * 0.01;
  const pos = (v: number) => 4 + ((v - lo) / span) * 92;
  return (
    <div className="relative h-9 w-full" aria-label={`${r.asset} price between its nearest levels`}>
      <div className="absolute left-0 right-0 top-[15px] h-px bg-white/10" />
      {pts.map((l, i) => {
        const x = pos(Number(l.px));
        return (
          <div key={`${l.key}-${i}`} className="absolute top-[9px] -translate-x-1/2" style={{ left: `${x}%` }}>
            <div className={`mx-auto h-[13px] w-px ${SRC_TICK[l.src] ?? "bg-white/45"}`} />
            <div className={`mt-0.5 whitespace-nowrap text-center font-mono text-[9.5px] leading-none ${SRC_TEXT[l.src] ?? "text-white/40"}`}>
              {l.src === "yours" && l.key === "mine" ? "Yours" : SHORT[l.key] ?? l.key}
            </div>
          </div>
        );
      })}
      <div className="absolute top-[10px] -translate-x-1/2" style={{ left: `${pos(price)}%` }}>
        <div className="h-[11px] w-[11px] rounded-full border-2 border-black bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)]" />
      </div>
    </div>
  );
}

function Nearest({ l, dir }: { l?: Level; dir: "up" | "down" }) {
  if (!l) return <span className="text-white/25">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className={dir === "up" ? "text-rose-300/80" : "text-accent-green/80"}>{dir === "up" ? "▲" : "▼"}</span>{" "}
      <span className="font-mono tabular-nums text-white/80">{fmtPx(Number(l.px))}</span>{" "}
      <span className="text-white/35">{l.dist_pct > 0 ? "+" : ""}{l.dist_pct}%</span>
    </span>
  );
}

function Row({ r }: { r: BoardRow }) {
  const ladder = (r.ladder ?? []).slice().sort((a, b) => Number(b.px) - Number(a.px));
  const priceIdx = ladder.findIndex((l) => Number(l.px) <= Number(r.price));
  const chart = r.tv_symbol ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(r.tv_symbol)}` : null;
  const trig = r.status === "TRIGGERED" && r.trigger;
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.015] transition open:bg-white/[0.03] hover:border-white/[0.12]">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[110px_minmax(0,1fr)_200px] sm:px-4 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-white">{r.asset}</span>
          {r.changes.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" title={r.changes.join(" · ")} aria-label="changed since yesterday" />}
          {r.my_view && (
            <span className={`hidden gap-2 sm:inline-flex ${r.my_view.stale ? "opacity-50" : ""}`} title="Your view (higher / lower timeframe)">
              <span className={`text-[11px] font-semibold ${r.my_view.htf_bias ? BIAS_TONE[r.my_view.htf_bias] : "text-white/30"}`}>{r.my_view.htf_bias ? r.my_view.htf_bias[0].toUpperCase() : "–"}</span>
              <span className={`text-[11px] ${r.my_view.ltf_bias ? BIAS_TONE[r.my_view.ltf_bias] : "text-white/30"}`}>{r.my_view.ltf_bias ? r.my_view.ltf_bias[0].toLowerCase() : "–"}</span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 sm:order-3">
          <span className="font-mono text-[13.5px] tabular-nums text-white">{fmtPx(r.price)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide ${STATUS_STYLE[r.status]}`}>{r.status}</span>
        </div>
        <div className="col-span-2 sm:order-2 sm:col-span-1">
          <Ladder r={r} />
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11.5px] sm:order-4 sm:col-span-3">
          <div className="flex flex-wrap gap-x-3">
            <Nearest l={r.below?.[0]} dir="down" />
            <Nearest l={r.above?.[0]} dir="up" />
          </div>
          <div className="flex gap-3">
            <Check on={!!r.at_level || r.status === "TRIGGERED" || r.status === "A+ SETUP"} label="Level" />
            <Check on={r.status === "TRIGGERED" || r.status === "A+ SETUP"} label="Trigger" />
            <Check on={r.market_ok} label="Market" />
          </div>
        </div>
      </summary>

      <div className="space-y-4 border-t border-white/[0.06] px-3 pb-4 pt-3 sm:px-4">
        {r.my_view ? <MyView o={r.my_view} title={`Your view — ${r.asset}`} /> : <p className="text-[12px] text-white/35">No view of yours on file for {r.asset} — tell Grok your HTF/LTF bias and levels and it shows here.</p>}
        <p className="text-[13px] leading-snug text-white/75">
          {statusWord(r.status)}
          {r.at_level && r.status !== "TRIGGERED" ? ` (${r.at_level})` : ""}
          {trig ? ` — ${r.trigger!.side === "long" ? "swept below" : "swept above"} the ${LEVEL_NAME[r.trigger!.level] ?? r.trigger!.level} ${fmtPx(Number(r.trigger!.px))} and closed back on the 4h bar of ${whenShort(r.trigger!.bar)}.` : "."}
          {r.setup ? ` Live: ${r.setup}.` : ""}
          {!r.market_ok ? ` ${r.market_text}.` : ""}
        </p>

        {r.changes.length > 0 && (
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-[12.5px] text-amber-100/90">
            Changed since yesterday: {r.changes.join(" · ")}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <ol className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">
            {ladder.map((l, i) => (
              <li key={`${l.key}-${i}`}>
                {i === priceIdx && (
                  <div className="flex items-center justify-between bg-white/[0.06] px-3 py-1.5 text-[12px]">
                    <span className="font-semibold text-white">Price now</span>
                    <span className="font-mono tabular-nums text-white">{fmtPx(r.price)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12.5px]">
                  <span className={l.src === "yours" ? "text-amber-200" : l.src === "moonbag" ? "text-accent-cyan/85" : "text-white/70"}>{l.src === "yours" && l.key === "mine" ? `Yours: ${l.label}` : l.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono tabular-nums text-white/90">{fmtPx(Number(l.px))}</span>
                    <span className="w-14 text-right font-mono text-[11px] tabular-nums text-white/35">{l.dist_pct > 0 ? "+" : ""}{l.dist_pct}%</span>
                  </span>
                </div>
              </li>
            ))}
            {priceIdx === -1 && (
              <li className="flex items-center justify-between bg-white/[0.06] px-3 py-1.5 text-[12px]">
                <span className="font-semibold text-white">Price now</span>
                <span className="font-mono tabular-nums text-white">{fmtPx(r.price)}</span>
              </li>
            )}
          </ol>
          <div className="space-y-3 text-[12.5px]">
            {r.monday?.high != null && (
              <div className="rounded-lg border border-white/[0.06] px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Monday range · week of {r.monday.week}</div>
                <div className="mt-1 font-mono tabular-nums text-white/85">{fmtPx(Number(r.monday.low))} – {fmtPx(Number(r.monday.high))}</div>
                <div className="mt-1 text-white/55">
                  {r.monday.dev_high ? `Swept the high and closed back below (${whenShort(r.monday.dev_high)}). ` : ""}
                  {r.monday.dev_low ? `Swept the low and closed back above (${whenShort(r.monday.dev_low)}). ` : ""}
                  {!r.monday.dev_high && !r.monday.dev_low ? "No sweep of the Monday range yet this week." : ""}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-white/60">
              4h RSI <span className="font-mono text-white/85">{r.rsi_4h ?? "—"}</span>
              {r.rsi_4h != null && (r.rsi_4h <= 30 ? " · stretched down" : r.rsi_4h >= 70 ? " · stretched up" : "")}
            </div>
            {chart && (
              <a href={chart} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center rounded-lg border border-white/10 px-3 text-[12.5px] text-white/80 hover:border-white/25 hover:text-white">
                Open chart on TradingView →
              </a>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

export default async function LevelsPage() {
  const { data, error } = await load(() => getLevelsBoard());
  const rows = data ?? [];
  const sections = ["Core", "Top 5", "Traded"].map((s) => ({ s, rows: rows.filter((r) => r.section === s) })).filter((x) => x.rows.length);
  const first = rows[0];
  const btc = rows.find((r) => r.asset === "BTC");
  const flip = btc?.levels?.flip != null ? Number(btc.levels.flip) : null;
  const live = rows.filter((r) => r.status !== "WAIT").length;
  const mk = first?.my_market ?? null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Levels"
        sub="Your range levels for every coin you watch — where price sits, what changed, and whether anything is worth your attention. Range levels reset at the daily close (5 PM Phoenix)."
      />
      <Stamps>
        <Updated at={first?.computed_at} label="levels" cadenceH={4} />
        <Updated at={first?.price_at} label="prices" verb="as of" cadenceH={0.5} />
      </Stamps>
      <DataNotice error={error} />

      {mk && <MyView o={mk} title="Your market view" />}
      {first && !mk && (
        <p className="px-1 text-[12px] text-white/40">No market view of yours on file — tell Grok your macro / HTF / LTF read and it leads this page.</p>
      )}

      {first && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${first.market_ok ? "border-accent-green/25 bg-accent-green/[0.05]" : "border-amber-300/20 bg-amber-300/[0.04]"}`}>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Market</div>
            <div className={`text-[14px] ${first.market_ok ? "text-accent-green" : "text-amber-100/90"}`}>
              {flip == null
                ? "No current BTC flip line — give Grok yours (above = bullish, below = bearish)."
                : first.market_ok ? `Confirmed — BTC is holding above ${btc?.levels?.flip_mine ? "your" : "its"} flip line (${fmtPx(flip)}) and risk is on.` : `Patience — BTC is below ${btc?.levels?.flip_mine ? "your" : "its"} flip line (${fmtPx(flip)}). Alts need BTC to confirm first.`}
            </div>
          </div>
          <div className="text-right text-[12px] text-white/45">
            <span className="font-mono text-[18px] text-white">{live}</span> of {rows.length} coins at a level or triggered
          </div>
        </div>
      )}

      {rows.length === 0 && !error && <Card><Empty>No levels yet — they are computed at the next 4h close.</Empty></Card>}

      {sections.map(({ s, rows: rs }) => (
        <section key={s} className="space-y-2">
          <h2 className="px-1 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/40">{s === "Traded" ? "Coins you've traded" : s === "Top 5" ? "Top 5 rotation" : "Core"}</h2>
          <div className="space-y-2">{rs.map((r) => <Row key={r.asset} r={r} />)}</div>
        </section>
      ))}

      {rows.length > 0 && (
        <p className="px-1 text-[11.5px] leading-relaxed text-white/35">
          Amber ticks are the levels and flip line you gave Grok; white ticks are the range levels (week open, previous week, month open, previous month, Monday high/low, yesterday&apos;s high/low); blue ticks are Moonbag&apos;s range.
          Level = price within half a 4h candle of a level. Trigger = a 4h candle swept a key level and closed back, and price is still on the right side of it.
          Market = BTC holding above its flip line with risk on. Context only — only Moonbag A/A+ setups are trades. Prices are BloFin; TradingView charts on other exchanges can differ by a few hundredths of a percent.
        </p>
      )}
    </div>
  );
}
