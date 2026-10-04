"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Command" },
  { href: "/dashboard/leverage", label: "Leverage desk" },
  { href: "/dashboard/robinhood", label: "Long-term" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/positions", label: "Positions" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/intelligence", label: "Intelligence" },
  { href: "/dashboard/history", label: "History" },
];

export function DashNav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const active = t.href === "/dashboard" ? path === t.href : path?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition ${
              active
                ? "bg-white/[0.08] text-white"
                : "text-white/55 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
