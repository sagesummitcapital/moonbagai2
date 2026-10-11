// Server-side glue between the pages and lib/moonbag/prices.ts.
import { getLivePricesMixed, type LivePrice, type PriceKind, type PriceMap } from "@/lib/moonbag/prices";
import type { Stored } from "./LivePrice";

/** Thesis "assets" that are not a market you can price. */
export const NON_TRADABLE = new Set(["MASTER", "EQUITY", "HOLDINGS", "MACRO", "SYSTEM"]);

/** Core crypto the desk always has, used when a page has no universe list to learn from. */
const CORE_CRYPTO = ["BTC", "ETH", "SOL"];

/** Which feed a symbol belongs to, given the set of coins the desks know about. */
export const kindFor = (symbol: string, cryptoSet: Set<string>): PriceKind => (cryptoSet.has(symbol.toUpperCase()) ? "crypto" : "stock");

/** Build the crypto set from any lists the page already loaded (lev_universe assets, cb_universe symbols …). */
export function cryptoSetFrom(...lists: (string | null | undefined)[][]): Set<string> {
  const s = new Set(CORE_CRYPTO);
  for (const l of lists) for (const x of l) if (x) s.add(String(x).toUpperCase());
  return s;
}

/** Fetch live prices for a mixed bag of symbols, routed by the crypto set. Never throws. */
export async function loadLive(symbols: (string | null | undefined)[], cryptoSet: Set<string>, opts: { change?: boolean } = {}): Promise<PriceMap> {
  const uniq = Array.from(new Set(symbols.filter((s): s is string => !!s && !NON_TRADABLE.has(s.toUpperCase())).map((s) => s.toUpperCase())));
  const crypto = uniq.filter((s) => cryptoSet.has(s));
  const stocks = uniq.filter((s) => !cryptoSet.has(s));
  try {
    return await getLivePricesMixed(crypto, stocks, opts);
  } catch {
    return {};
  }
}

/** The desk's stored decision price as a LivePrice fallback descriptor. */
export const storedOf = (price: number | null | undefined, asOf: string | null | undefined, label = "desk check"): Stored => ({ price: price == null ? null : Number(price), asOf: asOf ?? null, label });

/** Best price for server-side maths: live when it answered, else the stored one. */
export function best(live: LivePrice | null | undefined, stored: number | null | undefined): { price: number | null; isLive: boolean } {
  if (live?.ok && live.price != null) return { price: live.price, isLive: true };
  return { price: stored == null || Number.isNaN(Number(stored)) ? null : Number(stored), isLive: false };
}
