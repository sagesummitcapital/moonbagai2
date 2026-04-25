import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageShell } from "../components/PageShell";

export const metadata: Metadata = {
  title: "You're in — Moonbag.ai",
  description: "You're on the Moonbag.ai waitlist.",
};

export default function ThanksPage() {
  return (
    <PageShell
      eyebrow="Welcome aboard"
      title="You're in."
      lead="Moonbag.ai is building an AI market intelligence and execution layer. You'll be first to know when early access opens."
    >
      <div className="flex items-center gap-3 rounded-2xl border border-accent-green/25 bg-accent-green/[0.04] p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-green/15">
          <Check className="h-5 w-5 text-accent-green" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-white">
            Confirmation sent
          </div>
          <div className="text-[13px] text-white/55">
            Check your inbox (and spam, just in case).
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-white/80 transition hover:border-white/20 hover:text-white"
        >
          ← Back to home
        </Link>
        <a
          href="https://x.com/moonbagai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2 text-[13px] font-semibold text-black transition hover:scale-[1.02]"
        >
          Follow on X →
        </a>
      </div>
    </PageShell>
  );
}
