import type { Metadata } from "next";
import { Mail, MessageCircle, Shield } from "lucide-react";
import { PageShell } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Contact — Moonbag.ai",
  description: "Get in touch with the Moonbag.ai team.",
};

const channels = [
  {
    icon: Mail,
    label: "General & partnerships",
    value: "hello@moonbag.ai",
    href: "mailto:hello@moonbag.ai",
  },
  {
    icon: Shield,
    label: "Privacy requests",
    value: "privacy@moonbag.ai",
    href: "mailto:privacy@moonbag.ai",
  },
  {
    icon: MessageCircle,
    label: "Follow on X",
    value: "@moonbagai",
    href: "https://x.com/moonbagai",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Let's talk."
      lead="Media, partnerships, early-access questions, or just a reaction — we read everything."
    >
      <div className="space-y-3">
        {channels.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all hover:border-accent-green/30 hover:bg-white/[0.04]"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition-colors group-hover:border-accent-green/40">
              <c.icon className="h-[18px] w-[18px] text-accent-green" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono font-medium uppercase tracking-[0.16em] text-white/40">
                {c.label}
              </div>
              <div className="mt-1 truncate text-[16px] font-medium text-white transition-colors group-hover:text-accent-green">
                {c.value}
              </div>
            </div>
            <div className="text-[11px] font-mono text-white/35 transition-colors group-hover:text-accent-green/80">
              →
            </div>
          </a>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-accent-green/[0.04] to-transparent p-6">
        <div className="text-[13px] font-medium text-white/80">
          Looking for early access?
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-white/55">
          Join the waitlist — founding users get priority onboarding and
          discounted beta pricing.
        </p>
        <a
          href="/#waitlist"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-4 py-2 text-[13px] font-semibold text-black transition-transform hover:scale-[1.02]"
        >
          Join the waitlist →
        </a>
      </div>
    </PageShell>
  );
}
