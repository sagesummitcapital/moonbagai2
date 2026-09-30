import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup — Moonbag", robots: { index: false } };

// Shows ONLY whether each setting exists (never its value), so it is safe to be public.
const has = (...names: string[]) => names.some((n) => Boolean(process.env[n]));

export default function SetupPage() {
  const steps = [
    {
      title: "Login (Clerk)",
      items: [
        ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", has("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")],
        ["CLERK_SECRET_KEY", has("CLERK_SECRET_KEY")],
        ["MOONBAG_OWNER_EMAILS", has("MOONBAG_OWNER_EMAILS")],
      ],
    },
    {
      title: "Database (Supabase)",
      items: [
        ["SUPABASE_URL", has("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")],
        ["SUPABASE_SERVICE_ROLE_KEY", has("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")],
      ],
    },
    {
      title: "Agent keys (Claude + Grok)",
      items: [
        ["MOONBAG_CLAUDE_API_KEY", has("MOONBAG_CLAUDE_API_KEY")],
        ["MOONBAG_GROK_API_KEY", has("MOONBAG_GROK_API_KEY")],
      ],
    },
  ] as const;

  const allDone = steps.every((s) => s.items.every(([, ok]) => ok));

  return (
    <main className="mx-auto max-w-2xl px-5 py-20 text-white">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-green/80">Moonbag setup</div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        {allDone ? "Everything is connected." : "Almost there — a few settings to add."}
      </h1>
      <p className="mt-3 text-white/60">
        Add missing items in <strong className="text-white/85">Vercel → your project → Settings → Environment Variables</strong>,
        then redeploy. The step-by-step guide is <code className="text-accent-green">SETUP.md</code> in your moonbagai2 folder.
      </p>

      <div className="mt-10 space-y-6">
        {steps.map((s) => (
          <section key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold">{s.title}</h2>
            <ul className="mt-3 space-y-2">
              {s.items.map(([name, ok]) => (
                <li key={name} className="flex items-center justify-between gap-4 font-mono text-[13px]">
                  <span className="text-white/75">{name}</span>
                  <span className={ok ? "text-accent-green" : "text-amber-300"}>{ok ? "✓ set" : "missing"}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/dashboard"
          className="inline-flex rounded-full bg-accent-gradient px-5 py-2.5 text-[14px] font-semibold text-black"
        >
          Open Moonbag →
        </Link>
      </div>
    </main>
  );
}
