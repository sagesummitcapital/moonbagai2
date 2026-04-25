"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type Stat = {
  value: number;
  suffix?: string;
  label: string;
  sublabel: string;
};

const STATS: Stat[] = [
  {
    value: 4,
    suffix: "+",
    label: "Asset classes covered",
    sublabel: "Crypto · stocks · gold · ETFs",
  },
  {
    value: 2400,
    suffix: "+",
    label: "Tickers actively scanned",
    sublabel: "Across all venues, updated continuously",
  },
  {
    value: 60,
    suffix: "s",
    label: "Refresh cadence",
    sublabel: "Opportunity board never goes stale",
  },
  {
    value: 100,
    suffix: "%",
    label: "Human-approved execution",
    sublabel: "You decide every trade that fires",
  },
];

function Counter({
  target,
  suffix = "",
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className="num-tick">
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent p-8 backdrop-blur-sm md:p-12">
          {/* Subtle inner glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent" />
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent-cyan/[0.08] blur-3xl" />
          <div className="pointer-events-none absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-accent-green/[0.08] blur-3xl" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative"
              >
                <div className="text-[38px] font-bold leading-none tracking-[-0.03em] md:text-[52px]">
                  <span className="text-gradient">
                    <Counter target={s.value} suffix={s.suffix} />
                  </span>
                </div>
                <div className="mt-3 text-[13.5px] font-medium text-white/85">
                  {s.label}
                </div>
                <div className="mt-1 text-[12px] text-white/40">
                  {s.sublabel}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
