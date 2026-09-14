import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort in-memory rate limit (per serverless instance).
// Keeps a bot from hammering the inbox without adding infrastructure.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const source =
      typeof body?.source === "string" ? body.source.slice(0, 64) : "landing";
    // Honeypot: real users never fill this, bots usually do.
    const trap = typeof body?.company === "string" ? body.company.trim() : "";

    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    // Silently accept and drop bot submissions.
    if (trap) return NextResponse.json({ ok: true });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "";
    const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? "";

    if (rateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }

    // Always log the signup so it is recoverable from platform logs
    // even if the email provider has a bad day.
    console.log(`[waitlist] signup: ${email} · source=${source} · ip=${ip}`);

    const { isEmailConfigured, sendWaitlistNotification, sendWaitlistConfirmation } =
      await import("@/lib/email");

    if (!isEmailConfigured()) {
      console.error(
        "[waitlist] RESEND_API_KEY or WAITLIST_NOTIFY_EMAIL missing — signup only logged."
      );
      return NextResponse.json(
        { ok: false, error: "Signups are temporarily unavailable." },
        { status: 503 }
      );
    }

    // The notification is the one that matters — there's no database behind
    // this form, so if it fails we tell the visitor to try again.
    try {
      await sendWaitlistNotification({ email, source, ip, userAgent });
    } catch (e) {
      console.error("[waitlist] notification failed:", e);
      return NextResponse.json(
        { ok: false, error: "Couldn't submit right now. Please try again." },
        { status: 502 }
      );
    }

    // Confirmation to the subscriber is best-effort — never fails the signup.
    try {
      await sendWaitlistConfirmation(email);
    } catch (e) {
      console.error("[waitlist] confirmation failed:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] unhandled:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error." },
      { status: 500 }
    );
  }
}
