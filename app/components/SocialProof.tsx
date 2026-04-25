"use client";

import { motion } from "framer-motion";
import { Radar, Gauge, FileCheck, HandMetal } from "lucide-react";

const lines = [
  "Built for traders who want speed, clarity, and execution.",
  "Cross-asset intelligence. One operating layer.",
  "Crypto. Stocks. Gold. ETFs. Macro.",
];

const badges = [
  { icon: Radar, label: "Real-time opportunity scoring" },
  { icon: Gauge, label: "Cross-market scanning" },
  { icon: FileCheck, label: "AI-generated trade plans" },
  { icon: HandMetal, label: "Human-approved execution" },
];

export function SocialProof() {
  return (
    <section className="relative border-y border-white/[0.06] bg-black py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-center gap-6 md:grid-cols-3">
          {lines.map((l, i) => (
            <motion.p
              key={l}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center text-[13px] font-medium tracking-[0.01em] text-white/55"
            >
              {l}
            </motion.p>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {badges.map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11.5px] text-white/65 backdrop-blur-sm transition-colors hover:border-accent-green/30 hover:text-white/90"
            >
              <Icon className="h-3.5 w-3.5 text-accent-green/80" />
              {label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
