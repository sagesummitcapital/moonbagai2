import { timingSafeEqual } from "crypto";
import { identifyAgent, json } from "@/lib/moonbag/apiAuth";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily candles for the Coinbase book (BTC/ETH/SOL, tf '1d') from Coinbase's public market-data API.
 * The backtest engine (select public.cb_backtest()) and the Coinbase desk read these.
 * - Vercel Cron calls it daily (vercel.json) with "Authorization: Bearer $CRON_SECRET".
 * - Claude can call it with its API key; ?full=1 re-fetches the whole history (duplicates are ignored).
 * Only CLOSED daily bars are stored (the current UTC day is skipped).
 */
const PRODUCTS: { asset: string; product: string; start: string }[] = [
  { asset: "BTC", product: "BTC-USD", start: "2015-07-20" },
  { asset: "ETH", product: "ETH-USD", start: "2016-05-18" },
  { asset: "SOL", product: "SOL-USD", start: "2021-06-17" },
];
const DAY = 86400_000;

function cronOk(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (secret.length < 16 || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Row = { asset: string; tf: string; ts: string; o: number; h: number; l: number; c: number; v: number };

async function fetchRange(product: string, from: number, to: number): Promise<number[][]> {
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400&start=${new Date(from).toISOString()}&end=${new Date(to).toISOString()}`;
  const res = await fetch(url, { headers: { "User-Agent": "moonbag.ai candle sync" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${product} ${res.status}`);
  return (await res.json()) as number[][]; // [time, low, high, open, close, volume]
}

export async function GET(req: Request) {
  if (!cronOk(req) && identifyAgent(req) !== "claude") return json({ ok: false, error: "Unauthorized" }, 401);
  if (!isSupabaseConfigured()) return json({ ok: false, error: "Supabase is not configured" }, 503);
  const full = new URL(req.url).searchParams.get("full") === "1";
  const db = supabaseAdmin();
  const todayUtc = Math.floor(Date.now() / DAY) * DAY; // start of the forming day — never stored
  const out: Record<string, unknown> = {};
  for (const p of PRODUCTS) {
    try {
      const [{ data: first }, { data: last }] = await Promise.all([
        db.from("candles").select("ts").eq("asset", p.asset).eq("tf", "1d").order("ts", { ascending: true }).limit(1),
        db.from("candles").select("ts").eq("asset", p.asset).eq("tf", "1d").order("ts", { ascending: false }).limit(1),
      ]);
      const start = Date.parse(p.start);
      const haveFrom = first?.[0] ? Date.parse(first[0].ts as string) : null;
      const haveTo = last?.[0] ? Date.parse(last[0].ts as string) : null;
      // Backfill everything when asked, when empty, or when history before the first stored bar is missing.
      const from = full || haveFrom == null || haveFrom > start + 5 * DAY ? start : (haveTo as number) - 3 * DAY;
      let n = 0;
      for (let a = from; a < todayUtc; a += 290 * DAY) {
        const b = Math.min(a + 290 * DAY, todayUtc - DAY);
        const bars = await fetchRange(p.product, a, b);
        const rows: Row[] = bars
          .filter((x) => x[0] * 1000 < todayUtc)
          .map((x) => ({ asset: p.asset, tf: "1d", ts: new Date(x[0] * 1000).toISOString(), o: x[3], h: x[2], l: x[1], c: x[4], v: x[5] }));
        if (rows.length) {
          const { error } = await db.from("candles").upsert(rows, { onConflict: "asset,tf,ts", ignoreDuplicates: true });
          if (error) throw new Error(error.message);
          n += rows.length;
        }
      }
      out[p.asset] = { fetched: n, from: new Date(from).toISOString().slice(0, 10) };
    } catch (e) {
      out[p.asset] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return json({ ok: true, synced: out });
}
