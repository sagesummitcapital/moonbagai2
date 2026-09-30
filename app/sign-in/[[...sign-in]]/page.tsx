import Link from "next/link";
import { ClerkProvider, SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/app/dashboard/_components/clerkAppearance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Moonbag", robots: { index: false } };

export default function SignInPage() {
  const ready = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-16">
      <Link href="/" className="font-semibold tracking-tight text-white/80 hover:text-white">
        moonbag<span className="text-gradient">.ai</span>
      </Link>
      {ready ? (
        <ClerkProvider appearance={clerkAppearance}>
          <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />
        </ClerkProvider>
      ) : (
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/70">
          Login isn&apos;t switched on yet. See the <Link className="text-accent-green underline" href="/setup">setup checklist</Link>.
        </div>
      )}
    </main>
  );
}
