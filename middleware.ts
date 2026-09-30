// Login gate for the private Moonbag app (/dashboard/*), powered by Clerk.
// The public landing page, waitlist and the Claude/Grok API (/api/moonbag/*,
// protected by its own API keys) are NOT affected.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPrivate = createRouteMatcher(["/dashboard(.*)"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPrivate(req)) return;
  const { userId } = await auth();
  if (!userId) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
});

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  const clerkReady = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
  // Until Clerk keys are added, keep the private area closed and point to the setup checklist.
  if (!clerkReady) {
    if (isPrivate(req)) return NextResponse.redirect(new URL("/setup", req.url));
    return NextResponse.next();
  }
  return withClerk(req, ev);
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in/:path*"],
};
