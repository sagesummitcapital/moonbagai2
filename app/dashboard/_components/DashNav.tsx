"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * CR-78 (Stavros, 2026-11-13: "simple saas product"): five pages — Today · Levels · Setups · Scorecard · System.
 * Older pages stay reachable in a group's sub-row (System holds the archive) until he retires them.
 * Earlier: layered flow (Stavros, 2026-11-01: "make the Moonbag tool itself visually have a flow ... a hedge fund platform ... layer it so it's a
 * simpler tool but still highlights all the main things"). Command → Trade → Holdings → Review → Research → System.
 * Every old route still exists — it lives in one group's sub-row, which shows only while you are in that group.
 * (Earlier: four destinations instead of fourteen tabs, 2026-10-15: "my attention is my most valuable asset".)
 */
type Item = { href: string; label: string; short?: string };
type Group = { label: string; href: string; items: Item[] };

export const NAV: Group[] = [
  { label: "Today", href: "/dashboard", items: [] },
  { label: "Levels", href: "/dashboard/levels", items: [] },
  {
    label: "Setups",
    href: "/dashboard/setups",
    items: [
      { href: "/dashboard/setups", label: "Setups" },
      { href: "/dashboard/lab", label: "Strategy lab" },
    ],
  },
  {
    label: "Scorecard",
    href: "/dashboard/scorecard",
    items: [
      { href: "/dashboard/scorecard", label: "Scorecard" },
      { href: "/dashboard/prop", label: "Prop account" },
      { href: "/dashboard/journal", label: "Journal" },
      { href: "/dashboard/tracker", label: "Trade tracker" },
      { href: "/dashboard/performance", label: "Performance" },
      { href: "/dashboard/robinhood", label: "Robinhood" },
      { href: "/dashboard/coinbase", label: "Coinbase" },
    ],
  },
  {
    label: "System",
    href: "/dashboard/system",
    items: [
      { href: "/dashboard/system", label: "System" },
      { href: "/dashboard/agents", label: "Agents" },
      // Archive (CR-78): older pages, reachable from System until Stavros retires them.
      { href: "/dashboard/command", label: "Old home" },
      { href: "/dashboard/leverage", label: "Old desk" },
      { href: "/dashboard/positions", label: "Positions" },
      { href: "/dashboard/opportunities", label: "Opportunities" },
      { href: "/dashboard/audit", label: "Monthly audit" },
      { href: "/dashboard/history", label: "History" },
      { href: "/dashboard/intelligence", label: "Intelligence" },
      { href: "/dashboard/gauge", label: "Retail gauge" },
      { href: "/dashboard/entropy", label: "Macro map" },
      { href: "/dashboard/mentors", label: "Research notes" },
    ],
  },
];

const inGroup = (g: Group, path: string | null) =>
  g.items.length ? g.items.some((i) => path?.startsWith(i.href)) : path === g.href;

export function DashNav() {
  const path = usePathname();
  const active = NAV.find((g) => inGroup(g, path)) ?? NAV[0];
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Desk sections" className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:inline-grid sm:grid-cols-5 sm:w-auto sm:self-start">
        {NAV.map((g) => {
          const on = g === active;
          return (
            <Link
              key={g.href}
              href={g.href}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-[40px] items-center justify-center rounded-lg px-2 text-center text-[13px] transition sm:px-4 ${on ? "bg-white/[0.1] font-semibold text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
            >
              {g.label}
            </Link>
          );
        })}
      </nav>
      {active.items.length > 1 && (
        <div className="relative -mx-5 md:-mx-8">
          <nav aria-label={`${active.label} pages`} className="no-scrollbar flex gap-1 overflow-x-auto px-5 md:px-8">
            {active.items.map((i) => {
              const on = path?.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3 text-[12.5px] transition ${on ? "bg-white/[0.08] font-medium text-white" : "text-white/50 hover:text-white"}`}
                >
                  {on && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-accent-green" aria-hidden />}
                  {i.label}
                </Link>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent md:hidden" aria-hidden />
        </div>
      )}
    </div>
  );
}
