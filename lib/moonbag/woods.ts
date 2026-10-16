// Woods framework (Stavros's mentor; adopted 2026-10-16 as the MAIN leverage strategy). The levels Woods gives (line in the
// sand, flip level, demand/supply zones, order blocks, liquidity) are stored in woods_levels so the desk, Grok and the morning
// map all read the same map. Grok records them (POST /woods) when Stavros relays a new map.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type WoodsLevel = {
  level_id: number; coin: string; kind: string; low: number | null; high: number | null; timeframe: string | null;
  note: string | null; source: string; active: boolean; created_at: string; updated_at: string;
};

export const WOODS_KINDS = ["line_in_sand", "flip", "demand", "supply", "order_block", "liquidity", "range_high", "range_low", "target", "note"] as const;

export async function getWoodsLevels(coin?: string) {
  let q = supabaseAdmin().from("woods_levels").select("*").eq("active", true).order("coin").order("low", { ascending: false });
  if (coin) q = q.eq("coin", coin.toUpperCase());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as WoodsLevel[];
}

const n = (v: number | null) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: v >= 1 ? 2 : 4 }));
const rng = (l: WoodsLevel) => (l.low != null && l.high != null && l.low !== l.high ? `${n(l.low)}–${n(l.high)}` : n(l.low ?? l.high));

/** BTC anchor state from the stored line in the sand: below → no alt longs; inside → chop; above (on 4H acceptance) → bullish. */
export function anchorState(btcPrice: number | null, levels: WoodsLevel[]) {
  const line = levels.find((l) => l.coin === "BTC" && l.kind === "line_in_sand");
  if (!line || btcPrice == null) return { state: "unknown" as const, line: null, text: "BTC line in the sand not set — ask Woods / set it in the morning map." };
  const lo = Number(line.low), hi = Number(line.high ?? line.low);
  const state = btcPrice < lo ? ("below" as const) : btcPrice <= hi ? ("inside" as const) : ("above" as const);
  const text =
    state === "below" ? `BTC ${n(btcPrice)} is BELOW the line in the sand ${rng(line)} — chop/neutral; no alt longs.`
    : state === "inside" ? `BTC ${n(btcPrice)} is INSIDE the line ${rng(line)} — no-man's land; wait for the edge or the break.`
    : `BTC ${n(btcPrice)} is ABOVE ${rng(line)} — bullish only once a 4H candle has closed and held above ${n(hi)} (acceptance, not a touch).`;
  return { state, line, text };
}

export function woodsText(levels: WoodsLevel[]) {
  if (!levels.length) return "WOODS MAP: no levels stored.";
  const L = ["WOODS MAP (levels from Woods / Stavros — the desk trades their edges or their break, never the middle)"];
  for (const c of [...new Set(levels.map((l) => l.coin))]) {
    L.push(`${c}:`);
    for (const l of levels.filter((x) => x.coin === c)) L.push(`  ${l.kind.replace(/_/g, " ").toUpperCase()} ${rng(l)}${l.timeframe ? ` (${l.timeframe})` : ""}${l.note ? ` — ${l.note}` : ""} [#${l.level_id}]`);
  }
  return L.join("\n");
}
