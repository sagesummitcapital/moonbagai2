"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-green/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]"
        >
          {/* Brand */}
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13.5px] leading-[1.6] text-white/50">
              AI market intelligence + execution layer for traders who want
              speed, clarity, and an edge.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
                Beta · launching soon
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
              Product
            </div>
            <ul className="space-y-2.5 text-[13.5px]">
              <FooterLink href="/#how-it-works">How It Works</FooterLink>
              <FooterLink href="/#ratings">Ratings</FooterLink>
              <FooterLink href="/#markets">Markets</FooterLink>
              <FooterLink href="/#faq">FAQ</FooterLink>
            </ul>
          </div>

          {/* Company */}
          <div>
            <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
              Company
            </div>
            <ul className="space-y-2.5 text-[13.5px]">
              <FooterLink href="/#waitlist">Waitlist</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
            </ul>
          </div>

          {/* Social */}
          <div>
            <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
              Follow
            </div>
            <ul className="space-y-2.5 text-[13.5px]">
              <FooterLink href="https://x.com/moonbagai" external>
                X / Twitter
              </FooterLink>
              <FooterLink href="mailto:hello@moonbag.ai">Email</FooterLink>
            </ul>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/[0.05] pt-8 md:flex-row md:items-center">
          <div className="text-[12px] text-white/35">
            © {new Date().getFullYear()} Moonbag.ai · All rights reserved.
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/35">
            <span>Speed</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Clarity</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Execution</span>
          </div>
        </div>
      </div>

      {/* Oversized wordmark */}
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <div className="-mb-8 bg-gradient-to-b from-white/[0.04] to-transparent bg-clip-text text-center text-[18vw] font-bold leading-[0.8] tracking-[-0.06em] text-transparent md:-mb-16">
          moonbag.ai
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const isExternal =
    external || href.startsWith("http") || href.startsWith("mailto:");
  const inner = (
    <span className="relative">
      {children}
      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent-gradient transition-all duration-300 group-hover:w-full" />
    </span>
  );
  return (
    <li>
      {isExternal ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="group inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
        >
          {inner}
        </a>
      ) : (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
        >
          {inner}
        </Link>
      )}
    </li>
  );
}
