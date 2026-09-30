import { isSupabaseConfigured } from "@/lib/supabase/admin";

/** Runs a loader only when Supabase is configured; returns an error message instead of crashing the page. */
export async function load<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: "not-configured" };
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    console.error("[dashboard]", e);
    return { data: null, error: e instanceof Error ? e.message : "Could not load data" };
  }
}
