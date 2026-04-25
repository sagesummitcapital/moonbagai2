"use client";

import { motion } from "framer-motion";
import { Radar, BarChart3, Zap } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: Radar,
    title: "Scan",
    copy: "Moonbag monitors markets, technical structure, sentiment, news, and watchlists around the clock.",
  },
  {
    n: "02",
    icon: BarChart3,
    title: "Score",
    copy: "The system ranks opportunities by quality, timing, trend, and risk.",
  },
  {
    n: "03",
    icon: Zap,
    title: "Act",
    copy: "Review the setup, understand the thesis, and execute with speed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 md:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-fine opacity-40 mask-radial" />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
            How it works
          </div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            How Moonbag works
          </h2>
        </motion.div>

        <div className="relative mt-16 md:mt-24">
          {/* Desktop connector */}
          <div className="pointer-events-none absolute left-[15%] right-[15%] top-[72px] hidden h-px md:block">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformOrigin: "left" }}
              className="h-full w-full bg-gradient-to-r from-accent-green via-accent-cyan to-accent-green"
            />
          </div>

          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                className="group relative"
              >
                <div className="mx-auto flex h-[144px] w-[144px] items-center justify-center rounded-full border border-white/10 bg-black/80 backdrop-blur-md transition-all group-hover:border-accent-green/40 group-hover:shadow-glow">
                  <div className="absolute inset-[14px] rounded-full border border-white/[0.06]" />
                  <s.icon
                    className="relative z-10 h-7 w-7 text-accent-green"
                    strokeWidth={1.6}
                  />
                </div>
                <div className="mt-8 text-center">
                  <div className="mb-2 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-white/35">
                    Step {s.n}
                  </div>
                  <h3 className="text-[24px] font-semibold tracking-tight text-white">
                    {s.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xs text-[14.5px] leading-[1.6] text-white/55">
                    {s.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
