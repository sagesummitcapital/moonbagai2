// Hand-written SVG / CSS charts for the desk. Server-safe, no dependencies.
// Every chart is drawn only from numbers the page already loads.
import type { ReactNode } from "react";
import type { LivePrice as LP, PriceKind } from "@/lib/moonbag/prices";
import type { Tone } from "./ui";
import { num } from "./ui";
import { LadderMarker, type Stored } from "./LivePrice";

const FILL: Record<Tone, string> = { green: "#3ef3a2", red: "#fda4af", amber: "#fde68a", cyan: "#36d1dc", gray: "rgba(255,255,255,0.55)" };
const TEXT: Record<Tone, string> = { green: "text-accent-green", red: "text-rose-300", amber: "text-amber-200", cyan: "text-accent-cyan", gray: "text-white/60" };
const STRIP_BG: Record<Tone, string> = { green: "bg-accent-green/80 text-black", red: "bg-rose-400/80 text-black", amber: "bg-amber-300/80 text-black", cyan: "bg-accent-cyan/80 text-black", gray: "bg-white/[0.12] text-white/80" };
const BG: Record<Tone, string> = { green: "bg-accent-green", red: "bg-rose-400", amber: "bg-amber-300", cyan: "bg-accent-cyan", gray: "bg-white/50" };

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/** Severity by how much of a budget is used: calm → caution → danger. */
export const budgetTone = (ratio: number): Tone => (ratio >= 0.85 ? "red" : ratio >= 0.6 ? "amber" : "green");

/**
 * Horizontal meter against a budget. `max` is the full bar; `limit` draws a tick (defaults to max).
 * `marks` add labelled ticks (milestones). `tone` "auto" colours by how much of the limit is used.
 */
export function Meter({ value, max, limit, marks = [], tone = "auto", height = 8, labels, className = "" }: {
  value: number; max: number; limit?: number; marks?: { at: number; label?: ReactNode }[]; tone?: Tone | "auto"; height?: number;
  /** left / right captions under the bar */
  labels?: [ReactNode, ReactNode]; className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const ratio = clamp(value / safeMax);
  const lim = limit ?? max;
  const t: Tone = tone === "auto" ? budgetTone(lim > 0 ? value / lim : 0) : tone;
  const hasMarks = marks.length > 0;
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="relative w-full overflow-visible rounded-full bg-white/[0.07]" style={{ height }}>
        <div className={`h-full rounded-full ${BG[t]} transition-all`} style={{ width: `${Math.max(ratio > 0 ? 1.5 : 0, ratio * 100)}%` }} />
        {limit != null && limit < max && (
          <div className="absolute -top-1 w-px bg-white/60" style={{ left: `${clamp(limit / safeMax) * 100}%`, height: height + 8 }} title="limit" />
        )}
        {marks.map((m, i) => (
          <div key={i} className="absolute -top-[3px] w-px bg-white/35" style={{ left: `${clamp(m.at / safeMax) * 100}%`, height: height + 6 }} />
        ))}
      </div>
      {(labels || hasMarks) && (
        <div className="relative mt-1.5 h-4 text-[11.5px] tabular-nums text-white/45">
          {labels && <span className="absolute left-0">{labels[0]}</span>}
          {labels && <span className="absolute right-0">{labels[1]}</span>}
          {!labels &&
            marks.map((m, i) => (
              <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap font-mono" style={{ left: `${clamp(m.at / safeMax) * 100}%` }}>
                {m.label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

/** Thin 0–100 score bar for table cells and component lists. */
export function ScoreBar({ value, max = 100, tone = "cyan", label, width = "w-full" }: { value: number | null | undefined; max?: number; tone?: Tone; label?: ReactNode; width?: string }) {
  const v = value == null || Number.isNaN(Number(value)) ? null : Number(value);
  return (
    <span className={`inline-flex items-center gap-2 ${width}`}>
      <span className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span className={`block h-full rounded-full ${BG[tone]}`} style={{ width: `${v == null ? 0 : clamp(v / max) * 100}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right font-mono text-[12px] tabular-nums text-white/75">{label ?? (v == null ? "—" : num(v, 0))}</span>
    </span>
  );
}

/**
 * Sparkline. `points` oldest → newest. Draws a 2px line, a soft area and a dot on the last value.
 * Colour defaults to the direction of the whole series.
 */
export function Sparkline({ points, width = 120, height = 32, tone, area = true, className = "", baseline }: {
  points: (number | null | undefined)[]; width?: number; height?: number; tone?: Tone; area?: boolean; className?: string; baseline?: number;
}) {
  const xs = points.map((p) => (p == null || Number.isNaN(Number(p)) ? null : Number(p)));
  const vals = xs.filter((x): x is number => x != null);
  if (vals.length < 2) return <svg width={width} height={height} className={className} aria-hidden />;
  const lo = Math.min(...vals, baseline ?? Infinity), hi = Math.max(...vals, baseline ?? -Infinity);
  const pad = 3;
  const sx = (i: number) => pad + (i / (xs.length - 1)) * (width - pad * 2);
  const sy = (v: number) => (hi === lo ? height / 2 : pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2));
  const t: Tone = tone ?? (vals[vals.length - 1] >= vals[0] ? "green" : "red");
  let d = "", started = false;
  xs.forEach((v, i) => { if (v == null) return; d += `${started ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)} `; started = true; });
  const firstIdx = xs.findIndex((v) => v != null), lastIdx = xs.length - 1 - [...xs].reverse().findIndex((v) => v != null);
  const areaD = `${d}L${sx(lastIdx).toFixed(1)},${height} L${sx(firstIdx).toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={`trend, ${vals.length} points, latest ${num(vals[vals.length - 1])}`}>
      {area && <path d={areaD} fill={FILL[t]} opacity={0.12} />}
      {baseline != null && <line x1={0} x2={width} y1={sy(baseline)} y2={sy(baseline)} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" />}
      <path d={d} fill="none" stroke={FILL[t]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(lastIdx)} cy={sy(xs[lastIdx] as number)} r={3.5} fill={FILL[t]} stroke="#0b0b0d" strokeWidth={2} />
    </svg>
  );
}

/**
 * Line/area chart with a y-axis (min / max / zero) and first/last x labels. Scales to the card width.
 * `series` oldest → newest; `labels` optional per-point captions used for the ends.
 */
export function LineChart({ series, labels, height = 150, tone, baseline = 0, format = (v: number) => num(v, 2), className = "" }: {
  series: number[]; labels?: string[]; height?: number; tone?: Tone; baseline?: number | null; format?: (v: number) => string; className?: string;
}) {
  if (series.length < 2) return null;
  const W = 640, H = height, padL = 6, padR = 6, padT = 10, padB = 20;
  const lo = Math.min(...series, baseline ?? Infinity), hi = Math.max(...series, baseline ?? -Infinity);
  const sx = (i: number) => padL + (i / (series.length - 1)) * (W - padL - padR);
  const sy = (v: number) => (hi === lo ? H / 2 : padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB));
  const t: Tone = tone ?? (series[series.length - 1] >= series[0] ? "green" : "red");
  const d = series.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const areaD = `${d} L${sx(series.length - 1).toFixed(1)},${H - padB} L${sx(0).toFixed(1)},${H - padB} Z`;
  const last = series[series.length - 1];
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between text-[11.5px] tabular-nums text-white/45">
        <span>high {format(hi)}</span>
        <span className={`font-mono ${TEXT[t]}`}>now {format(last)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="block" role="img" aria-label={`${series.length} points from ${format(series[0])} to ${format(last)}`}>
        <line x1={padL} x2={W - padR} y1={sy(hi)} y2={sy(hi)} stroke="rgba(255,255,255,0.06)" />
        <line x1={padL} x2={W - padR} y1={sy(lo)} y2={sy(lo)} stroke="rgba(255,255,255,0.06)" />
        {baseline != null && baseline >= lo && baseline <= hi && <line x1={padL} x2={W - padR} y1={sy(baseline)} y2={sy(baseline)} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 4" />}
        <path d={areaD} fill={FILL[t]} opacity={0.1} />
        <path d={d} fill="none" stroke={FILL[t]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[11.5px] tabular-nums text-white/45">
        <span>{labels?.[0] ?? ""}<span className="ml-2 text-white/35">low {format(lo)}</span></span>
        <span>{labels?.[labels.length - 1] ?? ""}</span>
      </div>
    </div>
  );
}

/**
 * Diverging horizontal bars: positive to the right in green, negative to the left in rose.
 * One row per item; the value is printed beside the label so colour is never the only signal.
 */
export function DivergingBars({ items, format = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`, max, labelWidth = "minmax(72px, 32%)", className = "" }: {
  items: { label: ReactNode; value: number | null | undefined; sub?: ReactNode }[];
  format?: (v: number) => string; max?: number; labelWidth?: string; className?: string;
}) {
  const vals = items.map((i) => (i.value == null ? 0 : Number(i.value)));
  const m = max ?? Math.max(0.01, ...vals.map(Math.abs));
  if (!items.length) return null;
  return (
    <div className={`space-y-1.5 ${className}`} role="img" aria-label={`${items.length} bars`}>
      {items.map((it, i) => {
        const v = vals[i];
        const w = clamp(Math.abs(v) / m) * 50;
        const t: Tone = v > 0 ? "green" : v < 0 ? "red" : "gray";
        return (
          <div key={i} className="grid items-center gap-x-3 text-[12.5px]" style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr) 64px` }}>
            <div className="min-w-0 break-words leading-tight text-white/75">{it.label}{it.sub && <span className="ml-1.5 text-[11.5px] text-white/40">{it.sub}</span>}</div>
            <div className="relative h-3">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
              {v !== 0 && (
                <div
                  className={`absolute top-0 h-3 ${BG[t]} ${v > 0 ? "rounded-r" : "rounded-l"}`}
                  style={v > 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                  title={format(v)}
                />
              )}
            </div>
            <div className={`text-right font-mono tabular-nums ${it.value == null ? "text-white/40" : TEXT[t]}`}>{it.value == null ? "—" : format(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Simple magnitude bars (one hue): win rates, counts, accuracies. */
export function Bars({ items, max, tone = "cyan", format = (v: number) => num(v, 0), labelWidth = "minmax(72px, 32%)", className = "" }: {
  items: { label: ReactNode; value: number | null | undefined; sub?: ReactNode; tone?: Tone }[];
  max?: number; tone?: Tone; format?: (v: number) => string; labelWidth?: string; className?: string;
}) {
  const vals = items.map((i) => (i.value == null ? 0 : Number(i.value)));
  const m = max ?? Math.max(0.01, ...vals);
  if (!items.length) return null;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {items.map((it, i) => (
        <div key={i} className="grid items-center gap-x-3 text-[12.5px]" style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr) 56px` }}>
          <div className="min-w-0 break-words leading-tight text-white/75">{it.label}{it.sub && <span className="ml-1.5 text-[11.5px] text-white/40">{it.sub}</span>}</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${BG[it.tone ?? tone]}`} style={{ width: `${clamp(vals[i] / m) * 100}%` }} />
          </div>
          <div className="text-right font-mono tabular-nums text-white/80">{it.value == null ? "—" : format(vals[i])}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Price ladder: nearest supports (left, rose) and resistances (right, green) with the live price marked.
 * Labels alternate above/below the rail so neighbours never collide.
 */
export function LevelLadder({ price, below, above, className = "", live }: {
  /** The price to mark. With `live`, this is the best price known at render (live if it answered, else stored). */
  price: number | null; below: number[]; above: number[]; className?: string;
  /** Keep the marker live: it then polls with the page's other live widgets and shows the stored price as a faint tick. */
  live?: { symbol: string; kind?: PriceKind; initial: LP | null | undefined; stored?: Stored };
}) {
  const pts = [...below, ...(price != null ? [price] : []), ...above];
  if (pts.length < 2) return null;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pos = (x: number) => 6 + ((x - lo) / span) * 88;
  const ticks = [...below.map((x) => ({ x, t: "red" as Tone })), ...above.map((x) => ({ x, t: "green" as Tone }))].sort((a, b) => a.x - b.x);
  return (
    <div className={`relative h-[62px] ${className}`} role="img" aria-label={`price ${num(price)} between ${num(lo)} and ${num(hi)}`}>
      <div className="absolute left-0 right-0 top-[28px] h-1.5 rounded-full bg-gradient-to-r from-rose-400/40 via-white/10 to-accent-green/40" />
      {ticks.map((k, i) => (
        <div key={`${k.x}-${i}`} className="absolute -translate-x-1/2" style={{ left: `${pos(k.x)}%`, top: i % 2 ? 36 : 4 }}>
          {i % 2 === 0 && <div className={`whitespace-nowrap font-mono text-[11.5px] tabular-nums ${TEXT[k.t]}`}>{num(k.x)}</div>}
          <div className={`mx-auto w-px bg-white/35 ${i % 2 ? "h-2" : "mt-0.5 h-2"}`} />
          {i % 2 === 1 && <div className={`whitespace-nowrap font-mono text-[11.5px] tabular-nums ${TEXT[k.t]}`}>{num(k.x)}</div>}
        </div>
      ))}
      {live ? (
        <LadderMarker symbol={live.symbol} kind={live.kind} initial={live.initial} stored={live.stored} lo={lo} hi={hi} />
      ) : price != null ? (
        <div className="absolute top-[22px] -translate-x-1/2" style={{ left: `${pos(price)}%` }}>
          <div className="mx-auto h-[18px] w-[3px] rounded bg-white shadow-[0_0_0_2px_#0b0b0d]" title={`price ${num(price)}`} />
        </div>
      ) : null}
    </div>
  );
}

/** Row of small coloured blocks — one per item — for regime strips and health rows. */
export function Strip({ items, className = "" }: { items: { label: string; tone: Tone; title?: string }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {items.map((it, i) => (
        <span key={i} title={it.title ?? it.label} className={`inline-flex h-6 min-w-[34px] items-center justify-center rounded px-1.5 font-mono text-[11.5px] font-medium ${STRIP_BG[it.tone]}`}>
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Legend line: swatch + label pairs. */
export function Legend({ items, className = "" }: { items: { tone: Tone; label: ReactNode }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/50 ${className}`}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${BG[it.tone]}`} />{it.label}</span>
      ))}
    </div>
  );
}
