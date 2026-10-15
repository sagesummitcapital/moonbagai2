"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getOwnerAccess } from "@/lib/auth/owner";
import { clearPriceMemo } from "@/lib/moonbag/prices";

let lastRefresh = 0;

/** Refresh button: re-pull live prices and reload every dashboard page from the database. Owner only; at most every 20 s. */
export async function refreshLive(): Promise<{ ok: boolean; at: string; note?: string }> {
  const access = await getOwnerAccess();
  if (!access.allowed) return { ok: false, at: new Date().toISOString(), note: "not allowed" };
  const now = Date.now();
  if (now - lastRefresh < 20_000) return { ok: true, at: new Date(lastRefresh).toISOString(), note: "refreshed a moment ago" };
  lastRefresh = now;
  clearPriceMemo();
  revalidateTag("live-prices");
  revalidatePath("/dashboard", "layout");
  return { ok: true, at: new Date(now).toISOString() };
}
