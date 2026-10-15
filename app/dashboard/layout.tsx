import Link from "next/link";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { getOwnerAccess } from "@/lib/auth/owner";
import { DashNav } from "./_components/DashNav";
import RefreshButton from "./_components/RefreshButton";
import { clerkAppearance } from "./_components/clerkAppearance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moonbag — Desk", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getOwnerAccess();
  // Server render time, Phoenix. Re-rendered by the Refresh button (router.refresh) so it doubles as "last updated".
  const builtAt = new Date().toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" });

  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="relative min-h-screen bg-black text-white">
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-5 py-3 md:px-8">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                moonbag<span className="text-gradient">.ai</span>
                <span className="ml-2 hidden font-mono text-[11px] uppercase tracking-[0.2em] text-white/40 sm:inline">desk</span>
              </Link>
              <div className="flex items-center gap-3">
                {access.allowed && (
                  <span className="hidden font-mono text-[11px] tabular-nums text-white/35 sm:inline" title="When this page was built (Phoenix). Refresh pulls live prices and rebuilds it.">
                    as of {builtAt}
                  </span>
                )}
                {access.allowed && <RefreshButton />}
                <UserButton />
              </div>
            </div>
            {access.allowed && <DashNav />}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-7">
          {!access.allowed ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <h1 className="text-xl font-semibold">This desk is private.</h1>
              <p className="mt-2 text-white/60">
                You&apos;re signed in as {access.emails[0] ?? "an unknown user"}, which isn&apos;t on the owner list.
              </p>
            </div>
          ) : (
            <>
              {!access.allowlistSet && (
                <div className="mb-6 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-[13.5px] text-amber-100/90">
                  Tip: add <code>MOONBAG_OWNER_EMAILS</code> in Vercel so only your email can open this desk.
                </div>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </ClerkProvider>
  );
}
