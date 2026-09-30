"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#ratings", label: "Ratings" },
  { href: "/#markets", label: "Markets" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/[0.06] bg-black/70 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative text-[13.5px] text-white/65 transition-colors hover:text-white"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-accent-gradient transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden rounded-full px-3 py-2 text-[13px] text-white/65 transition-colors hover:text-white md:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/#waitlist"
              className="group relative hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white transition-all hover:border-accent-green/40 hover:bg-white/[0.07] hover:shadow-[0_0_30px_-5px_rgba(62,243,162,0.4)] md:inline-flex"
            >
              <span className="relative z-10">Join Waitlist</span>
              <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-accent-green shadow-[0_0_10px_rgba(62,243,162,0.8)]" />
            </Link>

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/80 transition hover:bg-white/[0.06] md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute inset-x-4 top-20 rounded-2xl border border-white/10 bg-ink-100/95 p-3 shadow-2xl backdrop-blur-xl"
            >
              <nav className="flex flex-col">
                {LINKS.map((l, i) => (
                  <motion.div
                    key={l.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.04 }}
                  >
                    <Link
                      href={l.href}
                      className="block rounded-lg px-4 py-3 text-[15px] font-medium text-white/80 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
                <Link
                  href="/dashboard"
                  className="block rounded-lg px-4 py-3 text-[15px] font-medium text-white/80 transition hover:bg-white/[0.04] hover:text-white"
                >
                  Log in
                </Link>
                <div className="mt-2 border-t border-white/5 pt-2">
                  <Link
                    href="/#waitlist"
                    className="block rounded-lg bg-accent-gradient px-4 py-3 text-center text-[14px] font-semibold text-black"
                  >
                    Join Waitlist →
                  </Link>
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
