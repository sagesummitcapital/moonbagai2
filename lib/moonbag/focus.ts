// FOCUS BRIEF (Stavros, 2026-10-21: "i want to be able to have grok refresh data so we have live prices and then give me a short
// brief on what to look at. come up with a daily (or at request) brief that ties to strat and what im looking at, with setups and
// limits etc. a way to spend my attention in a way that is maximally efficient").
// One call: refresh the data if it is older than 10 minutes, take LIVE BloFin prices, then rank what deserves his attention:
// 1) his open trades, 2) his limits (cancel / about to fill), 3) Moonbag A+/A setups he can act on, 4) what would change the plan,
// 5) admin that needs him. Fixed template, built only from the database + live prices. Analysis only — he places every order.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { livePrice } from "./livePrice";
import { getLiquidity, liquidityNotes } from "./liquidity";
import { calcEquity } from "./equity";

type Px = { price: number; source: string; at: number } | null;
const fp = (v: number | null | undefined) =>
  v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: Number(v) >= 1000 ? 0 : Number(v) >= 1 ? 2 : 4 });
const pctAway = (from: number, to: number) => ((to - from) / from) * 100;
const phx = (t: number | string) => new Date(t).toLocaleString("en-US", { timeZone: "America/Phoenix", weekday: "short", hour: "numeric", minute: "2-digit" });
const NEAR_PCT = (c: string) => (c === "BTC" || c === "ETH" ? 0.6 : 1.2); // same approach band as the A+ NEAR alert

export async function buildFocus(opts: { refresh?: boolean } = {}) {
  const db = supabaseAdmin();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

  // 0) REFRESH — candles + Woods machine if older than 10 min (≈1.5 s); never blocks the brief for more than 6 s.
  let refresh: Record<string, unknown> | null = null;
  if (opts.refresh !== false) {
    refresh = await Promise.race([
      db.rpc("focus_refresh", { p_force: false }).then((r: { data: unknown }) => r.data as Record<string, unknown>, () => null),
      new Promise<null>((res) => setTimeout(() => res(null), 6000)),
    ]);
  }

  const [trades, limits, woods, uni, econ, plan, crs, calc] = await Promise.all([
    db.from("trades").select("trade_id, symbol, direction, entry, stop, current_stop, tp1, current_tp1, tp2, current_tp2, qty_open, quantity, opened_at").eq("venue", "blofin").eq("status", "open"),
    db.from("limit_orders").select("*").in("status", ["working", "touched"]).order("created_at", { ascending: false }).limit(60),
    db.from("woods_machine").select("coin, side, as_of, grade, confidence, trigger, blocked, anchor"),
    db.from("lev_universe").select("asset, tier, rank, in_play").eq("tier", "rotation").gte("rank", 1).lte("rank", 5),
    db.from("econ_days").select("red, events").eq("day", today).maybeSingle(),
    db.from("lev_open_plan").select("plan_date, market_bias, confidence, headline, no_trade_if").eq("plan_date", today).maybeSingle(),
    db.from("strategy_changes").select("change_id, change").eq("status", "proposed").order("change_id"),
    calcEquity("blofin"),
  ]);

  type T = { trade_id: string; symbol: string; direction: "long" | "short"; entry: number; stop: number | null; current_stop: number | null; tp1: number | null; current_tp1: number | null; tp2: number | null; current_tp2: number | null; qty_open: number | null; quantity: number | null; opened_at: string | null };
  type L = { limit_id: string; symbol: string; direction: "long" | "short"; origin: string; status: string; grade: string | null; setup_id: string | null; limit_price: number; stop: number | null; current_stop: number | null; tp1: number | null; tp2: number | null; plan_r: number | null; expires_at: string | null; invalid_if?: string | null; invalid_price?: number | null; invalid_btc?: number | null; invalid_by?: string | null; created_at: string };
  type W = { coin: string; side: string; as_of: string; grade: string | null; confidence: number | null; trigger: boolean; blocked: string | null; anchor: { line_low?: number; line_high?: number; state?: string; text?: string; context?: { state?: string; text?: string } } | null };
  const open = (trades.data ?? []) as T[];
  const lims = (limits.data ?? []) as L[];
  const mine = lims.filter((l) => l.origin !== "paper");
  const rotation = ((uni.data ?? []) as { asset: string }[]).map((u) => u.asset);
  const watchCoins = new Set(["BTC", "ETH", "SOL", ...rotation]);
  const setups = lims.filter((l) => l.origin === "paper" && (l.grade === "A+" || l.grade === "A") && watchCoins.has(l.symbol));
  const wm = (woods.data ?? []) as W[];
  const btcRow = wm.find((w) => w.coin === "BTC");
  const woodsAt = wm.map((w) => w.as_of).sort().reverse()[0] ?? null;

  // LIVE prices for every coin in the brief
  const coins = [...new Set(["BTC", "ETH", "SOL", ...open.map((t) => t.symbol), ...mine.map((l) => l.symbol), ...setups.map((s) => s.symbol)])];
  const px = new Map<string, Px>(await Promise.all(coins.map(async (c) => [c, await livePrice(c).catch(() => null)] as const)));
  const p = (c: string) => px.get(c)?.price ?? null;
  const btc = p("BTC");

  const L: string[] = [];
  const now = Date.now();
  L.push(`MOONBAG FOCUS · ${phx(now)} Phoenix · live BloFin`);
  L.push(`BTC ${fp(btc)} · ETH ${fp(p("ETH"))} · SOL ${fp(p("SOL"))}${woodsAt ? ` · Woods map ${Math.round((now - Date.parse(woodsAt)) / 60000)} min old${refresh && (refresh as { refreshed?: boolean }).refreshed ? " (just refreshed)" : ""}` : ""}`);

  // Market frame: Woods anchor on the LIVE BTC price + context + today's plan
  const a = btcRow?.anchor ?? null;
  if (a?.line_low != null && a?.line_high != null && btc != null) {
    const st = btc > a.line_high ? "ABOVE" : btc < a.line_low ? "BELOW" : "INSIDE";
    L.push(`Frame: BTC ${st} Woods's line ${fp(a.line_low)}–${fp(a.line_high)} — ${st === "ABOVE" ? "longs favoured on 4H acceptance" : st === "BELOW" ? "below the line — alt longs are lower quality (a warning, not a block — CR-9); each setup still needs its own trigger" : "chop zone: trade the edges, not the middle"}${a.context?.state ? ` · market ${a.context.state}` : ""}`);
  }
  const pl = plan.data as { market_bias: string | null; confidence: number | null; headline: string | null; no_trade_if: string | null } | null;
  if (pl) L.push(`Today's plan: ${(pl.market_bias ?? "neutral").toUpperCase()}${pl.confidence != null ? ` ${pl.confidence}%` : ""} — ${pl.headline ?? ""}`);
  const ev = econ.data as { red: boolean; events: string | null } | null;
  if (ev?.red) L.push(`RED-FOLDER DAY (${ev.events ?? "CPI/FOMC/NFP"}): A+ only at full risk; no entry within 2h of the release.`);

  // 1) OPEN TRADES — always first
  const act: string[] = [];
  if (open.length) {
    L.push("");
    L.push("1 · YOUR OPEN TRADES");
    for (const t of open) {
      const c = p(t.symbol); const sg = t.direction === "long" ? 1 : -1;
      const st = Number(t.current_stop ?? t.stop); const risk = Math.abs(t.entry - Number(t.stop ?? st));
      const r = c != null && risk ? (sg * (c - t.entry)) / risk : null;
      const tp = t.current_tp1 ?? t.tp1;
      L.push(`  ${t.symbol} ${t.direction} @ ${fp(t.entry)} · now ${fp(c)}${r != null ? ` (${r >= 0 ? "+" : ""}${r.toFixed(2)}R)` : ""} · stop ${fp(st)}${c != null ? ` (${Math.abs(pctAway(c, st)).toFixed(2)}% away)` : ""}${tp != null ? ` · TP1 ${fp(tp)}` : ""}`);
      if (c != null && Number.isFinite(st) && sg * (c - st) <= 0) act.push(`${t.symbol}: price ${fp(c)} is through your stop ${fp(st)} — you're probably stopped out on BloFin; check it and tell Grok.`);
      else if (r != null && r >= 2 && tp != null && Math.abs(Number(tp) - t.entry) / risk > 2.05) act.push(`${t.symbol}: at +${r.toFixed(1)}R — secure 2R (70% off, stop to entry).`);
      else if (r != null && r >= 1 && Math.abs(st - t.entry) / t.entry > 0.0005 && sg * (st - t.entry) < 0) act.push(`${t.symbol}: +${r.toFixed(1)}R — consider stop to breakeven.`);
    }
  }

  // 2) HIS LIMITS — cancel or about to fill
  if (mine.length) {
    L.push("");
    L.push(`${open.length ? "2" : "1"} · YOUR LIMITS`);
    for (const l of mine) {
      const c = p(l.symbol); const away = c != null ? pctAway(c, l.limit_price) : null;
      const sg = l.direction === "long" ? 1 : -1;
      let flag = "";
      if (c != null && l.invalid_price != null && sg * (c - l.invalid_price) >= 0) { flag = " — CANCEL: price reached the cancel level"; act.push(`${l.symbol} ${l.direction === "long" ? "BUY" : "SELL"} ${fp(l.limit_price)}: CANCEL it — price reached ${fp(l.invalid_price)} without filling.`); }
      else if (btc != null && l.invalid_btc != null && l.symbol !== "BTC" && (l.direction === "short" ? btc > l.invalid_btc : btc < l.invalid_btc)) { flag = ` — BTC ${l.direction === "short" ? "above" : "below"} ${fp(l.invalid_btc)}: cancel if the 4H closes there`; act.push(`${l.symbol} limit: BTC is ${l.direction === "short" ? "above" : "below"} its cancel line ${fp(l.invalid_btc)} — cancel on a 4H close.`); }
      else if (l.invalid_by && Date.parse(l.invalid_by) < now) { flag = " — 48h up: cancel or renew"; act.push(`${l.symbol} limit ${fp(l.limit_price)}: 48h without a fill — cancel or tell Grok to keep it.`); }
      else if (away != null && Math.abs(away) <= NEAR_PCT(l.symbol)) flag = " — CLOSE: could fill soon, be ready";
      L.push(`  ${l.symbol} ${l.direction === "long" ? "BUY" : "SELL"} ${fp(l.limit_price)} · now ${fp(c)}${away != null ? ` (${Math.abs(away).toFixed(2)}% away)` : ""} · SL ${fp(l.current_stop ?? l.stop)} · TP1 ${fp(l.tp1)}${flag}`);
    }
  }

  // 3) MOONBAG SETUPS — A+/A on BTC/ETH/SOL + rotation top 5, nearest first; one per coin+side
  const seen = new Set<string>();
  const ranked = setups
    .map((s) => ({ s, c: p(s.symbol), away: p(s.symbol) != null ? Math.abs(pctAway(p(s.symbol)!, s.limit_price)) : 99 }))
    .filter((x) => { const k = `${x.s.symbol}-${x.s.direction}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter((x) => !mine.some((m) => m.symbol === x.s.symbol && m.direction === x.s.direction))
    .sort((a1, b1) => (a1.s.grade === "A+" ? 0 : 1) - (b1.s.grade === "A+" ? 0 : 1) || a1.away - b1.away)
    .slice(0, 3);
  L.push("");
  const n3 = 1 + (open.length ? 1 : 0) + (mine.length ? 1 : 0);
  L.push(`${n3} · SETUPS WORTH A LIMIT (Moonbag, A+/A)`);
  if (!ranked.length) L.push("  None right now — no A+/A limit on BTC/ETH/SOL or the top-5 rotation.");
  for (const { s, c, away } of ranked) {
    const liq = await getLiquidity(s.symbol).catch(() => null);
    const notes = liquidityNotes(liq, s.direction, s.limit_price, Number(s.current_stop ?? s.stop), s.tp1).filter((x) => x.startsWith("LIQ✓") || x.startsWith("Stop"));
    const near = away <= NEAR_PCT(s.symbol);
    const blocked = wm.find((w) => w.coin === s.symbol && w.side === s.direction)?.blocked;
    L.push(`  ${s.grade} ${s.symbol} ${s.direction === "long" ? "BUY" : "SELL"} LIMIT ${fp(s.limit_price)} · SL ${fp(s.current_stop ?? s.stop)} · TP1 ${fp(s.tp1)} (2R, 70%)${s.tp2 ? ` · TP2 ${fp(s.tp2)}` : ""} · ${c != null ? `${away.toFixed(2)}% away` : ""}${near ? " — SET IT NOW if you like it" : ""}${blocked ? ` · ⚠ ${blocked.replace(/BTC anchor: no alt longs below the line/, "BTC below the line: lower quality")}` : ""}${notes.length ? ` · ${notes[0].replace(/\s*—.*$/, "")}` : ""}`);
    if (near && !(blocked && !/BTC anchor/.test(blocked))) act.push(`${s.symbol}: A${s.grade === "A+" ? "+" : ""} ${s.direction} limit ${fp(s.limit_price)} is ${away.toFixed(2)}% away — set it now if you agree (inputs: GET /quick or moonbag.ai/dashboard/leverage).`);
  }

  // 4) WHAT CHANGES THE PLAN
  const chg: string[] = [];
  if (a?.line_high != null && btc != null && btc <= a.line_high) chg.push(`BTC 4H close above ${fp(a.line_high)} → shorts off, longs on`);
  if (a?.line_low != null && btc != null && btc >= a.line_low) chg.push(`BTC 4H close below ${fp(a.line_low)} → alt longs off`);
  if (pl?.no_trade_if) chg.push(`No trade if: ${pl.no_trade_if}`);
  if (chg.length) { L.push(""); L.push(`${n3 + 1} · WHAT CHANGES THE PLAN`); for (const x of chg) L.push(`  ${x}`); }

  // 5) ADMIN THAT NEEDS HIM
  const admin: string[] = [];
  if (calc?.needs_check) admin.push(`BloFin balance: send Grok your balance (last confirmed ${calc.days_since_confirmed.toFixed(0)}d ago).`);
  const prop = (crs.data ?? []) as { change_id: number; change: string }[];
  if (prop.length) admin.push(`Change requests waiting for your OK: ${prop.map((x) => (x.change.match(/CR-\d+/)?.[0] ?? `#${x.change_id}`)).join(", ")} (Strategy lab).`);
  if (admin.length) { L.push(""); L.push("ADMIN"); for (const x of admin) L.push(`  ${x}`); }

  // THE ANSWER: where his attention goes now
  L.push("");
  if (act.length) { L.push("DO NOW:"); for (const x of act.slice(0, 3)) L.push(`  ▸ ${x}`); }
  else L.push(`DO NOW: nothing needs you. ${ranked.length ? `Closest setup: ${ranked[0].s.symbol} ${ranked[0].s.direction} ${fp(ranked[0].s.limit_price)} (${ranked[0].away.toFixed(2)}% away) — TradingView pings you as it gets near.` : "Let the alerts work; check back after the next 4H close."}`);
  L.push("Analysis only — you place every order.");

  return { ok: true as const, text: L.join("\n"), generated_at: new Date(now).toISOString(), refresh, prices: Object.fromEntries([...px].map(([k, v]) => [k, v?.price ?? null])), actions: act };
}
