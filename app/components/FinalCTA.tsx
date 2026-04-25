"use client";

import { motion } from "framer-motion";
import { WaitlistForm } from "./WaitlistForm";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40 mask-radial" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-green/[0.07] blur-[120px]" />

      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <h2 className="text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-white md:text-[72px]">
            Know what matters.
            <br />
            <span className="text-gradient">Act faster.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16.5px] text-white/55 md:text-[18px]">
            Join the waitlist for early access to Moonbag.ai.
          </p>
          <div className="mt-10 flex justify-center">
            <WaitlistForm source="final-cta" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
