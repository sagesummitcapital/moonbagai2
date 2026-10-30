import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * MARKET FLOWS (CR-26, approved 2026-10-30). Daily flows Grok fetches: ETF net flow, spot/perp volume and taker delta, funding,
 * open interest, long/short ratios, RSI, liquidation clusters. DATA ONLY — no trading rule uses these until a backtest passes.
 * POST {"rows": [{date, coin, timeframe?, etf_net_flow_musd?, …, liq_above?, liq_below?, source?}, …]} → upsert by (date, timeframe, coin).
 * GET  ?coin=BTC&from=YYYY-MM-DD&to=YYYY-MM-DD → rows, newest first (max 400).
 */
const FIELDS = [
  "etf_net_flow_musd", "spot_qv_usd", "spot_taker_delta_usd", "perp_qv_usd", "perp_taker_delta_usd", "funding_sum", "oi_usd",
  "top_ls_accounts", "top_ls_positions", "global_ls_accounts", "perp_taker_buy_sell_ratio", "rsi14",
] as const;

export const POST = withAgent(["grok", "claude"], async (req) => {
  const body = await readJson(req);
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  if (!rows.length || rows.length > 500) throw new BadRequest("send 1–500 rows");
  const clean = rows.map((raw: unknown) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const date = String(r.date ?? "");
    const coin = String(r.coin ?? "").toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !coin) throw new BadRequest("each row needs date (YYYY-MM-DD) and coin");
    const o: Record<string, unknown> = { date, coin, timeframe: r.timeframe ? String(r.timeframe) : "1d", source: r.source ? String(r.source).slice(0, 200) : null, updated_at: new Date().toISOString() };
    for (const f of FIELDS) if (r[f] != null && r[f] !== "") { const v = Number(r[f]); if (Number.isFinite(v)) o[f] = v; }
    if (r.liq_above != null) o.liq_above = r.liq_above;
    if (r.liq_below != null) o.liq_below = r.liq_below;
    return o;
  });
  const up = await supabaseAdmin().from("market_flows").upsert(clean, { onConflict: "date,timeframe,coin" }).select("date, coin, timeframe");
  if (up.error) throw new BadRequest(up.error.message);
  return json({ ok: true, saved: up.data?.length ?? 0 }, 201);
});

export const GET = withAgent(["grok", "claude"], async (req) => {
  const q = new URL(req.url).searchParams;
  let s = supabaseAdmin().from("market_flows").select("*").order("date", { ascending: false }).limit(400);
  const coin = q.get("coin");
  if (coin) s = s.eq("coin", coin.toUpperCase());
  const from = q.get("from");
  if (from) s = s.gte("date", from);
  const to = q.get("to");
  if (to) s = s.lte("date", to);
  const r = await s;
  if (r.error) throw new BadRequest(r.error.message);
  return json({ ok: true, rows: r.data ?? [] });
});
