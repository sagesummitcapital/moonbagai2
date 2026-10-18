// FAST INPUTS (Stavros, 2026-10-15: "grok needs to be ready to give fast inputs ... if i give entry, long or short, and my
// stop loss, grok should kick back the best setup for that trade"). One call: coin + side + entry + stop → targets from the
// recorded levels (TP1 = the Woods first pop: first level ≥ 1R, placed just in front of it, 70%; aim 2:1, no minimum — flagged under 2R), size, leverage, margin, liquidation, risk — the same
// sizing rules as every other card. Analysis only; Stavros places the order.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildLevels } from "./levels";
import { getSizingContext, limitInputs, type LimitOrder } from "./limits";
import { anchorState, getWoodsLevels } from "./woods";

const MIN_STOP: Record<string, number> = { BTC: 0.008, ETH: 0.008 };
const MMR = 0.005; // BloFin maintenance margin, rough — BloFin's own liquidation price is the one to trust
const fp = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: v >= 1 ? 2 : 4, maximumFractionDigits: v >= 1 ? 2 : 4 });

export type QuickIn = { coin: string; side: "long" | "short"; entry: number; stop: number; grade?: string | null; margin?: "isolated" | "cross" };

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

/**
 * FAST INPUTS WITH NO NUMBERS (Stavros, 2026-10-18: "i just asked grok about a long on btc and it gave me an 82k price ... i need grok to
 * give me fast inputs for trades - price was at 80.9 and climbing"). Entry = the LIVE price (market); stop = just past the nearest recorded
 * structure on the wrong side (+ ½ × 1h ATR), never tighter than the coin minimum or 1.5 × 1h ATR; then the normal card (secure 2R).
 */
export async function quickLive(coin: string, side: "long" | "short", margin: "isolated" | "cross" = "cross", grade?: string | null) {
  const c = coin.toUpperCase().replace(/USDT.*$/, "");
  const sg = side === "long" ? 1 : -1;
  const lp = await livePrice(c);
  if (!lp) return { ok: false as const, text: `NO TRADE — no live price for ${c}.` };
  const px = lp.price;
  const db = supabaseAdmin();
  const bars = await db.from("candles").select("h, l, c, ts").eq("asset", c).eq("tf", "1h").order("ts", { ascending: false }).limit(15)
    .then((r: { data: unknown }) => (r.data as { h: number; l: number; c: number }[] | null) ?? [], () => []);
  let atr = 0;
  for (let i = 0; i < bars.length - 1; i++) atr += Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i + 1].c), Math.abs(bars[i].l - bars[i + 1].c));
  atr = bars.length > 1 ? atr / (bars.length - 1) : px * 0.004;
  const minStop = MIN_STOP[c] ?? 0.015;
  const minDist = Math.max(minStop * px, 1.5 * atr);
  const lv = await buildLevels().catch(() => null);
  const cl = lv?.coins.find((x) => x.asset === c);
  const structure = (side === "long" ? [...(cl?.support ?? []), cl?.rangeLow] : [...(cl?.resistance ?? []), cl?.rangeHigh])
    .filter((x): x is number => x != null && sg * (px - x) > 0)
    .sort((a, b) => sg * (b - a));
  const lvl = structure.find((x) => sg * (px - (x - sg * 0.5 * atr)) >= minDist);
  let stop = lvl != null ? lvl - sg * 0.5 * atr : px - sg * minDist;
  if (sg * (px - stop) < minDist) stop = px - sg * minDist;
  const card = await quickInputs({ coin: c, side, entry: px, stop, grade, margin });
  if (!card.ok) return card;
  const when = new Date(lp.at).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", second: "2-digit" });
  const head = `LIVE ${c} ${fp(px)} (${lp.source}, ${when} Phoenix) — entry at market now. Stop ${fp(stop)} = ${lvl != null ? `just past the ${fp(lvl)} level` : "the minimum distance (no level close enough)"} + ½ × 1h ATR.`;
  return { ...card, text: `${head}\n${card.text}`, entry: px, stop, live: lp };
}

export async function quickInputs(q: QuickIn) {
  const coin = q.coin.toUpperCase().replace(/USDT.*$/, "");
  const sg = q.side === "long" ? 1 : -1;
  if (!(q.entry > 0) || !(q.stop > 0) || sg * (q.entry - q.stop) <= 0) {
    return { ok: false as const, text: `NO TRADE — the stop must be ${q.side === "long" ? "below" : "above"} the entry.` };
  }
  const [ctx, lv, wl] = await Promise.all([getSizingContext(), buildLevels().catch(() => null), getWoodsLevels().catch(() => [])]);
  if (!ctx) return { ok: false as const, text: "NO TRADE — no BloFin balance on record. Post it first (POST /accounts)." };
  const risk = Math.abs(q.entry - q.stop);
  const stopPct = (risk / q.entry) * 100;
  const notes: string[] = [];
  const minStop = MIN_STOP[coin] ?? 0.015;
  if (risk / q.entry < minStop) notes.push(`stop ${stopPct.toFixed(2)}% is tighter than our ${(minStop * 100).toFixed(1)}% minimum for ${coin} — tight stops get wicked; consider ${fp(q.entry - sg * minStop * q.entry)}`);

  // Targets: the recorded levels for this coin, first one ≥ 2R (placed just in front), then the next.
  const c = lv?.coins.find((x) => x.asset === coin);
  const raw = c ? (q.side === "long" ? [...c.resistance, c.rangeHigh] : [...c.support, c.rangeLow]) : [];
  const levels = raw.filter((x): x is number => x != null && sg * (x - q.entry) > 0).sort((a, b) => sg * (a - b));
  const front = (x: number) => x - sg * Math.min(risk * 0.1, x * 0.0005);
  let tp1: number | null = null, tp2: number | null = null, src = "2R / 3R (no recorded level far enough)";
  // SECURE 2R (Stavros 2026-10-18: "lets always try to secure 2r minimum on moonbag trades even if you think there is a 4+r opportunity"):
  // TP1 = exactly 2R (70% off, stop to entry) when the first level is 2R+ away — that level becomes the runner (TP2);
  // when a level sits before 2R, TP1 = that level (flagged), TP2 = the next level at least 3R away.
  const first = levels.find((x) => Math.abs(front(x) - q.entry) >= 1 * risk);
  if (first != null && Math.abs(front(first) - q.entry) >= 2 * risk) {
    tp1 = q.entry + sg * 2 * risk;
    const runner = levels.find((x) => Math.abs(front(x) - q.entry) >= 3 * risk);
    tp2 = runner != null ? front(runner) : Math.abs(front(first) - q.entry) > 2 * risk ? front(first) : q.entry + sg * 3 * risk;
    src = "TP1 secured at 2R; runner at the recorded level";
  } else if (first != null) {
    tp1 = front(first);
    const nxt = levels.find((x) => Math.abs(front(x) - q.entry) >= Math.max(3 * risk, Math.abs(tp1! - q.entry) * 1.5));
    tp2 = nxt != null ? front(nxt) : q.entry + sg * Math.max(3 * risk, Math.abs(tp1 - q.entry) * 1.5);
    src = "recorded levels (a level sits before 2R)";
  } else {
    if (levels.length) notes.push(`nearest level ${fp(levels[0])} is only ${(Math.abs(levels[0] - q.entry) / risk).toFixed(1)}R away — expect a reaction there`);
    tp1 = q.entry + sg * 2 * risk; tp2 = q.entry + sg * 3 * risk;
    src = "2R secure / 3R runner (no recorded level far enough)";
  }

  const order = {
    limit_id: "quick", symbol: coin, direction: q.side, limit_price: q.entry, stop: q.stop, current_stop: q.stop,
    tp1, tp2, grade: q.grade ?? "B", level: null, level_kind: null, expires_at: null, quantity: null,
  } as unknown as LimitOrder;
  const inp = limitInputs(order, ctx, { split: 0.7 });
  if (!inp) return { ok: false as const, text: "NO TRADE — couldn't size it." };

  const maxSafeLev = Math.max(1, Math.floor(1 / (1.25 * (risk / q.entry) + MMR)));
  // Woods checks: BTC anchor (rule 1), no-man's land (rule 4), hedge (rule 10).
  const btc = lv?.coins.find((x) => x.asset === "BTC");
  const anc = anchorState(btc?.price ?? (coin === "BTC" ? q.entry : null), wl);
  const woods: string[] = [];
  if (anc.state !== "unknown") woods.push(`Anchor: ${anc.text}`);
  if (coin !== "BTC" && q.side === "long" && anc.state === "below") woods.push("Woods rule 1: NO alt long while BTC is below its reclaim level — skip it or wait.");
  if (c?.rangeLow != null && c?.rangeHigh != null && c.rangeHigh > c.rangeLow) {
    const pos = (q.entry - c.rangeLow) / (c.rangeHigh - c.rangeLow);
    if (pos > 0.35 && pos < 0.65) woods.push(`No-man's land: entry is mid-range (${fp(c.rangeLow)}–${fp(c.rangeHigh)}) — trade the edge or the break.`);
  }
  if (coin === "BTC" && q.side === "long" && anc.state !== "above") woods.push("Hedge (rule 10): BTC long not confirmed above the line — consider an ETH short of about half this size, stop above ETH's last 1H swing high; close it on 4H acceptance above the line.");
  const rr1 = Math.abs((tp1 ?? 0) - q.entry) / risk;
  if (rr1 < 1.99) notes.push(`a level sits at ${rr1.toFixed(1)}R — under your 2:1 aim (your call)`);
  // Data stamp (Stavros 2026-10-16: "make sure i always know the time of this data, if i use bad data its a bad trade").
  const feed = await supabaseAdmin().from("data_feed").select("last_bar, ok").eq("feed", "blofin").eq("asset", coin).eq("tf", "15m").maybeSingle().then((r: { data: unknown }) => r.data as { last_bar: string | null; ok: boolean } | null, () => null);
  const barClose = feed?.last_bar ? Date.parse(feed.last_bar) + 15 * 60_000 : null;
  const ageMin = barClose ? Math.round((Date.now() - barClose) / 60_000) : null;
  const stamp = barClose
    ? `Data: BloFin bars to ${new Date(barClose).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" })} Phoenix (${ageMin}m ago)${ageMin != null && ageMin > 45 ? " — STALE, check the live price before you place it" : ""}`
    : "Data: no BloFin feed time on record — check the live price before you place it";
  const lines = [
    stamp,
    `Bias: ${q.side} — your call${c?.bias ? ` (desk 1h bias ${String(c.bias).toUpperCase()})` : ""}`,
    `Entering when: ${fp(q.entry)} (market or limit)`,
    `Wrong if: price trades through ${fp(q.stop)} (${stopPct.toFixed(2)}%)`,
    `${coin} ${q.side === "long" ? "Long" : "Short"} · Entry ${fp(q.entry)} · SL ${fp(q.stop)} · TP1 ${fp(tp1!)} (${rr1.toFixed(1)}R, ${inp.qtyTp1}) · TP2 ${fp(tp2!)} (${inp.qtyTp2})`,
    `Size ${inp.qty} ${coin} (≈ $${inp.notional.toFixed(2)}) · Leverage ${inp.leverage}x ${q.margin ?? "cross"} (max safe ${Math.min(maxSafeLev, 150)}x for this stop) · Margin $${inp.margin.toFixed(2)} · Risk $${inp.riskUsd.toFixed(2)} (${inp.riskPct}% of $${ctx.equity.toFixed(2)}) · Liq ≈ ${fp(inp.liq)}`,
    `Manage: take 70% at TP1 (secure 2R), stop to entry, let 30% run to TP2. Targets: ${src}.`,
    ...woods,
    ...(q.margin !== "isolated" ? ["Cross margin (house rule): the whole balance backs this trade — the stop MUST be on the exchange at entry."] : []),
    ...([...notes, ...inp.notes].length ? [`Note: ${[...notes, ...inp.notes].join(" · ")}`] : []),
  ];
  return { ok: true as const, text: lines.join("\n"), coin, tp1, tp2, rr1, inputs: inp, maxSafeLev };
}
