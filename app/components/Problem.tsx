"use client";

import { motion } from "framer-motion";
import { LineChart, Volume2, GitFork, Hourglass } from "lucide-react";

const cards = [
  { icon: LineChart, label: "Too many charts" },
  { icon: Volume2, label: "Too much noise" },
  { icon: GitFork, label: "Too many conflicting signals" },
  { icon: Hourglass, label: "Too much hesitation" },
];

export function Problem() {
  return (
    <section className="relative py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
            The problem
          </div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            Most traders don't lose
            <br className="hidden sm:block" /> because of a{" "}
            <span className="text-white/45">lack of information.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-white/55 md:text-[18px]">
            They lose because there's{" "}
            <span className="text-gradient font-semibold">too much of it.</span>
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-2 gap-3 md:mt-20 md:grid-cols-4 md:gap-4">
          {cards.map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent p-6 transition-all hover:border-white/15"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <Icon className="h-4 w-4 text-white/70 transition-colors group-hover:text-accent-green" />
              </div>
              <div className="text-[15px] font-medium tracking-tight text-white/90">
                {label}
              </div>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-accent-green/[0.06] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-16 max-w-2xl text-center text-[16px] leading-relaxed text-white/65 md:text-[17.5px]"
        >
          Moonbag.ai reduces the market into a{" "}
          <span className="font-semibold text-white">
            ranked set of actionable opportunities.
          </span>
        </motion.p>
      </div>
    </section>
  );
}
