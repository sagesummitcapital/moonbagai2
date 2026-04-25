import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lazy imports so the route boots even when env vars are missing.
// This lets you deploy the site immediately and wire creds later.
async function tryStoreInSupabase(email: string, source: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skipped: true as const };

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.from("waitlist").insert({ email, source });
    if (error) {
      const dup =
        error.code === "23505" || /duplicate key/i.test(error.message ?? "");
      if (dup) return { stored: false as const, duplicate: true as const };
      console.error("[waitlist] supabase error:", error);
      return { stored: false as const, error: error.message };
    }
    return { stored: true as const };
  } catch (e) {
    console.error("[waitlist] supabase import failed:", e);
    return { stored: false as const, error: "storage_unavailable" };
  }
}

async function trySendEmail(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { skipped: true };

  try {
    const { sendWaitlistConfirmation } = await import("@/lib/email");
    await sendWaitlistConfirmation(email);
    return { sent: true };
  } catch (e) {
    console.error("[waitlist] resend error:", e);
    return { sent: false };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const source =
      typeof body?.source === "string" ? body.source.slice(0, 64) : "landing";

    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    const storeResult = await tryStoreInSupabase(email, source);

    // If storage is fully unavailable (no creds yet), log it so you can
    // recover signups from platform logs later.
    if ("skipped" in storeResult && storeResult.skipped) {
      console.log(
        `[waitlist] (no storage configured) signup: ${email} · source=${source}`
      );
    }

    // Fire-and-forget email — never blocks or fails the signup.
    const duplicate =
      "duplicate" in storeResult ? !!storeResult.duplicate : false;
    if (!duplicate) {
      await trySendEmail(email).catch(() => {});
    }

    return NextResponse.json({ ok: true, duplicate });
  } catch (err) {
    console.error("[waitlist] unhandled:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error." },
      { status: 500 }
    );
  }
}
