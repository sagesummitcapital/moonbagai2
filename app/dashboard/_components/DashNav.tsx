"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Four destinations instead of fourteen tabs (Stavros, 2026-10-15: "my attention is my most valuable asset").
 * Every old route still exists — it lives in one group's sub-row, which shows only while you are in that group.
 */
type Item = { href: string; label: string; short?: string };
type Group = { label: string; href: string; items: Item[] };

export const NAV: Group[] = [
  { label: "Today", href: "/dashboard", items: [] },
  {
    label: "Trade",
    href: "/dashboard/leverage",
    items: [
      { href: "/dashboard/leverage", label: "Leverage desk" },
      { href: "/dashboard/positions", label: "Positions" },
      { href: "/dashboard/opportunities", label: "Opportunities" },
      { href: "/dashboard/tracker", label: "Trade tracker" },
      { href: "/dashboard/lab", label: "Strategy lab" },
      { href: "/dashboard/mentors", label: "Mentors" },
    ],
  },
  {
    label: "Holdings",
    href: "/dashboard/robinhood",
    items: [
      { href: "/dashboard/robinhood", label: "Robinhood · long-term" },
      { href: "/dashboard/coinbase", label: "Coinbase · holds" },
    ],
  },
  {
    label: "Insights",
    href: "/dashboard/performance",
    items: [
      { href: "/dashboard/performance", label: "Performance" },
      { href: "/dashboard/intelligence", label: "Intelligence" },
      { href: "/dashboard/entropy", label: "Entropy Trap" },
      { href: "/dashboard/agents", label: "Agents" },
      { href: "/dashboard/history", label: "History" },
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
      <nav aria-label="Desk sections" className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 sm:inline-grid sm:w-auto sm:self-start">
        {NAV.map((g) => {
          const on = g === active;
          return (
            <Link
              key={g.href}
              href={g.href}
              aria-current={on ? "page" : undefined}
              className={`rounded-lg px-2 py-1.5 text-center text-[13px] transition sm:px-4 ${on ? "bg-white/[0.1] font-semibold text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"}`}
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
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] transition ${on ? "bg-white/[0.08] font-medium text-white" : "text-white/50 hover:text-white"}`}
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
