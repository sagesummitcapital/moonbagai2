import { createHmac, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * READ-ONLY BloFin sync (CR-70, Stavros 2026-11-10: "Yes, design and build it").
 * Pulls his fills, order history, TP/SL history, open positions and futures balance from BloFin, stores them
 * (blofin_* tables) and lets Moonbag compare every logged trade with the exchange (v_blofin_reconcile).
 *
 * The key is a BloFin key with ONLY the "Read" permission, set by Stavros in Vercel env:
 *   BLOFIN_API_KEY, BLOFIN_API_SECRET, BLOFIN_API_PASSPHRASE
 * This file only ever sends GET requests. It has no code path that can place, change or cancel an order or move funds.
 *
 * Signing (BloFin docs + official SDK): prehash = path(with query) + "GET" + timestamp(ms) + nonce + "";
 * ACCESS-SIGN = base64( hex( HMAC-SHA256(secret, prehash) ) ).
 */
const BASE = "https://openapi.blofin.com";
const PAGE = 100;

type Row = Record<string, unknown>;

export function blofinConfigured() {
  return Boolean(process.env.BLOFIN_API_KEY && process.env.BLOFIN_API_SECRET && process.env.BLOFIN_API_PASSPHRASE);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sign(prehash: string, secret: string) {
  const hex = createHmac("sha256", secret).update(prehash).digest("hex");
  return Buffer.from(hex, "utf8").toString("base64");
}

async function get(path: string, params: Record<string, string | number | undefined> = {}, auth = true): Promise<Row[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const requestPath = qs.toString() ? `${path}?${qs.toString()}` : path;
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "moonbag.ai read-only sync" };
  if (auth) {
    const ts = String(Date.now());
    const nonce = randomUUID();
    headers["ACCESS-KEY"] = process.env.BLOFIN_API_KEY ?? "";
    headers["ACCESS-PASSPHRASE"] = process.env.BLOFIN_API_PASSPHRASE ?? "";
    headers["ACCESS-TIMESTAMP"] = ts;
    headers["ACCESS-NONCE"] = nonce;
    headers["ACCESS-SIGN"] = sign(requestPath + "GET" + ts + nonce, process.env.BLOFIN_API_SECRET ?? "");
  }
  const res = await fetch(BASE + requestPath, { method: "GET", headers, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { code?: string; msg?: string; data?: unknown } | null;
  if (!res.ok || !body || String(body.code) !== "0") {
    // Never echo headers or the key; the message is BloFin's own.
    throw new Error(`BloFin ${path}: ${res.status} ${body?.msg ?? "no body"}`);
  }
  return Array.isArray(body.data) ? (body.data as Row[]) : body.data ? [body.data as Row] : [];
}

/** Page backwards with `after` (older than the given id) until a page is short, older than `stopBefore`, or `maxPages` is hit. */
async function pages(path: string, idKey: string, tsKey: string, stopBefore: number | null, maxPages: number, extra: Record<string, string> = {}) {
  const out: Row[] = [];
  let after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const rows = await get(path, { ...extra, limit: PAGE, after });
    out.push(...rows);
    if (rows.length < PAGE) break;
    const last = rows[rows.length - 1];
    after = String(last[idKey] ?? "");
    const ts = Number(last[tsKey]);
    if (!after || (stopBefore != null && Number.isFinite(ts) && ts < stopBefore)) break;
    await sleep(400); // BloFin: 30 trading-API requests per 10 s
  }
  return out;
}

export type SyncResult = { ok: boolean; configured: boolean; summary?: Row; error?: string };

export async function syncBlofin(triggeredBy: string): Promise<SyncResult> {
  if (!blofinConfigured()) return { ok: false, configured: false, error: "BloFin read-only key is not set in Vercel yet (BLOFIN_API_KEY, BLOFIN_API_SECRET, BLOFIN_API_PASSPHRASE)." };
  const db = supabaseAdmin();
  try {
    const last = await db.from("blofin_fills").select("ts").order("ts", { ascending: false }).limit(1);
    const lastMs = last.data?.[0]?.ts ? new Date(String(last.data[0].ts)).getTime() : null;
    const stopBefore = lastMs != null ? lastMs - 24 * 3600_000 : null; // re-read a day of overlap; duplicates are ignored
    const backfill = lastMs == null;

    const instruments = await get("/api/v1/market/instruments", {}, false).catch(() => [] as Row[]);
    const fills = await pages("/api/v1/trade/fills-history", "tradeId", "ts", stopBefore, backfill ? 30 : 6);
    await sleep(400);
    const orders = await pages("/api/v1/trade/orders-history", "orderId", "createTime", stopBefore, backfill ? 10 : 3);
    await sleep(400);
    const tpsl = await pages("/api/v1/trade/orders-tpsl-history", "tpslId", "createTime", stopBefore, backfill ? 10 : 3);
    await sleep(400);
    const positions = await get("/api/v1/account/positions");
    await sleep(400);
    const balances = await get("/api/v1/asset/balances", { accountType: "futures" });

    const pick = (rows: Row[], keys: string[]) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
    const r = await db.rpc("mb_blofin_ingest", {
      p: {
        instruments: pick(instruments, ["instId", "contractValue"]),
        fills,
        orders,
        tpsl,
        positions,
        balances: pick(balances, ["currency", "balance", "available", "frozen"]),
      },
    });
    if (r.error) throw new Error(r.error.message);
    const summary = { ...(r.data as Row), fetched: { fills: fills.length, orders: orders.length, tpsl: tpsl.length, positions: positions.length }, backfill };
    await db.from("blofin_sync_runs").insert({ ok: true, triggered_by: triggeredBy, summary });
    return { ok: true, configured: true, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("blofin_sync_runs").insert({ ok: false, triggered_by: triggeredBy, error: msg.slice(0, 500) });
    return { ok: false, configured: true, error: msg };
  }
}

/** What Grok and Claude read: last sync, trades that don't match the exchange, positions with no Moonbag trade. */
export async function blofinStatus() {
  const db = supabaseAdmin();
  const [run, rec, untracked] = await Promise.all([
    db.from("blofin_sync_runs").select("*").order("run_id", { ascending: false }).limit(1),
    db.from("v_blofin_reconcile").select("*").order("opened_at", { ascending: false }).limit(200),
    db.from("v_blofin_untracked").select("*"),
  ]);
  const rows = (rec.data ?? []) as Row[];
  const flagged = rows.filter((x) => Array.isArray(x.flags) && (x.flags as unknown[]).length > 0);
  const lastRun = run.data?.[0] ?? null;
  const lines: string[] = [];
  lines.push(
    !blofinConfigured()
      ? "BloFin sync: not set up yet — waiting for Stavros's read-only key in Vercel."
      : lastRun
        ? `BloFin sync: last run ${new Date(String(lastRun.started_at)).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Phoenix — ${lastRun.ok ? "ok" : `FAILED (${lastRun.error})`}.`
        : "BloFin sync: key set, no run yet.",
  );
  lines.push(`Checked ${rows.length} trades against the exchange: ${flagged.length} need a look.`);
  for (const x of flagged.slice(0, 15)) lines.push(`- ${x.trade_id}: ${(x.flags as string[]).join("; ")}`);
  for (const u of (untracked.data ?? []) as Row[]) lines.push(`- Open on BloFin with no Moonbag trade: ${u.symbol} ${u.positions} @ ${u.average_price}`);
  return { configured: blofinConfigured(), last_run: lastRun, checked: rows.length, flagged, untracked: untracked.data ?? [], text: lines.join("\n") };
}
