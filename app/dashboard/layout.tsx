import Link from "next/link";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { getOwnerAccess } from "@/lib/auth/owner";
import { DashNav } from "./_components/DashNav";
import { clerkAppearance } from "./_components/clerkAppearance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moonbag — Desk", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getOwnerAccess();

  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="relative min-h-screen bg-black text-white">
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 md:px-8">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                moonbag<span className="text-gradient">.ai</span>
                <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">desk</span>
              </Link>
              <UserButton />
            </div>
            {access.allowed && <DashNav />}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
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
