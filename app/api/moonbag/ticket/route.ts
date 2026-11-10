import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /ticket (CR-64) — the ONE notification format, for when Stavros asks Grok to "send me that as an alert".
 *   ?coin=INJ&side=long&entry=7.74&stop=7.51[&tp1=8.20][&tp2=8.30][&grade=A%2B][&setup=limit_sweep][&ref=MBL-…][&hours=24][&head=your+own+words]
 * Returns `text` (the alert message: limit, SL %, TP1 R, TP2, size at 0.5 / 1 / 2%, the strategy's record, validity) and `alert`:
 * the TradingView alert to create — name, symbol, condition and price — so every alert on his phone reads the same way.
 * It never creates the alert itself and never places an order.
 * GET /ticket?watchlist=1 → the TradingView watchlist layout (v_tv_watchlist): sections and symbols in order.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const db = supabaseAdmin();
  if (q.get("watchlist")) {
    const w = await db.from("v_tv_watchlist").select("sec, section, tv_symbol, pos").order("sec").order("pos");
    if (w.error) throw new BadRequest(w.error.message);
    const rows = (w.data ?? []) as { sec: number; section: string; tv_symbol: string; pos: number }[];
    const order = ["Open trades and live orders", "Core", "Rotation top 5", "My traded coins", "Market risk"];
    const symbols = order.flatMap((s) => [`###${s}`, ...rows.filter((r) => r.section === s).map((r) => r.tv_symbol)]);
    return json({ ok: true, watchlist_id: "348919123", symbols, rows });
  }
  const coin = (q.get("coin") ?? "").toUpperCase().replace(/[-/_ ]?(USDT|USDC|USD|PERP).*$/, "");
  const side = (q.get("side") ?? "").toLowerCase();
  const entry = Number(q.get("entry")), stop = Number(q.get("stop"));
  if (!coin || (side !== "long" && side !== "short")) throw new BadRequest('coin and side ("long" | "short") are required.');
  if (!(entry > 0) || !(stop > 0) || (side === "long" ? stop >= entry : stop <= entry)) throw new BadRequest(`entry and stop are required, with the stop ${side === "long" ? "below" : "above"} the entry.`);
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : null);
  const hours = Math.min(168, Math.max(1, Number(q.get("hours") ?? 24) || 24));
  const grade = q.get("grade");
  const r = await db.rpc("mb_ticket", {
    p_head: q.get("head") ?? null, p_coin: coin, p_side: side, p_grade: grade, p_entry: entry, p_stop: stop, p_tp1: num("tp1"), p_tp2: num("tp2"),
    p_setup: q.get("setup") ?? null, p_ref: q.get("ref") ?? null, p_expires: new Date(Date.now() + hours * 3600_000).toISOString(),
  });
  if (r.error) throw new BadRequest(r.error.message);
  const u = await db.from("lev_universe").select("tv_symbol").eq("asset", coin).maybeSingle();
  const d = coin === "BTC" || coin === "ETH" ? 0.006 : 0.012;
  return json({
    ok: true,
    text: r.data as string,
    alert: {
      // "MB ASK …" = an alert he asked for. The hourly sync and the cleanup job only manage MB NEAR / MB SETUP / MB LEVEL, so they leave it alone;
      // whoever creates it removes it when the idea is done.
      name: `MB ASK ${coin} ${side.toUpperCase()}`,
      tv_symbol: (u.data as { tv_symbol?: string } | null)?.tv_symbol ?? `BINANCE:${coin}USDT.P`,
      condition: side === "long" ? "cross_down" : "cross_up",
      price: side === "long" ? entry * (1 + d) : entry * (1 - d),
      note: "Fires when price comes within reach of the limit. Push notification on. Remove it when the idea is filled, cancelled or dead.",
    },
  });
});
