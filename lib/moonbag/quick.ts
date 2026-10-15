// FAST INPUTS (Stavros, 2026-10-15: "grok needs to be ready to give fast inputs ... if i give entry, long or short, and my
// stop loss, grok should kick back the best setup for that trade"). One call: coin + side + entry + stop → targets from the
// recorded levels (TP1 the first level ≥ 2R, placed just in front of it), size, leverage, margin, liquidation, risk — the same
// sizing rules as every other card. Analysis only; Stavros places the order.
import { buildLevels } from "./levels";
import { getSizingContext, limitInputs, type LimitOrder } from "./limits";

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
  const [ctx, lv] = await Promise.all([getSizingContext(), buildLevels().catch(() => null)]);
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
  const ok2 = levels.filter((x) => Math.abs(front(x) - q.entry) >= 2 * risk);
  if (ok2.length) {
    tp1 = front(ok2[0]); tp2 = ok2[1] != null ? front(ok2[1]) : q.entry + sg * Math.max(3 * risk, Math.abs(tp1 - q.entry) * 1.5);
    src = "recorded levels";
  } else {
    if (levels.length) notes.push(`nearest level ${fp(levels[0])} is only ${(Math.abs(levels[0] - q.entry) / risk).toFixed(1)}R away — TP1 set at 2R instead; expect resistance there`);
    tp1 = q.entry + sg * 2 * risk; tp2 = q.entry + sg * 3 * risk;
  }

  const order = {
    limit_id: "quick", symbol: coin, direction: q.side, limit_price: q.entry, stop: q.stop, current_stop: q.stop,
    tp1, tp2, grade: q.grade ?? "B", level: null, level_kind: null, expires_at: null, quantity: null,
  } as unknown as LimitOrder;
  const inp = limitInputs(order, ctx);
  if (!inp) return { ok: false as const, text: "NO TRADE — couldn't size it." };

  const maxSafeLev = Math.max(1, Math.floor(1 / (1.25 * (risk / q.entry) + MMR)));
  const rr1 = Math.abs((tp1 ?? 0) - q.entry) / risk;
  const lines = [
    `Bias: ${q.side} — your call${c?.bias ? ` (desk 1h bias ${String(c.bias).toUpperCase()})` : ""}`,
    `Entering when: ${fp(q.entry)} (market or limit)`,
    `Wrong if: price trades through ${fp(q.stop)} (${stopPct.toFixed(2)}%)`,
    `${coin} ${q.side === "long" ? "Long" : "Short"} · Entry ${fp(q.entry)} · SL ${fp(q.stop)} · TP1 ${fp(tp1!)} (${rr1.toFixed(1)}R, ${inp.qtyTp1}) · TP2 ${fp(tp2!)} (${inp.qtyTp2})`,
    `Size ${inp.qty} ${coin} (≈ $${inp.notional.toFixed(2)}) · Leverage ${inp.leverage}x ${q.margin ?? "isolated"} (max safe ${Math.min(maxSafeLev, 100)}x for this stop) · Margin $${inp.margin.toFixed(2)} · Risk $${inp.riskUsd.toFixed(2)} (${inp.riskPct}% of $${ctx.equity.toFixed(2)}) · Liq ≈ ${fp(inp.liq)}`,
    `Manage: TP1 hit → stop to entry. Targets from ${src}.`,
    ...(q.margin === "cross" ? ["Cross margin: the whole balance backs this trade — the stop MUST be on the exchange before you walk away."] : []),
    ...([...notes, ...inp.notes].length ? [`Note: ${[...notes, ...inp.notes].join(" · ")}`] : []),
  ];
  return { ok: true as const, text: lines.join("\n"), coin, tp1, tp2, rr1, inputs: inp, maxSafeLev };
}
