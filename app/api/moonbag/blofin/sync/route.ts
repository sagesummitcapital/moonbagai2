import { timingSafeEqual } from "crypto";
import { identifyAgent, json } from "@/lib/moonbag/apiAuth";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase/admin";
import { blofinStatus, syncBlofin } from "@/lib/moonbag/blofin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * READ-ONLY BloFin sync (CR-70). Nothing here can trade.
 * POST with the Moonbag sync token (pg_cron, weekdays 6 AM–12 PM hourly + 6 PM, weekends 9 AM Phoenix) → runs the sync.
 * GET  with CRON_SECRET (Vercel Cron, if one is added)     → runs the sync.
 * GET  with the Claude/Grok key                            → status: last sync, trades that don't match the exchange, untracked positions.
 *      ?sync=1 runs a sync first.
 * POST with the Claude/Grok key                            → runs the sync, then returns the status.
 */
function cronOk(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (secret.length < 16 || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The pg_cron bearer: a random token kept in Supabase Vault, checked by the database. It can only start this read-only sync. */
async function syncTokenOk(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (token.length < 32) return false;
  const r = await supabaseAdmin().rpc("mb_sync_token_ok", { p_token: token });
  return !r.error && r.data === true;
}

async function run(by: string, doSync: boolean) {
  const sync = doSync ? await syncBlofin(by) : null;
  const status = await blofinStatus();
  return json({ ok: sync ? sync.ok : true, sync, ...status });
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return json({ ok: false, error: "Supabase is not configured" }, 503);
  if (cronOk(req)) {
    const s = await syncBlofin("vercel_cron");
    return json(s, s.ok || !s.configured ? 200 : 502);
  }
  const agent = identifyAgent(req);
  if (!agent) return json({ ok: false, error: "Unauthorized" }, 401);
  return run(agent, new URL(req.url).searchParams.get("sync") === "1");
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return json({ ok: false, error: "Supabase is not configured" }, 503);
  const agent = identifyAgent(req);
  if (!agent && (await syncTokenOk(req))) {
    const s = await syncBlofin("pg_cron");
    return json({ ok: s.ok, configured: s.configured, summary: s.summary ?? null, error: s.error ?? null }, s.ok || !s.configured ? 200 : 502);
  }
  if (!agent) return json({ ok: false, error: "Unauthorized" }, 401);
  return run(agent, true);
}
