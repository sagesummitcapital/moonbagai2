// The top panel of a holds book (Coinbase, Robinhood): one hero number, a hairline instrument row beside it, and a
// footer of clocks. Same look as the Command, Prop and Tracker heroes (design direction 2026-11-09).
// Display only — every value arrives already worked out by the page.
import type { ReactNode } from "react";
import type { PriceMap } from "@/lib/moonbag/prices";
import { whenShort } from "./ui";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.16em] text-white/45";
const RAIL = { ok: "bg-white/20", caution: "bg-amber-300", stop: "bg-rose-400" };

export function BookHero({ label, value, sub, state = "ok", children, foot }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode;
  /** The book's own status, as the page already decided it: running, slowed down, or halted. */
  state?: keyof typeof RAIL;
  /** The instrument cells (Readout). */
  children: ReactNode;
  /** Clocks: snapshot time, price time, page read. Always shown. */
  foot: ReactNode;
}) {
  return (
    <section aria-label={typeof label === "string" ? label : undefined} className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="relative min-w-0 px-4 py-5 pl-5 md:px-6 md:py-6 md:pl-7">
          <span className={`absolute inset-y-4 left-0 w-[3px] rounded-r ${RAIL[state]}`} aria-hidden />
          <div className={LABEL}>{label}</div>
          <div className="fig mt-2.5 break-words font-mono text-[40px] font-semibold leading-none text-white sm:text-[48px] lg:text-[44px] xl:text-[56px]">{value}</div>
          {sub && <div className="mt-3 text-[12.5px] leading-snug text-white/55">{sub}</div>}
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="-ml-px grid h-full grid-cols-2 lg:-mt-px lg:ml-0">{children}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] px-4 py-3 font-mono text-[11.5px] tabular-nums text-white/45 md:px-5">{foot}</div>
    </section>
  );
}

/** One instrument cell: small caps label, the figure, an optional thin meter, one line of context. */
export function Readout({ k, v, sub, meter, cls = "text-white", text = false, className = "" }: {
  k: ReactNode; v: ReactNode; sub?: ReactNode; meter?: ReactNode; cls?: string;
  /** The value is words ("Auto within limits"), not a number — set it smaller so it fits a phone cell. */
  text?: boolean; className?: string;
}) {
  return (
    <div className={`min-w-0 border-l border-t border-white/[0.06] px-4 py-3.5 md:px-5 ${className}`}>
      <div className={LABEL}>{k}</div>
      <div className={`mt-1.5 break-words font-semibold ${text ? "text-[15px] leading-tight" : "fig font-mono text-[20px] leading-none"} ${cls}`}>{v}</div>
      {meter && <div className="mt-2.5">{meter}</div>}
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-white/45">{sub}</div>}
    </div>
  );
}

/**
 * The clock for the "now" prices on the page, as they were when the page was read: where they came from, the newest
 * quote's own time, and how many answered. Amber when any did not — those rows show a stored price, marked on the row.
 */
export function PriceClock({ live, symbols }: { live: PriceMap; symbols: (string | null | undefined)[] }) {
  const uniq = Array.from(new Set(symbols.filter((s): s is string => !!s).map((s) => s.toUpperCase())));
  if (!uniq.length) return <span>live prices · nothing to price</span>;
  const ok = uniq.map((s) => live[s]).filter((p) => p?.ok && p.price != null);
  const newest = ok.reduce<string | null>((a, p) => (p.asOf && (!a || new Date(p.asOf).getTime() > new Date(a).getTime()) ? p.asOf : a), null);
  const sources = Array.from(new Set(ok.map((p) => p.source))).join(" + ");
  const missing = uniq.length - ok.length;
  if (!ok.length) return <span className="text-amber-200">live prices · none loaded — every &quot;now&quot; below is a stored price</span>;
  return (
    <span className={missing ? "text-amber-200" : ""}>
      live prices · {sources} · <span className={missing ? "" : "text-white/80"}>{whenShort(newest, true)}</span> · {ok.length} of {uniq.length} loaded{missing ? ` — ${missing} on a stored price` : ""}
    </span>
  );
}
