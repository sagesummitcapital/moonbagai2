"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Command" },
  { href: "/dashboard/leverage", label: "Leverage desk" },
  { href: "/dashboard/robinhood", label: "Long-term" },
  { href: "/dashboard/coinbase", label: "Coinbase" },
  { href: "/dashboard/tracker", label: "Trade tracker" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/positions", label: "Positions" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/intelligence", label: "Intelligence" },
  { href: "/dashboard/history", label: "History" },
];

export function DashNav() {
  const path = usePathname();
  return (
    <div className="relative -mx-5 md:-mx-8">
      <nav aria-label="Desk sections" className="no-scrollbar flex gap-1 overflow-x-auto px-5 pb-1 md:px-8">
        {TABS.map((t) => {
          const active = t.href === "/dashboard" ? path === t.href : path?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition ${
                active
                  ? "bg-white/[0.09] font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {active && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-accent-green" aria-hidden />}
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent md:hidden" aria-hidden />
    </div>
  );
}
