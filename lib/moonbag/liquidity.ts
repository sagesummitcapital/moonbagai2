// LIQUIDITY BANDS (Stavros 2026-10-19: "i want you to be looking at and using liquidity levels as well, test thesis to see what makes
// the most sense"; via Grok: "I want to know where liquidity is like from a heatmap"). Estimated liquidation heatmap from OKX perpetual
// open interest (public.liq_build, hourly): new OI each hour opens at that hour's price across 10x/25x/50x/100x, longs and shorts;
// a band disappears once price trades through it. liq_snap = the 6 biggest 0.25%-wide bands above and below price.
// Test (2026-10-19, Aug 28 → Oct 16, BTC/ETH/SOL): "big band = magnet" NO edge; band break continuation −0.24R; close-back sweep of a
// band ≈ 0R (vs −0.25R for a plain 24h-high/low sweep); resting fade limit AT the biggest band +0.08R vs −0.16R for a small band →
// PAPER flag only (LIQ✓), tracked weekly. Display only — it never changes a size, stop or grade.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Band = { side: "above" | "below"; rnk: number; level: number; usd: number; pct: number };
export type Liquidity = { coin: string; asOf: string; price: number; above: Band[]; below: Band[]; stale: boolean; text: string };

const fp = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : v >= 1 ? 2 : 4 });
const fm = (usd: number) => (usd >= 1e9 ? `$${(usd / 1e9).toFixed(1)}B` : `$${Math.round(usd / 1e6)}M`);
const phx = (t: string) => new Date(t).toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" });

export async function getLiquidity(coin: string): Promise<Liquidity | null> {
  const c = coin.toUpperCase().replace(/USDT.*$/, "");
  const db = supabaseAdmin();
  const last = await db.from("liq_snap").select("ts").eq("asset", c).order("ts", { ascending: false }).limit(1).maybeSingle();
  const ts = (last.data as { ts: string } | null)?.ts;
  if (!ts) return null;
  const r = await db.from("liq_snap").select("side, rnk, level, usd, pct_away, price").eq("asset", c).eq("ts", ts);
  const rows = (r.data ?? []) as { side: "above" | "below"; rnk: number; level: number; usd: number; pct_away: number; price: number }[];
  if (!rows.length) return null;
  const bands = rows.map((x) => ({ side: x.side, rnk: x.rnk, level: Number(x.level), usd: Number(x.usd), pct: Number(x.pct_away) }));
  const above = bands.filter((b) => b.side === "above").sort((a, b) => a.level - b.level);
  const below = bands.filter((b) => b.side === "below").sort((a, b) => b.level - a.level);
  const ageMin = (Date.now() - Date.parse(ts)) / 60_000;
  const stale = ageMin > 90;
  const show = (xs: Band[]) => xs.slice(0, 4).map((b) => `${fp(b.level)} ${fm(b.usd)}${b.rnk === 1 ? " ★" : ""}`).join(" · ") || "none within 8%";
  const text = `Liquidity (est. liquidation bands, ${phx(ts)} Phoenix${stale ? ` — STALE ${Math.round(ageMin)} min` : ""}): above ${show(above)} | below ${show(below)}. ★ = biggest. Paper only: fading the biggest band tested +0.08R; bands are not magnets.`;
  return { coin: c, asOf: ts, price: Number(rows[0].price), above, below, stale, text };
}

/** Top-3 band within tol% of a price on a given side (for "your entry/stop sits at liquidity" notes). */
export function bandNear(l: Liquidity | null, price: number, side: "above" | "below", tolPct = 0.5): Band | null {
  if (!l) return null;
  const xs = (side === "above" ? l.above : l.below).filter((b) => b.rnk <= 3 && (Math.abs(b.level - price) / price) * 100 <= tolPct);
  return xs.sort((a, b) => b.usd - a.usd)[0] ?? null;
}

/** One-line notes for a trade: entry at a band (LIQ✓ paper), stop parked inside a band (sweep risk), TP1 just past a band. */
export function liquidityNotes(l: Liquidity | null, side: "long" | "short", entry: number, stop: number, tp1: number | null): string[] {
  if (!l) return [];
  const out: string[] = [];
  const fadeSide = side === "short" ? "above" : "below"; // shorts fade bands above, longs fade bands below
  const e = bandNear(l, entry, fadeSide, 0.5);
  if (e) out.push(`LIQ✓ (paper): entry sits at the ${fp(e.level)} liquidity band (${fm(e.usd)}) — the setup we're tracking.`);
  const s = bandNear(l, stop, fadeSide, 0.3);
  if (s) out.push(`Stop ${fp(stop)} sits inside the ${fp(s.level)} band — stops there get swept; consider just beyond ${fp(s.level * (side === "short" ? 1.004 : 0.996))}.`);
  if (tp1 != null) {
    const tpSide = side === "short" ? "below" : "above";
    const t = bandNear(l, tp1, tpSide, 0.3);
    if (t && (side === "short" ? tp1 < t.level : tp1 > t.level)) out.push(`TP1 ${fp(tp1)} is just past the ${fp(t.level)} band — fills can stall at the band; in front of it is safer.`);
  }
  return out;
}
