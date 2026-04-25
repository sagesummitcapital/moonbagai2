"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import { WaitlistForm } from "./WaitlistForm";
import { OpportunityBoard } from "./OpportunityBoard";

const VERBS = ["scans", "ranks", "explains", "alerts"];

const TICKER = [
  { sym: "BTC", score: "8.7", up: true },
  { sym: "ETH", score: "7.4", up: true },
  { sym: "NVDA", score: "7.9", up: true },
  { sym: "GLD", score: "8.2", up: true },
  { sym: "AAPL", score: "6.3", up: false },
  { sym: "SOL", score: "8.1", up: true },
  { sym: "SPY", score: "6.8", up: true },
  { sym: "XAUUSD", score: "7.6", up: true },
];

export function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % VERBS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent-green" />
          <span className="text-[12px] font-medium tracking-wide text-white/75">
            AI market intelligence · execution layer
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-mono text-[11px] text-white/45">
            Beta · early access
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mx-auto max-w-4xl text-center text-[40px] font-bold leading-[1.04] tracking-[-0.035em] text-white md:text-[64px]"
        >
          The AI trading system
          <br className="hidden sm:block" />
          <span className="inline-flex items-baseline gap-x-3 md:gap-x-4">
            that{" "}
            <span className="relative inline-block min-w-[2.4em] align-baseline md:min-w-[3.4em]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={VERBS[i]}
                  initial={{ y: 20, opacity: 0, filter: "blur(8px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -20, opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                  className="text-gradient absolute left-0 whitespace-nowrap"
                >
                  {VERBS[i]}
                </motion.span>
              </AnimatePresence>
              <span className="invisible">explains</span>
            </span>{" "}
            the market for you.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-7 max-w-2xl text-center text-[16px] leading-[1.6] text-white/62 md:text-[17.5px]"
        >
          Moonbag.ai monitors crypto, stocks, gold, and macro markets in real
          time — then surfaces the highest-quality opportunities with clear
          ratings, risk framing, and execution-ready setups.
        </motion.p>

        {/* Proof line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mx-auto mt-3 max-w-2xl text-center text-[13.5px] text-white/40"
        >
          No noise. No endless chart flipping. Just ranked opportunities and
          clean decisions.
        </motion.p>

        {/* CTA group */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="mx-auto mt-10 flex flex-col items-center gap-4"
        >
          <WaitlistForm source="hero" />
          <div className="flex items-center gap-3">
            <Link
              href="#how-it-works"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-[13px] text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <PlayCircle className="h-4 w-4 text-accent-green" />
              See How It Works
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="max-w-md text-center text-[12.5px] leading-relaxed text-white/40">
            Early users get priority access, discounted beta pricing, and first
            access to new execution features.
          </p>
        </motion.div>

        {/* Ticker strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="relative mx-auto mt-16 flex max-w-4xl items-center gap-2 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-1.5 backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black to-transparent" />
          <div className="flex items-center gap-2 [animation:tickerSlide_28s_linear_infinite]">
            {[...TICKER, ...TICKER, ...TICKER].map((t, idx) => (
              <div
                key={idx}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px]"
              >
                <span className="font-semibold text-white/85">{t.sym}</span>
                <span
                  className={`num-tick font-mono font-semibold ${
                    t.up ? "text-accent-green" : "text-red-400"
                  }`}
                >
                  {t.score}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    t.up ? "bg-accent-green" : "bg-red-400"
                  } shadow-[0_0_6px_currentColor]`}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hero product visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative mx-auto mt-14 max-w-5xl"
        >
          <OpportunityBoard />
        </motion.div>
      </div>
    </section>
  );
}
