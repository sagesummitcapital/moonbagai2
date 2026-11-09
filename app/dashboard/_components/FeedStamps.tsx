// Per-coin data clocks (Stavros, 2026-10-16: "make sure i always know the time of this data, if i use bad data its a bad
// trade"). One chip per coin from the rows the page already loads (v_data_freshness, 15m BloFin bars — the same rows
// feedHealth() judges the whole page by). When one coin's feed lags hours behind the others (SOL did in early Nov 2026)
// the page-wide warning turns red; these chips say WHICH coin to distrust and which are still fine. Display only: the
// time, the age and the ok / fresh flags are read straight off the row; the page-level verdict stays with feedHealth().
import type { Freshness } from "@/lib/moonbag/woodsMachine";
import { whenShort } from "./ui";

const CORE = ["BTC", "ETH", "SOL"];

/** "3m" · "5h 12m" · "2d" — an age in minutes as the desk reads it. */
export const ageText = (min: number | null | undefined) => {
  if (min == null || !Number.isFinite(Number(min))) return "—";
  const m = Math.max(0, Math.round(Number(min)));
  if (m < 60) return `${m}m`;
  if (m < 48 * 60) return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
  return `${Math.round(m / 1440)}d`;
};

/** The 15m row for one coin — the one the stale-data verdict is built from. */
export const feedRow = (feed: Freshness[] | null | undefined, asset: string) => (feed ?? []).find((f) => f.tf === "15m" && f.asset === asset);

/** The coins to show: BTC, ETH, SOL first, then anything else the feed carries. */
const coinsOf = (feed: Freshness[]) => [...CORE, ...feed.filter((f) => f.tf === "15m" && !CORE.includes(f.asset)).map((f) => f.asset)].filter((c, i, a) => a.indexOf(c) === i);

const DOT = { good: "bg-accent-green", bad: "bg-rose-400", none: "bg-white/30" } as const;
const TEXT = { good: "text-white/70", bad: "text-rose-300", none: "text-white/40" } as const;

/** One coin's clock: ● BTC 2:15 PM (3m). Green = the row says ok and fresh, rose = it says not, grey = no row. */
export function FeedStamp({ coin, f, className = "" }: { coin: string; f?: Freshness; className?: string }) {
  const state: keyof typeof DOT = !f ? "none" : f.ok && f.fresh === true ? "good" : !f.ok || f.fresh === false ? "bad" : "none";
  const title = !f
    ? `${coin}: no 15m bar row in the feed`
    : `${coin} 15m bars · last bar ${f.last_bar ? new Date(f.last_bar).toLocaleString("en-US", { timeZone: "America/Phoenix" }) : "—"} Phoenix · fetched ${whenShort(f.fetched_at)}${f.error ? ` · ${f.error}` : ""}`;
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap font-mono text-[11.5px] leading-[18px] tabular-nums ${TEXT[state]} ${className}`} title={title}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[state]}`} aria-hidden />
      <span className="font-semibold text-white/80">{coin}</span>
      {f ? (
        <>
          <span>{f.last_bar ? `bar ${whenShort(f.last_bar)}` : "no bar"}</span>
          <span className={state === "bad" ? "text-rose-300/80" : "text-white/40"}>({ageText(f.bar_age_min)}{f.bar_age_min != null ? " ago" : ""}{!f.ok ? " · error" : ""})</span>
        </>
      ) : (
        <span>no feed</span>
      )}
    </span>
  );
}

/** The row of per-coin clocks: "bars · ● BTC 2:15 PM (3m) · ● ETH … · ● SOL 9:00 AM (5h 15m)". */
export function FeedStamps({ feed, label = "BloFin bars", className = "" }: { feed: Freshness[] | null | undefined; label?: string; className?: string }) {
  const rows = feed ?? [];
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {label && <span className="whitespace-nowrap font-mono text-[11.5px] leading-[18px] text-white/40">{label}</span>}
      {coinsOf(rows).map((c) => <FeedStamp key={c} coin={c} f={feedRow(rows, c)} />)}
    </span>
  );
}
