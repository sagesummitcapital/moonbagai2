// FAST INPUTS (Stavros, 2026-10-15: "grok needs to be ready to give fast inputs ... if i give entry, long or short, and my
// stop loss, grok should kick back the best setup for that trade"). One call: coin + side + entry + stop → targets from the
// recorded levels (TP1 = the Woods first pop: first level ≥ 1R, placed just in front of it, 70%; aim 2:1, no minimum — flagged under 2R), size, leverage, margin, liquidation, risk — the same
// sizing rules as every other card. Analysis only; Stavros places the order.
import { buildLevels } from "./levels";
import { getSizingContext, limitInputs, type LimitOrder } from "./limits";
import { anchorState, getWoodsLevels } from "./woods";

const MIN_STOP: Record<string, number> = { BTC: 0.008, ETH: 0.008 };
const MMR = 0.005; // BloFin maintenance margin, rough — BloFin's own liquidation price is the one to trust
const fp = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: v >= 1 ? 2 : 4, maximumFractionDigits: v >= 1 ? 2 : 4 });

export type QuickIn = { coin: string; side: "long" | "short"; entry: number; stop: number; grade?: string | null; margin?: "isolated" | "cross" };

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
  // Woods rule 9: take MOST off at the first pop, stop to break-even, let the rest run.
  // TP1 = the first recorded level at least 1R away (the "first pop"), 70% of the size; TP2 = the next level at least 3R away.
  const ok1 = levels.filter((x) => Math.abs(front(x) - q.entry) >= 1 * risk);
  if (ok1.length) {
    tp1 = front(ok1[0]);
    const nxt = levels.filter((x) => Math.abs(front(x) - q.entry) >= Math.max(3 * risk, Math.abs(tp1! - q.entry) * 1.5));
    tp2 = nxt.length ? front(nxt[0]) : q.entry + sg * Math.max(3 * risk, Math.abs(tp1 - q.entry) * 1.5);
    src = "recorded levels";
  } else {
    if (levels.length) notes.push(`nearest level ${fp(levels[0])} is only ${(Math.abs(levels[0] - q.entry) / risk).toFixed(1)}R away — expect a reaction there`);
    tp1 = q.entry + sg * 1 * risk; tp2 = q.entry + sg * 3 * risk;
    src = "1R first pop / 3R runner (no recorded level far enough)";
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
  if (rr1 < 2) notes.push(`first pop is ${rr1.toFixed(1)}R — under your 2:1 aim (no minimum; your call)`);
  const lines = [
    `Bias: ${q.side} — your call${c?.bias ? ` (desk 1h bias ${String(c.bias).toUpperCase()})` : ""}`,
    `Entering when: ${fp(q.entry)} (market or limit)`,
    `Wrong if: price trades through ${fp(q.stop)} (${stopPct.toFixed(2)}%)`,
    `${coin} ${q.side === "long" ? "Long" : "Short"} · Entry ${fp(q.entry)} · SL ${fp(q.stop)} · TP1 ${fp(tp1!)} (${rr1.toFixed(1)}R, ${inp.qtyTp1}) · TP2 ${fp(tp2!)} (${inp.qtyTp2})`,
    `Size ${inp.qty} ${coin} (≈ $${inp.notional.toFixed(2)}) · Leverage ${inp.leverage}x ${q.margin ?? "cross"} (max safe ${Math.min(maxSafeLev, 150)}x for this stop) · Margin $${inp.margin.toFixed(2)} · Risk $${inp.riskUsd.toFixed(2)} (${inp.riskPct}% of $${ctx.equity.toFixed(2)}) · Liq ≈ ${fp(inp.liq)}`,
    `Manage (Woods): take 70% at TP1 (the first pop), stop to entry, let 30% run to TP2. Targets from ${src}.`,
    ...woods,
    ...(q.margin !== "isolated" ? ["Cross margin (house rule): the whole balance backs this trade — the stop MUST be on the exchange at entry."] : []),
    ...([...notes, ...inp.notes].length ? [`Note: ${[...notes, ...inp.notes].join(" · ")}`] : []),
  ];
  return { ok: true as const, text: lines.join("\n"), coin, tp1, tp2, rr1, inputs: inp, maxSafeLev };
}
