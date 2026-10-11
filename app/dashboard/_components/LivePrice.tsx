"use client";
// Live-price widgets. Every one of them renders the server-provided value immediately (no layout
// shift) and then shares ONE poller: all mounted widgets register their symbol, and a single request
// per kind (crypto / stock) goes to /dashboard/api/prices every 30 s while the tab is visible.
// A timestamp always rides along with the number — green ≤ 2 min, amber ≤ 60 min, red older or when
// we are showing the desk's stored (decision) price because the live feed did not answer.
import { useEffect, useMemo, useRef, useState } from "react";
import type { LivePrice as LP, PriceKind } from "@/lib/moonbag/prices";
import { Delta, TZ, money, px, whenShort } from "./ui";

export type Stored = { price: number | null | undefined; asOf?: string | null; label?: string };

// ------------------------------------------------------------------ shared poller
type Listener = (p: LP) => void;
const listeners = new Map<string, Set<Listener>>(); // key = kind:SYMBOL
const wantsChange = new Map<string, number>();      // key → how many mounted widgets show the 24 h change
const latest = new Map<string, LP>();
let timer: ReturnType<typeof setInterval> | null = null;
let firstTick: ReturnType<typeof setTimeout> | null = null;
let visibilityBound = false;
const POLL_MS = 30_000;
const key = (kind: PriceKind, symbol: string) => `${kind}:${symbol.toUpperCase()}`;

async function poll() {
  if (typeof document !== "undefined" && document.hidden) return;
  const byKind: Record<PriceKind, string[]> = { crypto: [], stock: [] };
  for (const k of listeners.keys()) {
    const [kind, sym] = k.split(":") as [PriceKind, string];
    if (listeners.get(k)?.size) byKind[kind].push(sym);
  }
  await Promise.all(
    (Object.keys(byKind) as PriceKind[]).flatMap((kind) => {
      const syms = byKind[kind];
      const chunks: string[][] = [];
      for (let i = 0; i < syms.length; i += 40) chunks.push(syms.slice(i, i + 40));
      return chunks.map(async (chunk) => {
        const lite = chunk.every((sym) => !(wantsChange.get(key(kind, sym)) ?? 0));
        try {
          const res = await fetch(`/dashboard/api/prices?symbols=${encodeURIComponent(chunk.join(","))}&kind=${kind}${lite ? "&lite=1" : ""}`, { cache: "no-store", credentials: "same-origin" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { ok: boolean; prices?: Record<string, LP> };
          for (const sym of chunk) {
            const p = data.prices?.[sym];
            const k = key(kind, sym);
            if (p) latest.set(k, p);
            // On a bad answer we re-notify with what we had so the age dot re-colours.
            const out = p ?? latest.get(k);
            if (out) listeners.get(k)?.forEach((fn) => fn(out));
          }
        } catch {
          for (const sym of chunk) {
            const k = key(kind, sym);
            const prev = latest.get(k);
            if (prev) listeners.get(k)?.forEach((fn) => fn(prev));
          }
        }
      });
    }),
  );
}

function ensureRunning() {
  if (timer) return;
  // The server value is at most 15 s old, so the first client poll can wait a moment.
  firstTick = setTimeout(poll, 3_000);
  timer = setInterval(poll, POLL_MS);
  if (!visibilityBound && typeof document !== "undefined") {
    visibilityBound = true;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) void poll(); });
  }
}

function stopIfIdle() {
  if (listeners.size) return;
  if (timer) clearInterval(timer);
  if (firstTick) clearTimeout(firstTick);
  timer = null; firstTick = null;
}

/** Subscribe one symbol; returns the newest LivePrice seen (server initial until the first poll). */
function useLive(symbol: string, kind: PriceKind, initial: LP | null | undefined, withChange = false): LP | null {
  const [p, setP] = useState<LP | null>(initial ?? null);
  useEffect(() => {
    const k = key(kind, symbol);
    if (initial?.ok) latest.set(k, initial);
    const cached = latest.get(k);
    if (cached && (!initial || (cached.asOf ?? "") > (initial.asOf ?? ""))) setP(cached);
    const fn: Listener = (np) => setP(np);
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k)!.add(fn);
    if (withChange) wantsChange.set(k, (wantsChange.get(k) ?? 0) + 1);
    ensureRunning();
    return () => {
      const set = listeners.get(k);
      set?.delete(fn);
      if (set && !set.size) listeners.delete(k);
      if (withChange) wantsChange.set(k, Math.max(0, (wantsChange.get(k) ?? 1) - 1));
      stopIfIdle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, kind, initial?.asOf]);
  return p;
}

// ------------------------------------------------------------------ helpers
type Tone = "green" | "amber" | "red" | "gray";
const DOT: Record<Tone, string> = { green: "bg-accent-green", amber: "bg-amber-300", red: "bg-rose-400", gray: "bg-white/30" };
const TXT: Record<Tone, string> = { green: "text-white/50", amber: "text-amber-200", red: "text-rose-300", gray: "text-white/40" };

/** `now` is null on the server and on the very first client render, so both render identically (no hydration mismatch). */
function ageTone(iso: string | null | undefined, now: number | null): Tone {
  if (!iso) return "gray";
  if (now == null) return "green";
  const m = (now - new Date(iso).getTime()) / 60000;
  return m <= 2 ? "green" : m <= 60 ? "amber" : "red";
}
const nowDate = (now: number | null, iso?: string | null) => (now != null ? new Date(now) : iso ? new Date(iso) : new Date(0));

/** Resolve what to show: the live price if it answered, else the stored decision price. */
function resolve(live: LP | null, stored?: Stored) {
  if (live?.ok && live.price != null) return { price: live.price, isLive: true, asOf: live.asOf, source: live.source, change: live.changePct24h };
  return { price: stored?.price == null || Number.isNaN(Number(stored.price)) ? null : Number(stored.price), isLive: false, asOf: stored?.asOf ?? live?.asOf ?? null, source: stored?.label ?? "desk's last stored price", change: null as number | null };
}

/** Clock that re-renders every 30 s so age dots stay honest even when the feed is quiet. null until mounted. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The "● live · 9:41:07 AM" / "● stored · Oct 9, 1:30 PM" line. aria-live so screen readers hear updates. */
export function Stamp({ isLive, asOf, source, now, className = "", short = false }: { isLive: boolean; asOf: string | null; source?: string; now: number | null; className?: string; short?: boolean }) {
  const tone: Tone = isLive ? ageTone(asOf, now) : "red";
  // A stored value always carries its date — it is by definition not from right now.
  const text = isLive ? `live · ${whenShort(asOf, true, nowDate(now, asOf))}` : asOf ? `stored · ${whenShort(asOf, false, new Date(0))}` : "no live quote";
  const title = isLive
    ? `${source ?? "live"} · ${asOf ? new Date(asOf).toLocaleString("en-US", { timeZone: TZ }) : ""} Phoenix · refreshes every 30 s while this tab is open`
    : `Live feed did not answer — showing the ${source ?? "stored price"} from ${asOf ? new Date(asOf).toLocaleString("en-US", { timeZone: TZ }) : "an unknown time"} Phoenix. Do not trade off this number.`;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] leading-[16px] tabular-nums ${TXT[tone]} ${className}`} title={title} aria-live="polite">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]} ${isLive && tone === "green" ? "shadow-[0_0_6px_rgba(62,243,162,0.6)]" : ""}`} aria-hidden />
      <span>{short && isLive ? whenShort(asOf, true, nowDate(now, asOf)) : text}</span>
    </span>
  );
}

/** Flash the number briefly when it changes. */
function useFlash(value: number | null) {
  const prev = useRef<number | null>(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 900);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return flash;
}

// ------------------------------------------------------------------ LivePrice
export function LivePrice({ symbol, kind = "crypto", initial, stored, size = "md", asMoney = false, showChange = false, stamp = "below", className = "", prefix }: {
  symbol: string;
  kind?: PriceKind;
  /** What the server fetched for this symbol (getLivePrices) — rendered immediately. */
  initial: LP | null | undefined;
  /** The desk's stored price + its timestamp, shown (marked red) when the live feed is unavailable. */
  stored?: Stored;
  size?: "hero" | "lg" | "md" | "sm" | "inline";
  asMoney?: boolean;
  showChange?: boolean;
  stamp?: "below" | "inline" | "none";
  className?: string;
  prefix?: string;
}) {
  const live = useLive(symbol, kind, initial, showChange);
  const now = useNow();
  const r = resolve(live, stored);
  const flash = useFlash(r.price);
  const sz = size === "hero" ? "text-[28px] md:text-[32px]" : size === "lg" ? "text-[24px]" : size === "md" ? "text-[17px]" : size === "sm" ? "text-[14px]" : "text-[13px]";
  const colour = flash === "up" ? "text-accent-green" : flash === "down" ? "text-rose-300" : r.isLive ? "text-white" : "text-white/80";
  const value = r.price == null ? "—" : asMoney ? money(r.price) : px(r.price);
  const number = (
    <span className={`font-mono font-semibold leading-none tabular-nums transition-colors duration-700 ${sz} ${colour}`} aria-label={`${symbol} ${r.isLive ? "live" : "stored"} price ${value}`}>
      {prefix}{value}
    </span>
  );
  if (stamp === "none") return <span className={className}>{number}</span>;
  if (stamp === "inline" || size === "inline" || size === "sm") {
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
        {number}
        {showChange && r.change != null && <Delta v={r.change} d={1} unit="%" className="text-[11.5px]" />}
        <Stamp isLive={r.isLive} asOf={r.asOf} source={r.source} now={now} />
      </span>
    );
  }
  return (
    <span className={`inline-flex min-w-0 flex-col ${className}`}>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {number}
        {showChange && r.change != null && <Delta v={r.change} d={1} unit="% 24h" className="text-[12px]" />}
      </span>
      <Stamp isLive={r.isLive} asOf={r.asOf} source={r.source} now={now} className="mt-1" />
    </span>
  );
}

// ------------------------------------------------------------------ LiveMetric
/**
 * A number computed FROM the live price: distance to a level, open R, open P&L, open %.
 * Entry / stop / level are decision prices and are never replaced; only the "now" side moves.
 */
export function LiveMetric({ symbol, kind = "crypto", initial, stored, metric, level, entry, stop, direction = "long", qty, d, className = "", tag = true, size = "md" }: {
  symbol: string; kind?: PriceKind; initial: LP | null | undefined; stored?: Stored;
  metric: "distPct" | "r" | "pnl" | "pct";
  level?: number | null; entry?: number | null; stop?: number | null; direction?: string | null; qty?: number | null;
  d?: number; className?: string; tag?: boolean; size?: "md" | "lg";
}) {
  const live = useLive(symbol, kind, initial);
  const now = useNow();
  const r = resolve(live, stored);
  const p = r.price;
  const sign = direction === "short" ? -1 : 1;
  const e = entry == null ? null : Number(entry);
  let v: number | null = null, unit = "", arrow = true, prefix = "", dec = d ?? 2;
  if (p != null) {
    if (metric === "distPct" && level != null && p > 0) { v = ((Number(level) - p) / p) * 100; unit = "%"; }
    if (metric === "r" && e != null && stop != null && Number(stop) !== e) { v = (sign * (p - e)) / Math.abs(e - Number(stop)); unit = "R"; arrow = false; }
    if (metric === "pnl" && e != null && qty != null) { v = sign * (p - e) * Number(qty); prefix = "$"; arrow = false; }
    if (metric === "pct" && e != null && e > 0) { v = (sign * (p - e) * 100) / e; unit = "%"; arrow = false; dec = d ?? 2; }
  }
  const tone: Tone = r.isLive ? ageTone(r.asOf, now) : "red";
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`} title={r.isLive ? `from ${r.source} price ${px(p)} at ${whenShort(r.asOf, true)}` : `from the stored price ${px(p)} (${whenShort(r.asOf)}) — live feed unavailable`}>
      <Delta v={v} d={dec} unit={unit} prefix={prefix} arrow={arrow} className={size === "lg" ? "text-[20px] font-semibold" : "text-[13px]"} />
      {tag && (
        <span className={`inline-flex items-center gap-1 font-mono text-[10.5px] ${TXT[tone]}`} aria-live="polite">
          <span className={`h-1 w-1 rounded-full ${DOT[tone]}`} aria-hidden />{r.isLive ? "live" : "stored"}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ TradeRail
/**
 * Stop → entry → target as a price rail with the live price marked. Long or short, low prices are
 * always on the left; the stop is rose, the target green, the entry white. R now rides at the end.
 */
export function TradeRail({ symbol, kind = "crypto", initial, stored, direction, entry, stop, target, origStop, qty, equity, compact = false, className = "" }: {
  symbol: string; kind?: PriceKind; initial: LP | null | undefined; stored?: Stored;
  direction: string; entry: number | null | undefined; stop: number | null | undefined; target?: number | null; origStop?: number | null;
  qty?: number | null; equity?: number | null; compact?: boolean; className?: string;
}) {
  const live = useLive(symbol, kind, initial);
  const now = useNow();
  const r = resolve(live, stored);
  const p = r.price;
  const e = entry == null ? null : Number(entry), s = stop == null ? null : Number(stop), t = target == null ? null : Number(target);
  const risk0 = origStop ?? s;
  const pts = [e, s, t, p].filter((x): x is number => x != null && Number.isFinite(x));
  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const span = (hi - lo) || Math.abs(lo) * 0.01 || 1;
    const pad = span * 0.08;
    const L = lo - pad, H = hi + pad;
    return { pos: (x: number) => ((x - L) / (H - L)) * 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.join(",")]);
  const sign = direction === "short" ? -1 : 1;
  const rNow = p != null && e != null && risk0 != null && Number(risk0) !== e ? (sign * (p - e)) / Math.abs(e - Number(risk0)) : null;
  const pnl = p != null && e != null && qty != null ? sign * (p - e) * Number(qty) : null;
  const pctAcct = pnl != null && equity != null && Number(equity) > 0 ? (pnl * 100) / Number(equity) : null;
  const pctEntry = p != null && e != null && e > 0 ? (sign * (p - e) * 100) / e : null;
  const inProfit = p != null && e != null ? sign * (p - e) >= 0 : null;
  const tone: Tone = r.isLive ? ageTone(r.asOf, now) : "red";
  if (!geo) {
    return (
      <div className={`text-[12.5px] text-white/50 ${className}`}>
        entry {px(e)} · now <LivePrice symbol={symbol} kind={kind} initial={initial} stored={stored} size="inline" />
      </div>
    );
  }
  // Labels near either end hug the rail instead of spilling past the card edge.
  const Tick = ({ x, label, cls, below = false }: { x: number; label: string; cls: string; below?: boolean }) => {
    const at = geo.pos(x);
    const align = at < 14 ? "items-start text-left" : at > 86 ? "items-end text-right" : "items-center";
    const shift = at < 14 ? "" : at > 86 ? "-translate-x-full" : "-translate-x-1/2";
    return (
      <div className={`absolute flex flex-col ${align} ${shift}`} style={{ left: `${at}%`, top: below ? 22 : 0 }}>
        {!below && <div className={`whitespace-nowrap font-mono text-[10.5px] tabular-nums ${cls}`}>{label}</div>}
        <div className={`h-2 w-px ${below ? "" : "mt-0.5"} bg-white/40`} />
        {below && <div className={`whitespace-nowrap font-mono text-[10.5px] tabular-nums ${cls}`}>{label}</div>}
      </div>
    );
  };
  return (
    <div className={`min-w-0 ${className}`}>
      <div className={`relative ${compact ? "h-[46px]" : "h-[52px]"}`} role="img" aria-label={`${symbol} ${direction}: entry ${px(e)}, stop ${px(s)}${t != null ? `, target ${px(t)}` : ""}, now ${px(p)}`}>
        {/* rail: rose on the stop side, green on the target side */}
        <div className="absolute left-0 right-0 top-[18px] h-1.5 rounded-full bg-white/[0.07]" />
        {e != null && s != null && (
          <div className="absolute top-[18px] h-1.5 rounded-full bg-rose-400/50" style={{ left: `${Math.min(geo.pos(e), geo.pos(s))}%`, width: `${Math.abs(geo.pos(e) - geo.pos(s))}%` }} />
        )}
        {e != null && t != null && (
          <div className="absolute top-[18px] h-1.5 rounded-full bg-accent-green/50" style={{ left: `${Math.min(geo.pos(e), geo.pos(t))}%`, width: `${Math.abs(geo.pos(e) - geo.pos(t))}%` }} />
        )}
        {s != null && <Tick x={s} label={`stop ${px(s)}`} cls="text-rose-300" />}
        {t != null && <Tick x={t} label={`TP ${px(t)}`} cls="text-accent-green" />}
        {e != null && <Tick x={e} label={`entry ${px(e)}`} cls="text-white/70" below />}
        {p != null && (
          <div className="absolute top-[11px] -translate-x-1/2" style={{ left: `${geo.pos(p)}%` }}>
            <div className={`mx-auto h-5 w-[3px] rounded ${r.isLive ? "bg-white" : "bg-rose-300"} shadow-[0_0_0_2px_#0b0b0d]`} />
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11.5px] uppercase tracking-[0.1em] text-white/40">now</span>
          <span className={`font-mono text-[15px] font-semibold tabular-nums ${r.isLive ? "text-white" : "text-white/70"}`}>{px(p)}</span>
          <Stamp isLive={r.isLive} asOf={r.asOf} source={r.source} now={now} />
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-x-2 font-mono tabular-nums">
          {rNow != null && <span className={`text-[15px] font-semibold ${inProfit ? "text-accent-green" : "text-rose-300"}`}>{rNow > 0 ? "+" : rNow < 0 ? "−" : ""}{Math.abs(rNow).toFixed(2)}R</span>}
          {rNow == null && pctEntry != null && <span className={`text-[15px] font-semibold ${inProfit ? "text-accent-green" : "text-rose-300"}`}>{pctEntry > 0 ? "+" : pctEntry < 0 ? "−" : ""}{Math.abs(pctEntry).toFixed(2)}%</span>}
          {pnl != null && <span className={`text-[12px] ${inProfit ? "text-accent-green/80" : "text-rose-300/80"}`}>{pnl > 0 ? "+" : pnl < 0 ? "−" : ""}{money(Math.abs(pnl))}{pctAcct != null ? ` · ${pctAcct > 0 ? "+" : pctAcct < 0 ? "−" : ""}${Math.abs(pctAcct).toFixed(2)}% acct` : ""}</span>}
          <span className={`text-[10.5px] ${TXT[tone]}`}>{r.isLive ? "live" : "stored"}</span>
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ LadderMarker
/** The price marker inside a LevelLadder, kept live. `lo`/`hi` are the ladder's ends (same maths as the server). */
export function LadderMarker({ symbol, kind = "crypto", initial, stored, lo, hi }: { symbol: string; kind?: PriceKind; initial: LP | null | undefined; stored?: Stored; lo: number; hi: number }) {
  const live = useLive(symbol, kind, initial);
  const now = useNow();
  const r = resolve(live, stored);
  const span = hi - lo || 1;
  const pos = (x: number) => 6 + (Math.max(lo, Math.min(hi, x)) - lo) / span * 88;
  const storedPx = stored?.price == null ? null : Number(stored.price);
  const tone: Tone = r.isLive ? ageTone(r.asOf, now) : "red";
  return (
    <>
      {storedPx != null && r.isLive && storedPx !== r.price && (
        <div className="absolute top-[24px] -translate-x-1/2" style={{ left: `${pos(storedPx)}%` }} title={`desk check ${px(storedPx)} · ${whenShort(stored?.asOf)}`}>
          <div className="mx-auto h-[14px] w-px bg-white/35" />
        </div>
      )}
      {r.price != null && (
        <div className="absolute top-[22px] -translate-x-1/2" style={{ left: `${pos(r.price)}%` }} title={`${r.isLive ? "live" : "stored"} ${px(r.price)} · ${whenShort(r.asOf, true)}`}>
          <div className={`mx-auto h-[18px] w-[3px] rounded ${r.isLive ? "bg-white" : "bg-rose-300"} shadow-[0_0_0_2px_#0b0b0d] ${tone === "green" ? "shadow-[0_0_0_2px_#0b0b0d,0_0_8px_rgba(255,255,255,0.45)]" : ""}`} />
        </div>
      )}
    </>
  );
}
