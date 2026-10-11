// Live market prices for the dashboard. Server-side only (fetch), never throws.
//
// The desk's stored prices (lev_hourly.price, cb_universe.close, account snapshots) are DECISION
// prices: what the desk saw when it wrote a plan. They can be hours old. Anything Stavros reads to
// act on *now* should come from here, with the source's own timestamp, and fall back to the stored
// value — clearly marked stale — only when the source is unreachable.
//
//   crypto  → Coinbase Exchange public API (spot).  BloFin perps are shown at Coinbase spot.
//             No <SYM>-USD product on Coinbase → Kraken public ticker.
//   stocks  → Yahoo Finance v8 chart endpoint (regularMarketPrice). Delayed ~15 min for some venues.
//
// Each call is cached by Next for 1 h (`next.revalidate`), aborted after 4 s, and batched in parallel
// with a small concurrency cap so a page of 40 symbols never trips Coinbase's rate limit.

export type PriceKind = "crypto" | "stock";

export interface LivePrice {
  symbol: string;
  /** Last trade / regular-market price. null when `ok` is false. */
  price: number | null;
  /** 24 h change in percent (crypto: vs the 24 h open; stocks: vs the previous close). */
  changePct24h: number | null;
  /** ISO timestamp from the source itself when it gives one, otherwise the time of the fetch. */
  asOf: string | null;
  /** Human label, e.g. "Coinbase spot", "Kraken spot", "Yahoo Finance". */
  source: string;
  ok: boolean;
  kind: PriceKind;
  error?: string;
}

export type PriceMap = Record<string, LivePrice>;

const TIMEOUT_MS = 4000;
const REVALIDATE_S = 3600; // hourly — live tick not needed
const CONCURRENCY = 8;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const SYMBOL_RE = /^[A-Z0-9.-]{1,12}$/;
export const MAX_SYMBOLS = 40;

/** Upper-cases, de-duplicates, validates and caps a list of symbols. Invalid entries are dropped. */
export function normalizeSymbols(input: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? "").trim().toUpperCase();
    if (!s || !SYMBOL_RE.test(s) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= MAX_SYMBOLS) break;
  }
  return out;
}

/** The venue tells us where a symbol trades: BloFin and Coinbase are crypto, Robinhood is stocks/ETFs. */
export const kindForVenue = (venue?: string | null): PriceKind => (venue === "robinhood" ? "stock" : "crypto");

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
};

// In-process memo on top of Next's data cache: the dashboard pages are force-dynamic, and whether a
// per-fetch `revalidate` survives that varies by Next version. This guarantees ≤ 1 upstream call per URL
// per hour per server instance, however many viewers or widgets are polling. In-flight calls are shared.
const memo = new Map<string, { at: number; p: Promise<unknown> }>();

function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const hit = memo.get(url);
  const now = Date.now();
  if (hit && now - hit.at < REVALIDATE_S * 1000) return hit.p;
  const p = fetchJson(url, headers);
  memo.set(url, { at: now, p });
  p.catch(() => memo.delete(url)); // a failure is retried on the next call, not memoised
  if (memo.size > 500) for (const [k, v] of memo) if (now - v.at > REVALIDATE_S * 1000) memo.delete(k);
  return p;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA, ...headers },
      signal: ctrl.signal,
      // Next.js data cache: one upstream call per hour per URL, shared by every viewer and poll.
      next: { revalidate: REVALIDATE_S },
    } as RequestInit);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const fail = (symbol: string, kind: PriceKind, source: string, error: string): LivePrice => ({
  symbol, price: null, changePct24h: null, asOf: null, source, ok: false, kind, error,
});

// ---------------------------------------------------------------- crypto
async function coinbaseSpot(symbol: string, withChange: boolean): Promise<LivePrice> {
  const base = `https://api.exchange.coinbase.com/products/${symbol}-USD`;
  // The ticker is the price; stats only adds the 24 h change, so its failure must not fail the price.
  const [tick, stats] = await Promise.all([
    getJson(`${base}/ticker`) as Promise<{ price?: string; time?: string; message?: string }>,
    withChange ? (getJson(`${base}/stats`) as Promise<{ open?: string; last?: string }>).catch(() => null) : Promise.resolve(null),
  ]);
  const price = n(tick?.price);
  if (price == null) throw new Error(tick?.message ?? "no price");
  const open = n(stats?.open);
  const asOf = tick?.time && !Number.isNaN(Date.parse(tick.time)) ? new Date(tick.time).toISOString() : new Date().toISOString();
  return {
    symbol, price, asOf, kind: "crypto", ok: true, source: "Coinbase spot",
    changePct24h: open != null && open > 0 ? ((price - open) / open) * 100 : null,
  };
}

async function krakenSpot(symbol: string): Promise<LivePrice> {
  const data = (await getJson(`https://api.kraken.com/0/public/Ticker?pair=${symbol}USD`)) as {
    error?: string[]; result?: Record<string, { c?: string[]; o?: string }>;
  };
  if (data?.error?.length) throw new Error(data.error.join("; "));
  const first = data?.result ? Object.values(data.result)[0] : null;
  const price = n(first?.c?.[0]);
  if (price == null) throw new Error("no price");
  const open = n(first?.o);
  return {
    symbol, price, asOf: new Date().toISOString(), kind: "crypto", ok: true, source: "Kraken spot",
    changePct24h: open != null && open > 0 ? ((price - open) / open) * 100 : null,
  };
}

async function cryptoPrice(symbol: string, withChange: boolean): Promise<LivePrice> {
  try {
    return await coinbaseSpot(symbol, withChange);
  } catch (e1) {
    try {
      return await krakenSpot(symbol);
    } catch (e2) {
      return fail(symbol, "crypto", "Coinbase spot", `${(e1 as Error).message}; kraken: ${(e2 as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------- stocks / ETFs
async function yahooPrice(symbol: string): Promise<LivePrice> {
  try {
    const data = (await getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      { "accept-language": "en-US,en;q=0.9" },
    )) as { chart?: { result?: { meta?: Record<string, unknown> }[]; error?: { description?: string } | null } };
    if (data?.chart?.error) throw new Error(data.chart.error.description ?? "yahoo error");
    const meta = data?.chart?.result?.[0]?.meta ?? {};
    const price = n(meta.regularMarketPrice);
    if (price == null) throw new Error("no price");
    const prev = n(meta.chartPreviousClose) ?? n(meta.previousClose);
    const t = n(meta.regularMarketTime);
    return {
      symbol, price, kind: "stock", ok: true, source: "Yahoo Finance",
      asOf: t != null ? new Date(t * 1000).toISOString() : new Date().toISOString(),
      changePct24h: prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null,
    };
  } catch (e) {
    return fail(symbol, "stock", "Yahoo Finance", (e as Error).message);
  }
}

// ---------------------------------------------------------------- batch
async function mapLimited<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Live prices for a list of symbols, keyed by symbol. Never throws and never rejects: a symbol
 * that could not be fetched comes back with `ok: false` so the UI can fall back to the stored
 * value (and say so). `kind` defaults to crypto; pass "stock" for Robinhood symbols.
 */
export async function getLivePrices(symbols: string[], kind: PriceKind = "crypto", opts: { change?: boolean } = {}): Promise<PriceMap> {
  const list = normalizeSymbols(symbols);
  const out: PriceMap = {};
  if (!list.length) return out;
  // `change: false` skips the second (24 h stats) call per coin — for pages that list many coins without a change figure.
  const withChange = opts.change !== false;
  try {
    const rows = await mapLimited(list, CONCURRENCY, (s) => (kind === "stock" ? yahooPrice(s) : cryptoPrice(s, withChange)));
    for (const r of rows) out[r.symbol] = r;
  } catch (e) {
    for (const s of list) if (!out[s]) out[s] = fail(s, kind, kind === "stock" ? "Yahoo Finance" : "Coinbase spot", (e as Error).message);
  }
  return out;
}

/** Crypto and stock symbols in one call (two parallel batches). */
export async function getLivePricesMixed(crypto: string[], stocks: string[], opts: { change?: boolean } = {}): Promise<PriceMap> {
  const [a, b] = await Promise.all([getLivePrices(crypto, "crypto", opts), getLivePrices(stocks, "stock", opts)]);
  return { ...a, ...b };
}

/** A stored decision price as a LivePrice-shaped fallback (ok:false, so the UI marks it stored). */
export function storedPrice(symbol: string, price: number | null | undefined, asOf: string | null | undefined, kind: PriceKind = "crypto", source = "desk check"): LivePrice {
  const p = n(price);
  return { symbol, price: p, changePct24h: null, asOf: asOf ?? null, source, ok: false, kind };
}

/** The best price we have: the live one when it came back, else the stored one. */
export function bestPrice(live: LivePrice | null | undefined, stored: number | null | undefined): { price: number | null; live: boolean } {
  if (live?.ok && live.price != null) return { price: live.price, live: true };
  const s = n(stored);
  return { price: s, live: false };
}
