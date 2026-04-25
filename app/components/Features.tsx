"use client";

import { motion } from "framer-motion";
import {
  Radar,
  Target,
  ClipboardCheck,
  Brain,
  Bell,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: Radar,
    title: "Market Scanner",
    copy: "Continuously scans crypto, equities, gold, ETFs, and macro assets for asymmetric setups.",
    featured: true,
  },
  {
    icon: Target,
    title: "Opportunity Ratings",
    copy: "Every asset gets scored across trend, momentum, setup quality, volatility, and risk/reward.",
  },
  {
    icon: ClipboardCheck,
    title: "Execution Plans",
    copy: "Get clean entries, invalidation levels, profit targets, and trade context in seconds.",
  },
  {
    icon: Brain,
    title: "AI Reasoning Layer",
    copy: "See why an asset is rated highly — with plain-English explanations, catalysts, and technical context.",
  },
  {
    icon: Bell,
    title: "Alerts",
    copy: "Know when a setup improves, triggers, weakens, or breaks.",
  },
  {
    icon: Layers,
    title: "Portfolio View",
    copy: "Track the strongest ideas across your watchlist and see where capital should be focused.",
  },
];

export function Features() {
  return (
    <section id="markets" className="relative py-28 md:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[600px] -translate-y-1/2 bg-accent-radial opacity-30 blur-3xl" />

      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
            The product
          </div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            One system.{" "}
            <span className="text-gradient">Every market that matters.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16.5px] text-white/55 md:text-[17.5px]">
            Scan faster, decide cleaner, execute with structure.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-3 md:mt-20 md:grid-cols-6 md:gap-4">
          {features.map((f, i) => {
            const span = f.featured
              ? "md:col-span-3 md:row-span-2"
              : i === 1 || i === 5
              ? "md:col-span-3"
              : "md:col-span-2";
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.07 }}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-white/[0.005] p-6 transition-all hover:border-white/15 md:p-7 ${span}`}
              >
                {/* glow on hover */}
                <div className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-accent-green/20 via-transparent to-accent-cyan/20 opacity-0 blur-md transition-opacity group-hover:opacity-100" />

                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-colors group-hover:border-accent-green/40">
                  <f.icon className="h-[18px] w-[18px] text-accent-green" />
                </div>
                <h3 className="text-[19px] font-semibold tracking-tight text-white md:text-[21px]">
                  {f.title}
                </h3>
                <p className="mt-2 max-w-md text-[14px] leading-[1.6] text-white/55">
                  {f.copy}
                </p>

                {f.featured && (
                  <div className="mt-8 hidden items-center justify-between rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 font-mono text-[11.5px] md:flex">
                    <span className="text-white/45">scanning</span>
                    <div className="flex gap-2">
                      {["BTC", "NVDA", "GLD", "ETH", "SPY"].map((s, idx) => (
                        <span
                          key={s}
                          className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-white/70"
                          style={{
                            animation: `pulseDot 2s ease-in-out ${idx * 0.25}s infinite`,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="text-accent-green">● live</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
