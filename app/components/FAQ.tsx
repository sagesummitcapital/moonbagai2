"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "What markets does Moonbag cover?",
    a: "Moonbag is designed to scan crypto, stocks, gold, ETFs, and macro-sensitive instruments — surfacing opportunities across asset classes in one unified view.",
  },
  {
    q: "Is this just for crypto?",
    a: "No. Moonbag is built as a cross-asset intelligence and execution layer. Crypto is one of many coverage areas — the system also scans equities, gold and commodities, ETFs, and broader macro flows.",
  },
  {
    q: "Is this just a signal bot?",
    a: "No. Moonbag is an intelligence and execution layer that helps traders identify, prioritize, and act on higher-quality setups with structured plans and plain-English reasoning — not a stream of noisy signals.",
  },
  {
    q: "Does it auto-trade?",
    a: "Early versions are approval-first — Moonbag prepares the opportunity, the plan, and the context, and you decide whether to execute. Automation layers can be added over time.",
  },
  {
    q: "How are opportunities rated?",
    a: "Every asset is scored across trend strength, momentum, setup quality, volatility regime, and risk/reward — then ranked against the full scanned universe so you see what's worth attention right now.",
  },
  {
    q: "When does early access start?",
    a: "Early access rolls out in waves to waitlist members. Joining the waitlist now secures founding-user pricing and first access when your wave opens.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
            FAQ
          </div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[48px]">
            Answers, before you ask.
          </h2>
        </motion.div>

        <div className="mt-14 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="group flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-7"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15.5px] font-medium tracking-tight text-white md:text-[16.5px]">
                    {f.q}
                  </span>
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] transition-all ${
                      isOpen
                        ? "rotate-45 border-accent-green/40 bg-accent-green/10"
                        : "group-hover:border-white/20"
                    }`}
                  >
                    <Plus
                      className={`h-3.5 w-3.5 transition-colors ${
                        isOpen ? "text-accent-green" : "text-white/60"
                      }`}
                    />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0 md:px-7 md:pb-6">
                        <p className="max-w-2xl text-[14.5px] leading-[1.65] text-white/60">
                          {f.a}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
