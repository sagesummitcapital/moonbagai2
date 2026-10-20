// Live last price from BloFin's public ticker (Stavros 2026-10-18: "make sure i always know the time of this data"). Shared by
// /quick, /levels and the desk journal so no card ever shows a stale desk-check price as "now".
import { supabaseAdmin } from "@/lib/supabase/admin";

export const STALE_MIN = 45; // a price older than this is flagged STALE (Grok, desk journal #9)

/** Live last price from BloFin's public ticker (seconds old), falling back to the newest 15m candle close. */
export async function livePrice(coin: string): Promise<{ price: number; source: string; at: number } | null> {
  const c = coin.toUpperCase().replace(/USDT.*$/, "");
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(`https://openapi.blofin.com/api/v1/market/tickers?instId=${c}-USDT`, { cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    const j = (await r.json()) as { code?: string; data?: { last?: string; ts?: string }[] };
    const last = Number(j?.data?.[0]?.last);
    if (j?.code === "0" && last > 0) return { price: last, source: "BloFin live", at: Number(j.data?.[0]?.ts) || Date.now() };
  } catch { /* fall through */ }
  const row = await supabaseAdmin().from("candles").select("c, ts").eq("asset", c).eq("tf", "15m").order("ts", { ascending: false }).limit(1).maybeSingle()
    .then((r: { data: unknown }) => r.data as { c: number; ts: string } | null, () => null);
  return row ? { price: Number(row.c), source: "last 15m close (live ticker unavailable)", at: Date.parse(row.ts) + 15 * 60_000 } : null;
}

