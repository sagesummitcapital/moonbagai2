// Small, server-safe UI primitives for the Moonbag dashboard.
// Design system (see design_plan.md): one hero figure per card, tabular numerals on every figure,
// colour is never the only signal (+/− and ▲/▼ always ride along), long prose folds behind <details>.
import type { ReactNode } from "react";

export type Tone = "green" | "red" | "amber" | "cyan" | "gray";

// ------------------------------------------------------------------ containers

export function Card({ title, right, sub, children, className = "", tone }: {
  title?: ReactNode; right?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string; tone?: "accent" | "warn" | "info";
}) {
  const ring =
    tone === "accent" ? "border-accent-green/30 bg-accent-green/[0.035]"
    : tone === "warn" ? "border-amber-300/25 bg-amber-300/[0.03]"
    : tone === "info" ? "border-accent-cyan/25 bg-accent-cyan/[0.03]"
    : "border-white/[0.08] bg-white/[0.025]";
  return (
    <section className={`min-w-0 rounded-2xl border p-4 md:p-5 ${ring} ${className}`}>
      {(title || right || sub) && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/55">{title}</h2>}
            {right && <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-white/50">{right}</div>}
          </div>
          {sub && <p className="mt-1 max-w-[70ch] text-[12.5px] leading-snug text-white/50">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page title block: h1 + one-line purpose + optional right-hand controls. */
export function PageHeader({ title, kicker, sub, right }: { title: ReactNode; kicker?: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-white">
          {title}
          {kicker && <span className="text-white/40"> · {kicker}</span>}
        </h1>
        {sub && <p className="mt-1 max-w-[70ch] text-[13px] leading-snug text-white/55">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/** A sub-heading inside a card. */
export function Section({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`mt-5 first:mt-0 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</h3>
        {right && <div className="text-[12px] text-white/45">{right}</div>}
      </div>
      {children}
    </div>
  );
}

/** Grid for the KPI row at the top of a page: 2-up on phones, up to 4/5 on desktop. */
export function StatGrid({ children, cols = 4, className = "" }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  const c = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4", 5: "md:grid-cols-3 lg:grid-cols-5" }[cols];
  return <div className={`grid grid-cols-2 gap-3 ${c} ${className}`}>{children}</div>;
}

/** A plain inner tile (used inside cards for secondary groups). */
export function Tile({ title, right, children, className = "", tone }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; tone?: "accent" | "warn" | "info" }) {
  const ring =
    tone === "accent" ? "border-accent-green/40 bg-accent-green/[0.05]"
    : tone === "warn" ? "border-amber-300/30 bg-amber-300/[0.04]"
    : tone === "info" ? "border-accent-cyan/30 bg-accent-cyan/[0.04]"
    : "border-white/[0.08] bg-white/[0.02]";
  return (
    <div className={`min-w-0 rounded-xl border p-3.5 ${ring} ${className}`}>
      {(title || right) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {title && <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ figures

const TONE_TEXT: Record<Tone, string> = {
  green: "text-accent-green", red: "text-rose-300", amber: "text-amber-200", cyan: "text-accent-cyan", gray: "text-white/70",
};
export const toneText = (t?: Tone | null) => (t ? TONE_TEXT[t] : "text-white");

/**
 * KPI figure. `value` is the one number the card is about; `trend` / `meter` sit under it.
 * `size`: "lg" (hero, 30px) · "md" (22px) · "sm" (18px, for text values).
 */
export function Stat({ label, value, sub, tone, size = "lg", trend, meter, right }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; size?: "lg" | "md" | "sm"; trend?: ReactNode; meter?: ReactNode; right?: ReactNode;
}) {
  const sz = size === "lg" ? "text-[26px] md:text-[30px]" : size === "md" ? "text-[22px]" : "text-[17px]";
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">{label}</div>
        {right}
      </div>
      <div className={`mt-1.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 ${trend ? "" : ""}`}>
        <div className={`min-w-0 break-words font-mono ${sz} font-semibold leading-none tabular-nums ${toneText(tone)}`}>{value}</div>
        {trend && <div className="shrink-0">{trend}</div>}
      </div>
      {meter && <div className="mt-3">{meter}</div>}
      {sub && <div className="mt-1.5 text-[12.5px] leading-snug text-white/50">{sub}</div>}
    </div>
  );
}

/** A unit suffix inside a Stat value: `{money(x)}<Unit>of $12</Unit>`. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-[13px] font-normal text-white/45">{children}</span>;
}

/**
 * A field that is usually one word (e.g. "bullish") but in practice may be a full sentence
 * (market regime, risk environment). Short → shown as a figure; long → readable prose with an expander.
 */
export function TextValue({ text, max = 28, className = "" }: { text?: string | null; max?: number; className?: string }) {
  if (!text) return <span className="font-mono text-[20px] font-semibold text-white/40">—</span>;
  if (text.length <= max) return <span className={`font-mono text-[20px] font-semibold capitalize leading-none text-white ${className}`}>{text}</span>;
  return <LongText text={text} max={110} className={`text-[14px] font-medium leading-snug text-white/90 ${className}`} />;
}

/** Signed value with a direction glyph, e.g. ▲ +1.25R · ▼ −0.60R. Colour and sign always travel together. */
export function Delta({ v, d = 2, unit = "", prefix = "", arrow = true, className = "" }: {
  v: number | null | undefined; d?: number; unit?: string; prefix?: string; arrow?: boolean; className?: string;
}) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return <span className={`font-mono tabular-nums text-white/40 ${className}`}>—</span>;
  // A value that prints as 0.00 is shown as zero (grey, no sign) — never "−0.00" in red.
  const raw = Number(v);
  const n = Number(Math.abs(raw).toLocaleString("en-US", { maximumFractionDigits: d, useGrouping: false })) === 0 ? 0 : raw;
  const tone: Tone = n > 0 ? "green" : n < 0 ? "red" : "gray";
  const glyph = !arrow ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return (
    <span className={`whitespace-nowrap font-mono tabular-nums ${TONE_TEXT[tone]} ${className}`}>
      {glyph}{sign}{prefix}{Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}{unit}
    </span>
  );
}

/** R multiple, e.g. +1.25R — the leverage desk's unit. */
export function RMult({ v, d = 2 }: { v: number | null | undefined; d?: number }) {
  return <Delta v={v} d={d} unit="R" arrow={false} />;
}

/** Signed money: +$12.30 / −$4.10, coloured. */
export function Money({ v, signed = true }: { v: number | null | undefined; signed?: boolean }) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return <span className="font-mono tabular-nums text-white/40">—</span>;
  const n = Number(v);
  if (!signed) return <span className="font-mono tabular-nums text-white/85">{money(n)}</span>;
  const tone: Tone = n > 0 ? "green" : n < 0 ? "red" : "gray";
  return <span className={`whitespace-nowrap font-mono tabular-nums ${TONE_TEXT[tone]}`}>{n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

/** Plain numeral cell: mono + tabular. */
export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{children}</span>;
}

// ------------------------------------------------------------------ badges & chips

const TONES: Record<string, string> = {
  green: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  red: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  cyan: "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan",
  gray: "border-white/15 bg-white/[0.05] text-white/70",
};
const DOTS: Record<string, string> = { green: "bg-accent-green", red: "bg-rose-400", amber: "bg-amber-300", cyan: "bg-accent-cyan", gray: "bg-white/40" };

export function Badge({ tone = "gray", children, dot = false, className = "" }: { tone?: keyof typeof TONES | string; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11.5px] leading-[18px] ${TONES[tone] ?? TONES.gray} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone] ?? DOTS.gray}`} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** A compact label → value chip for lists of coins / levels. */
export function Chip({ label, value, tone = "gray", className = "" }: { label: ReactNode; value?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[12.5px] leading-tight ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone]}`} />
      <span className="font-semibold text-white">{label}</span>
      {value !== undefined && <span className="min-w-0 break-words font-mono tabular-nums text-white/60">{value}</span>}
    </span>
  );
}

export function Chips({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap gap-1.5 ${className}`}>{children}</div>;
}

export function biasTone(bias?: string | null): Tone {
  if (bias === "bullish" || bias === "long" || bias === "bull") return "green";
  if (bias === "bearish" || bias === "short" || bias === "bear") return "red";
  if (bias === "mixed") return "amber";
  return "gray";
}

export const biasGlyph = (bias?: string | null) =>
  bias === "bullish" || bias === "long" || bias === "bull" ? "▲" : bias === "bearish" || bias === "short" || bias === "bear" ? "▼" : "◆";

export function statusTone(s?: string | null): Tone {
  if (!s) return "gray";
  if (["active", "open", "pending", "trade", "live", "executed", "bull"].includes(s)) return "green";
  if (["triggered", "acknowledged", "watch", "paper"].includes(s)) return "cyan";
  if (["stale", "no_trade", "late", "expired"].includes(s)) return "amber";
  if (["rejected", "invalidated", "cancelled", "retired", "error", "bear"].includes(s)) return "red";
  return "gray";
}

export const gradeTone = (g?: number | null): Tone => (g == null ? "gray" : g >= 5 ? "green" : g >= 4 ? "cyan" : g >= 3 ? "amber" : "gray");
export const gradeName = (g?: number | null) => (g == null ? "" : g >= 5 ? "A+" : g >= 4 ? "A" : g >= 3 ? "B" : "C");

// ------------------------------------------------------------------ empty / notes

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-[13.5px] leading-snug text-white/45">{children}</div>;
}

/** Footnote under a table or chart. */
export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-3 max-w-[80ch] text-[12.5px] leading-snug text-white/45 ${className}`}>{children}</p>;
}

// ------------------------------------------------------------------ progressive disclosure

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="mt-[3px] shrink-0 text-white/40 transition group-open:rotate-90">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Server-rendered expander (<details>) — keyboard accessible, no JS. */
export function Expander({ summary, children, className = "", open = false, padded = true }: {
  summary: ReactNode; children: ReactNode; className?: string; open?: boolean; padded?: boolean;
}) {
  return (
    <details open={open} className={`group rounded-xl border border-white/[0.06] bg-white/[0.015] ${padded ? "px-3.5 py-2.5" : ""} ${className}`}>
      <summary className="flex cursor-pointer list-none items-start gap-2 text-[13px] text-white/75 hover:text-white [&::-webkit-details-marker]:hidden">
        <Chevron />
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="mt-2.5 pl-[22px]">{children}</div>
    </details>
  );
}

const firstSentence = (t: string, max: number) => {
  const m = t.match(/^.*?[.!?](\s|$)/);
  const x = (m ? m[0] : t).trim();
  return x.length > max ? `${x.slice(0, max - 1).trimEnd()}…` : x;
};

/**
 * Long prose: first sentence visible, the rest one tap away. Short text renders as-is.
 * `label` prefixes both states ("Why:", "Primary:").
 */
export function LongText({ text, max = 160, label, className = "text-[13.5px] leading-relaxed text-white/75" }: {
  text?: string | null; max?: number; label?: ReactNode; className?: string;
}) {
  if (!text) return null;
  const lead = label ? <span className="text-white/45">{label} </span> : null;
  const teaser = firstSentence(text, max);
  if (text.length <= max || teaser.length >= text.trim().length) return <p className={`max-w-[72ch] whitespace-pre-wrap break-words ${className}`}>{lead}{text}</p>;
  return (
    <details className={`group max-w-[72ch] ${className}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{lead}{teaser} <span className="whitespace-nowrap text-[12px] text-accent-cyan">more ▾</span></span>
        <span className="hidden text-[12px] text-white/45 group-open:inline">{lead}<span className="text-accent-cyan">less ▴</span></span>
      </summary>
      <p className="mt-1 whitespace-pre-wrap break-words">{text}</p>
    </details>
  );
}

/** Markdown/plain-text document in a scroll box behind an expander. */
export function DocText({ text, summary, open = false }: { text: string; summary: ReactNode; open?: boolean }) {
  return (
    <Expander summary={summary} open={open}>
      <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap break-words font-sans text-[13.5px] leading-relaxed text-white/75">{text}</pre>
    </Expander>
  );
}

// ------------------------------------------------------------------ tables

export function Table({ head, rows, empty = "Nothing here yet.", align, minWidth, dense = false, maxHeight }: {
  head: ReactNode[]; rows: ReactNode[][]; empty?: ReactNode;
  /** per-column alignment, "r" for numerals (default left). */
  align?: ("l" | "r" | "c")[];
  /** min table width in px before it scrolls inside the card. Defaults to 96px per column (min 420). */
  minWidth?: number;
  dense?: boolean;
  /** scroll vertically inside the card past this height (px); header stays visible. */
  maxHeight?: number;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const mw = minWidth ?? (head.length <= 3 ? 0 : Math.max(420, head.length * 96));
  const al = (i: number) => (align?.[i] === "r" ? "text-right" : align?.[i] === "c" ? "text-center" : "text-left");
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
      <table className={`w-full border-separate border-spacing-0 text-left ${dense ? "text-[12.5px]" : "text-[13px]"}`} style={mw ? { minWidth: mw } : undefined}>
        <thead className={maxHeight ? "sticky top-0 z-[1] bg-[#0b0b0d]" : ""}>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`whitespace-nowrap border-b border-white/[0.1] pb-2 pr-3 text-[11.5px] font-medium uppercase tracking-[0.1em] text-white/40 last:pr-0 ${al(i)}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top text-white/80 hover:bg-white/[0.02]">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-white/[0.05] pr-3 last:pr-0 ${dense ? "py-1.5" : "py-2.5"} ${al(j)} ${align?.[j] === "r" ? "font-mono tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Label / value rows (levels, rules). Values are numerals by default. */
export function KV({ rows, className = "", cols = 1 }: { rows: [ReactNode, ReactNode][]; className?: string; cols?: 1 | 2 }) {
  return (
    <dl className={`grid gap-x-6 gap-y-0 text-[13px] ${cols === 2 ? "md:grid-cols-2" : ""} ${className}`}>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] py-1.5 last:border-b-0">
          <dt className="shrink-0 text-white/45">{k}</dt>
          <dd className="min-w-0 break-words text-right font-mono tabular-nums text-white/85">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A single cell "label over value" used in signal cards. */
export function Cell({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[11.5px] leading-tight uppercase tracking-[0.1em] text-white/40">{k}</div>
      <div className={`mt-0.5 break-words font-mono text-[13px] tabular-nums ${toneText(tone)} ${tone ? "" : "text-white/90"}`}>{v}</div>
    </div>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`break-words font-mono text-[12px] tabular-nums text-white/50 ${className}`}>{children}</span>;
}

/** An identifier (MB-2026-10-10-BTC-001): mono, never broken across lines. */
export function Id({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap font-mono text-[12px] tabular-nums text-white/50 ${className}`}>{children}</span>;
}

// ------------------------------------------------------------------ formatters

export const num = (v: unknown, d = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: d });

export const money = (v: unknown) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : `${Number(v) < 0 ? "-" : ""}$${Math.abs(Number(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** $1,000 without cents, for ladders and limits. */
export const money0 = (v: unknown) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : `${Number(v) < 0 ? "-" : ""}$${Math.abs(Number(v)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export const TZ = "America/Phoenix";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "9:41 AM" today, "Oct 9, 1:30 PM" on any other day (Phoenix). `seconds` adds :07 for live feeds. */
export const whenShort = (iso?: string | null, seconds = false, now = new Date()) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
  return dayKey(d) === dayKey(now) ? time : `${d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" })}, ${time}`;
};

/** Price formatter that keeps small-cap coins readable: 82,371.06 · 2,493.96 · 0.6190 · 0.000123. */
/** Price with 2 decimals (coins under $1 get 4 so they stay readable). Stavros, 2026-10-13: "only show .00 decimal points". */
export const px2 = (v: unknown) => {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
  const d = Math.abs(Number(v)) >= 1 ? 2 : 4;
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const px = (v: unknown) => {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "—";
  const x = Math.abs(Number(v));
  const d = x >= 10 ? 2 : x >= 1 ? 4 : x >= 0.01 ? 4 : 6;
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: x >= 1 ? 2 : 0, maximumFractionDigits: d });
};

/** Freshness tone for a stored record against the cadence it is supposed to be written at. */
export function freshness(iso: string | null | undefined, cadenceH: number, now = Date.now()): { tone: Tone; ageMin: number | null } {
  if (!iso) return { tone: "gray", ageMin: null };
  const ageMin = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  const h = ageMin / 60;
  return { tone: h <= cadenceH ? "green" : h <= cadenceH * 2 ? "amber" : "red", ageMin };
}

const STAMP_DOT: Record<Tone, string> = { green: "bg-accent-green", red: "bg-rose-400", amber: "bg-amber-300", cyan: "bg-accent-cyan", gray: "bg-white/30" };
const STAMP_TEXT: Record<Tone, string> = { green: "text-white/50", red: "text-rose-300", amber: "text-amber-200", cyan: "text-accent-cyan", gray: "text-white/40" };

/**
 * "desk map · updated 2:04 AM (7h ago)" — the timestamp of the stored record a block is drawn from.
 * Green inside the block's expected cadence, amber up to twice that, red beyond. Server-rendered.
 */
export function Updated({ at, label, cadenceH = 24, verb = "updated", className = "", title }: {
  at: string | null | undefined; label?: ReactNode; cadenceH?: number; verb?: string; className?: string; title?: string;
}) {
  const f = freshness(at, cadenceH);
  const rel = f.ageMin == null ? "" : f.ageMin < 1 ? "just now" : f.ageMin < 60 ? `${f.ageMin}m ago` : f.ageMin < 48 * 60 ? `${Math.round(f.ageMin / 60)}h ago` : `${Math.round(f.ageMin / 1440)}d ago`;
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 font-mono text-[11.5px] leading-[18px] tabular-nums ${STAMP_TEXT[f.tone]} ${className}`}
      title={title ?? (at ? `${label ? `${label} ` : ""}${verb} ${new Date(at).toLocaleString("en-US", { timeZone: TZ })} Phoenix · expected every ~${cadenceH}h` : "no record yet")}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STAMP_DOT[f.tone]}`} aria-hidden />
      {label && <span className="whitespace-nowrap text-white/45">{label} ·</span>}
      <span className="whitespace-nowrap">{at ? `${verb ? `${verb} ` : ""}${whenShort(at)}` : "no record yet"}</span>
      {rel && <span className="whitespace-nowrap text-white/35">({rel})</span>}
    </span>
  );
}

/** Row of Updated chips under a header. */
export function Stamps({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>{children}</div>;
}

export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export const list = (v: unknown) =>
  Array.isArray(v) && v.length ? v.map((x) => (typeof x === "number" ? num(x) : String(x))).join(", ") : "—";

export const signed = (v: number | null | undefined, d = 2, unit = "") =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}${unit}`;

export const valueTone = (v: number | null | undefined): Tone => (v == null || v === 0 || Number.isNaN(Number(v)) ? "gray" : v > 0 ? "green" : "red");
