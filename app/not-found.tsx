import Link from "next/link";
import { PageShell } from "./components/PageShell";

export default function NotFound() {
  return (
    <PageShell
      eyebrow="404 — off-chart"
      title="This page isn't on our scanner."
      lead="The link you followed doesn't exist. Head back to base and try again."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-5 py-2.5 text-[14px] font-semibold text-black transition-transform hover:scale-[1.02]"
        >
          ← Back to home
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-[14px] font-medium text-white/80 transition hover:border-white/20 hover:text-white"
        >
          Contact us
        </Link>
      </div>
    </PageShell>
  );
}
