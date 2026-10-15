// Live prices for the dashboard's polling components.
// Lives under /dashboard so the Clerk middleware (middleware.ts) already requires a signed-in user;
// the owner allow-list is checked here too, like the dashboard layout does.
//   GET /dashboard/api/prices?symbols=BTC,ETH,SOL            (crypto — Coinbase spot, Kraken fallback)
//   GET /dashboard/api/prices?symbols=SPY,TSLA&kind=stock    (stocks/ETFs — Yahoo Finance)
//   &lite=1 skips the 24 h change figure (half the upstream calls for crypto).
import { NextResponse } from "next/server";
import { getOwnerAccess } from "@/lib/auth/owner";
import { clearPriceMemo, getLivePrices, MAX_SYMBOLS, normalizeSymbols, type PriceKind } from "@/lib/moonbag/prices";

export const dynamic = "force-dynamic";

let lastFresh = 0;

export async function GET(req: Request) {
  const access = await getOwnerAccess();
  if (!access.allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const raw = (url.searchParams.get("symbols") ?? "").split(",");
  const symbols = normalizeSymbols(raw);
  const kind: PriceKind = url.searchParams.get("kind") === "stock" ? "stock" : "crypto";
  if (!symbols.length) return NextResponse.json({ ok: false, error: `symbols required (1–${MAX_SYMBOLS}, A–Z 0–9 . -)` }, { status: 400 });

  // &fresh=1 comes from the Refresh button: drop this instance's hourly memo (at most every 20 s).
  if (url.searchParams.get("fresh") === "1" && Date.now() - lastFresh > 20_000) {
    lastFresh = Date.now();
    clearPriceMemo();
  }
  const lite = url.searchParams.get("lite") === "1"; // skip the 24 h change (one call per coin instead of two)
  const prices = await getLivePrices(symbols, kind, { change: !lite });
  return NextResponse.json(
    { ok: true, kind, fetched_at: new Date().toISOString(), prices },
    { headers: { "cache-control": "private, no-store" } },
  );
}
