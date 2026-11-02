// Server-only Supabase client using the service-role key.
// NEVER import this file from a "use client" component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}
function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && serviceKey());
}

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin() must only run on the server.");
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see SETUP.md)."
    );
  }
  if (!client) {
    client = createClient(supabaseUrl(), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      // 2026-11-01: never let Next.js's data cache serve an old database read (Grok saw /strategy v42 and Coinbase
      // max positions 3 hours after the database changed). Every query goes to the database.
      global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }
  return client;
}
