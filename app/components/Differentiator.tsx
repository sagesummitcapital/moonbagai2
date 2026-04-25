"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const bullets = [
  { text: "No indicator clutter", off: true },
  { text: "No generic AI summaries", off: true },
  { text: "No single-asset tunnel vision", off: true },
  { text: "No signal spam", off: true },
  { text: "Just ranked opportunities", off: false },
  { text: "Structured setups", off: false },
  { text: "Better decision speed", off: false },
];

export function Differentiator() {
  return (
    <section className="relative py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
              Why it feels different
            </div>
            <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[48px]">
              Built for{" "}
              <span className="text-gradient">execution,</span>
              <br /> not entertainment
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-[1.6] text-white/55">
              Most trading tools optimize for screen time. Moonbag optimizes for
              decisions made and capital deployed with clarity.
            </p>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="space-y-2"
          >
            {bullets.map((b, i) => (
              <motion.li
                key={b.text}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/15"
              >
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    b.off
                      ? "border border-red-500/30 bg-red-500/10"
                      : "border border-accent-green/30 bg-accent-green/10"
                  }`}
                >
                  {b.off ? (
                    <X className="h-3 w-3 text-red-400" />
                  ) : (
                    <Check className="h-3 w-3 text-accent-green" />
                  )}
                </div>
                <span
                  className={`text-[14.5px] ${
                    b.off ? "text-white/45 line-through" : "text-white/90 font-medium"
                  }`}
                >
                  {b.text}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
