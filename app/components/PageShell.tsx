"use client";

import { motion } from "framer-motion";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function PageShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black">
      <Navbar />

      <section className="relative pb-20 pt-36 md:pt-44">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {eyebrow && (
              <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent-green/80">
                {eyebrow}
              </div>
            )}
            <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[56px]">
              {title}
            </h1>
            {lead && (
              <p className="mt-5 max-w-2xl text-[16px] leading-[1.65] text-white/60 md:text-[17px]">
                {lead}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-12"
          >
            {children}
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/** Prose-style content for policy pages, matched to the brand. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-7 text-[15.5px] leading-[1.75] text-white/70 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-white [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-white/90 [&_p]:m-0 [&_a]:text-accent-green [&_a]:underline [&_a]:decoration-accent-green/30 [&_a]:underline-offset-2 hover:[&_a]:decoration-accent-green [&_strong]:font-semibold [&_strong]:text-white/90 [&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0 [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[11px] [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:rounded-full [&_li]:before:bg-accent-green/60">
      {children}
    </div>
  );
}
