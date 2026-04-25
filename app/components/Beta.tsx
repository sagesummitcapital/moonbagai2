"use client";

import { motion } from "framer-motion";
import { Rocket, Zap, Gift, MessageCircle } from "lucide-react";
import { WaitlistForm } from "./WaitlistForm";

const incentives = [
  { icon: Gift, label: "Founding user pricing" },
  { icon: Rocket, label: "Priority onboarding" },
  { icon: Zap, label: "Early feature access" },
  { icon: MessageCircle, label: "Feedback channel access" },
];

export function Beta() {
  return (
    <section id="waitlist" className="relative py-28 md:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[500px] -translate-y-1/2 bg-accent-radial opacity-50 blur-3xl" />

      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 backdrop-blur-md md:p-14"
        >
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-green/60 to-transparent" />

          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent-green/25 bg-accent-green/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent-green">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent-green" />
              Early access
            </div>
            <h2 className="text-[32px] font-bold leading-[1.08] tracking-[-0.03em] text-white md:text-[48px]">
              Get in{" "}
              <span className="text-gradient">before public launch</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16px] text-white/60 md:text-[17px]">
              Early users will help shape the first live release of Moonbag.ai
              and get first access to the ratings engine, alerting system, and
              execution workflow.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {incentives.map((inc, i) => (
              <motion.div
                key={inc.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-all hover:border-accent-green/30"
              >
                <inc.icon className="h-4 w-4 text-accent-green" />
                <div className="mt-3 text-[13px] font-medium text-white/85">
                  {inc.label}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <WaitlistForm source="beta" buttonLabel="Join the Waitlist" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
