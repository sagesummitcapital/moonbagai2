// THE WOODS MACHINE — the top of the leverage desk (Stavros, 2026-10-16: "I love the woods map ... make it a machine.
// accuracy and r:r ... make sure i always know the time of this data, if i use bad data its a bad trade ... always have
// limits with confidence score that way i can throw them in if i agree" / "the copy trade button doesnt really work ...
// just show it but in a nice visually appealing way"). Display only: every number comes from public.woods_scan(), which
// runs every 15 minutes on Moonbag's own BloFin candles. Each ticket is laid out the way BloFin's order form asks for it.
import type { SizingContext } from "@/lib/moonbag/limits";
import { limitInputs, type LimitOrder } from "@/lib/moonbag/limits";
import { feedHealth, type WoodsMachine as WM, type WoodsRow } from "@/lib/moonbag/woodsMachine";
import { Badge, Card, ago, money, num, px2, whenShort } from "./ui";

const LEGS: [key: "a" | "b" | "c" | "d", label: string][] = [
  ["a", "Sweep"],
  ["b", "Close back"],
  ["c", "4H RSI div"],
  ["d", "1H trigger"],
];

const COMP_LABEL: Record<string, string> = { level: "level", anchor: "BTC anchor", rr: "R:R", rsi: "4H RSI", trend: "trend", record: "track record", macro: "Eliz macro", bias: "weekly bias", fib: "fib 0.75–0.786" };
const COMP_MAX: Record<string, number> = { level: 25, anchor: 20, rr: 20, rsi: 15, trend: 10, record: 10, macro: 10, bias: 10, fib: 10 };

function gradeTone(g: string | null) {
  return g === "A+" ? "green" : g === "A" ? "cyan" : g === "B" ? "amber" : "gray";
}

function Leg({ v, label }: { v: boolean | null | undefined; label: string }) {
  const cls = v === true ? "border-accent-green/40 bg-accent-green/10 text-accent-green" : v === false ? "border-white/10 bg-white/[0.03] text-white/40" : "border-white/[0.06] text-white/25";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${cls}`}>
      <span aria-hidden>{v === true ? "✓" : v === false ? "✗" : "·"}</span>
      {label}
    </span>
  );
}

function Field({ k, v, sub, cls = "text-white" }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/20 px-2.5 py-2">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className={`mt-0.5 break-words font-mono text-[15px] font-semibold leading-tight tabular-nums ${cls}`}>{v}</div>
      {sub && <div className="mt-0.5 font-mono text-[11px] tabular-nums text-white/45">{sub}</div>}
    </div>
  );
}

function Ticket({ r, sizing }: { r: WoodsRow; sizing: SizingContext | null }) {
  const lp = r.limit_plan;
  const long = r.side === "long";
  const order: LimitOrder | null = lp
    ? ({ limit_id: `woods-${r.coin}-${r.side}`, symbol: r.coin, direction: r.side, limit_price: lp.entry, stop: lp.stop, current_stop: lp.stop, tp1: lp.tp1, tp2: lp.tp2, plan_r: lp.rr1, grade: r.grade } as unknown as LimitOrder)
    : null;
  const inp = order && sizing ? limitInputs(order, sizing, { split: 0.7 }) : null;
  const conf = r.confidence ?? 0;
  const dim = !!r.blocked;
  return (
    <div className={`min-w-0 rounded-xl border p-3.5 ${r.trigger ? "border-accent-green/50 bg-accent-green/[0.06]" : dim ? "border-white/[0.06] bg-white/[0.015] opacity-70" : "border-white/[0.09] bg-white/[0.03]"}`}>
      {/* header: coin + side + grade + confidence */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <strong className="text-[16px] text-white">{r.coin}</strong>
          <span className={`text-[13px] font-semibold ${long ? "text-accent-green" : "text-rose-300"}`}>{long ? "▲ LONG" : "▼ SHORT"}</span>
          {r.trigger && <Badge tone="green" dot>WOODS TRIGGER</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={gradeTone(r.grade)}>{r.grade ?? "—"}</Badge>
          <span className="font-mono text-[13px] tabular-nums text-white/80">{conf}<span className="text-white/35">/100</span></span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className={`h-full rounded-full ${conf >= 75 ? "bg-accent-green" : conf >= 60 ? "bg-accent-cyan" : conf >= 45 ? "bg-amber-300" : "bg-white/30"}`} style={{ width: `${Math.max(4, Math.min(100, conf))}%` }} />
      </div>

      {/* the four Woods legs on the last closed bars */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {LEGS.map(([k, label]) => <Leg key={k} v={r.checklist?.[k]} label={label} />)}
      </div>
      {r.checklist?.pool && (
        <div className="mt-1.5 text-[12px] leading-snug text-white/55">
          Swept {r.checklist.pool}{r.checklist.wick != null ? ` · wick ${px2(r.checklist.wick)}` : ""}{r.checklist.bar ? ` · 4H bar ${whenShort(r.checklist.bar)}` : ""}
          {r.checklist.rsi_note ? <span className="block text-white/40">{r.checklist.rsi_note}</span> : null}
        </div>
      )}
      {(r.checklist?.fib_zone || r.checklist?.ema200 != null) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
          {r.checklist?.fib_zone && (
            <span className={`rounded-md px-1.5 py-0.5 ${r.checklist.fib_confluence ? "bg-accent-green/[0.1] text-accent-green" : "bg-white/[0.04] text-white/45"}`}>
              {r.checklist.fib_confluence ? "FIB ✓" : "fib"} {px2(r.checklist.fib_zone[0])}–{px2(r.checklist.fib_zone[1])}
            </span>
          )}
          {r.checklist?.combo_aligned && <span className="rounded-md bg-violet-400/[0.12] px-1.5 py-0.5 text-violet-200" title="Paper test only: 4H RSI divergence combo (BTC + TOTAL2 + TOTAL3) on this side">COMBO ✓ · paper</span>}
          {r.checklist?.ctx_aligned && <span className="rounded-md bg-accent-green/[0.1] px-1.5 py-0.5 text-accent-green" title="Paper test only: market context (USDT.D / TOTAL) on this side">CTX ✓ · paper</span>}
          {r.checklist?.ema200 != null && (
            <span className={`rounded-md px-1.5 py-0.5 ${r.checklist.ema200_confluence ? "bg-accent-cyan/[0.1] text-accent-cyan" : "bg-white/[0.04] text-white/45"}`} title="Paper test only: not in the score until the Saturday review proves it adds R">
              {r.checklist.ema200_confluence ? "EMA200 ✓" : "EMA200"} {px2(r.checklist.ema200)} · paper
            </span>
          )}
        </div>
      )}

      {/* the order, laid out like BloFin's form */}
      {lp ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Field k={long ? "Buy limit" : "Sell limit"} v={px2(lp.entry)} sub={`at ${lp.pool}`} />
            <Field k="Stop loss" v={px2(lp.stop)} sub={`${num(lp.stop_pct, 2)}% away`} cls="text-rose-300" />
            <Field k="TP1 · 70%" v={px2(lp.tp1)} sub={`${num(lp.rr1, 2)}R${lp.rr1 < 2 ? " · under 2:1 aim" : ""}`} cls="text-accent-green" />
            <Field k="TP2 · 30%" v={px2(lp.tp2)} sub={`${num(lp.rr2, 2)}R runner`} cls="text-accent-green" />
          </div>
          {inp ? (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <Field k="Size" v={`${inp.qty} ${r.coin}`} sub={`≈ ${money(inp.notional)}`} />
              <Field k="Leverage" v={`${inp.leverage}x`} sub={`max safe ${inp.ceiling}x`} />
              <Field k="Margin" v={money(inp.margin)} sub="cross · stop on exchange" />
              <Field k="Risk" v={money(inp.riskUsd)} sub={`${num(inp.riskPct, 2)}% of ${money(sizing?.equity)}`} cls="text-rose-300" />
              <Field k="Liq ≈" v={px2(inp.liq)} sub={inp.liqOk ? "beyond 1.25× stop" : "⚠ too close to stop"} cls={inp.liqOk ? "text-amber-200" : "text-rose-300"} />
            </div>
          ) : null}
          <div className="mt-2 text-[11.5px] leading-snug text-white/40">
            TP1 {px2(lp.tp1)}: take 70%, stop to break-even, runner to TP2.{inp ? ` TP1 qty ${inp.qtyTp1} · TP2 qty ${inp.qtyTp2}.` : ""} Fills only if price sweeps {lp.pool_note ?? lp.pool}.
          </div>
        </>
      ) : null}
      {r.blocked && <div className="mt-2 rounded-md bg-amber-300/[0.06] px-2 py-1 text-[12px] text-amber-200/90">Not now: {r.blocked}</div>}
      {r.components && (
        <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] text-white/35">
          {Object.entries(r.components).map(([k, v]) => (
            <span key={k}>{COMP_LABEL[k] ?? k} {v}/{COMP_MAX[k] ?? "?"}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WoodsMachine({ m, sizing }: { m: WM; sizing: SizingContext | null }) {
  const health = feedHealth(m.feed);
  const scanned = m.rows.map((r) => r.as_of).sort().pop() ?? null;
  const anchor = m.rows.find((r) => r.anchor)?.anchor ?? null;
  const live = [...m.rows].filter((r) => !r.blocked).sort((a, b) => Number(b.trigger) - Number(a.trigger) || (b.confidence ?? 0) - (a.confidence ?? 0));
  const parked = m.rows.filter((r) => r.blocked);
  const dot = health.tone === "green" ? "bg-accent-green" : health.tone === "amber" ? "bg-amber-300" : "bg-rose-400";
  const recentTriggers = m.events.filter((e) => e.kind === "trigger");
  return (
    <Card
      title="Woods machine"
      tone={health.tone === "red" ? "warn" : recentTriggers.length ? "accent" : undefined}
      right={
        <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] tabular-nums">
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
          <span className={health.tone === "red" ? "text-rose-300" : health.tone === "amber" ? "text-amber-200" : "text-white/60"}>
            BloFin bars to {whenShort(health.lastBar)}{health.ageMin != null ? ` (${health.ageMin <= 0 ? "just closed" : `${health.ageMin}m ago`})` : ""} · {health.label}
          </span>
          <span className="text-white/35">· scanned {scanned ? `${whenShort(scanned)} (${ago(scanned)})` : "never"}</span>
        </span>
      }
      sub="Sweep → close back → 4H RSI divergence → 1H trigger, checked every 15 minutes on closed BloFin bars. Limits sit at the nearest pool outside no-man's land; the confidence score shows how it was built."
    >
      {health.tone === "red" && (
        <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.07] px-3 py-2 text-[13px] text-rose-200">
          The data feed is stale — these numbers may be wrong. Don&apos;t place anything from this card until the stamp turns green.
        </div>
      )}
      {anchor && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-[13.5px] ${anchor.state === "above" ? "bg-accent-green/[0.07] text-accent-green" : anchor.state === "below" ? "bg-rose-400/[0.06] text-rose-200" : "bg-amber-300/[0.07] text-amber-200"}`}>
          <strong>Anchor:</strong> {anchor.text}
        </div>
      )}
      {anchor?.macro?.text && (
        <div className="-mt-1.5 mb-3 rounded-lg bg-accent-cyan/[0.05] px-3 py-2 text-[13px] text-accent-cyan/90">
          <strong>Macro:</strong> {anchor.macro.text.replace(/^Eliz: /, "Eliz — ")} <a href="/dashboard/mentors" className="ml-1 text-white/45 hover:text-white/70">playbook →</a>
        </div>
      )}
      {anchor?.combo && (anchor.combo.state || anchor.combo.woodsbot) && (
        <div className={`-mt-1.5 mb-3 rounded-lg px-3 py-2 text-[13px] ${anchor.combo.state === "bear" || anchor.combo.woodsbot?.side === "short" ? "bg-rose-400/[0.07] text-rose-200" : "bg-violet-400/[0.08] text-violet-100"}`}>
          <strong>Divergence combo:</strong> {anchor.combo.state ? anchor.combo.text : `WoodsBot flagged a ${anchor.combo.woodsbot?.side === "short" ? "bearish" : "bullish"} 4H RSI divergence on BTC + TOTAL2 + TOTAL3 (bar ${whenShort(anchor.combo.woodsbot?.bar ?? null)}). Moonbag's own scan: ${anchor.combo.text}`}
          <div className="mt-1 text-[11.5px] text-white/50">Use: it's the 4H divergence leg for the whole market. Still wait for the 1H trigger at a swept level; stop past the swing low/high. Paper test — not scored yet.</div>
        </div>
      )}
      {anchor?.context && (() => {
        const cx = anchor.context;
        const on = cx.state === "risk_on" || cx.state === "leaning_on";
        const off = cx.state === "risk_off" || cx.state === "leaning_off";
        const sgn = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`);
        return (
          <div className={`-mt-1.5 mb-3 rounded-lg px-3 py-2 text-[13px] ${on ? "bg-accent-green/[0.06] text-accent-green/90" : off ? "bg-rose-400/[0.06] text-rose-200" : "bg-white/[0.03] text-white/65"}`}>
            <strong>Market:</strong> {cx.text}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11.5px] tabular-nums text-white/55">
              <span>USDT.D {cx.usdt_d?.toFixed(2) ?? "—"}% ({sgn(cx.usdt_d_24h)} 24h · {sgn(cx.usdt_d_7d)} 7d)</span>
              <span>TOTAL ${cx.total_bn != null ? (cx.total_bn / 1000).toFixed(2) : "—"}T ({sgn(cx.total_24h_pct)}% 24h · {sgn(cx.total_7d_pct)}% 7d)</span>
              <span>ETH/BTC {cx.ethbtc?.toFixed(5) ?? "—"} ({sgn(cx.ethbtc_7d_pct)}% 7d)</span>
              <span className="text-white/35">4H bar {whenShort(cx.as_of)} · paper test, not scored yet</span>
            </div>
          </div>
        );
      })()}
      <div className={`-mt-1.5 mb-3 rounded-lg px-3 py-2 text-[13px] ${anchor?.bias?.confirmed ? "bg-violet-400/[0.07] text-violet-200" : "bg-white/[0.03] text-white/60"}`}>
        <strong>Your week:</strong>{" "}
        {!anchor?.bias?.bias
          ? "no weekly bias yet — Moonbag's draft lands Monday 5:15 AM; tell Grok your view to lock it in."
          : anchor.bias.confirmed
            ? `${anchor.bias.bias.toUpperCase()}${anchor.bias.conviction ? ` (conviction ${anchor.bias.conviction}/5)` : ""}${anchor.bias.thoughts ? ` — ${anchor.bias.thoughts}` : ""}`
            : `Moonbag's draft says ${anchor.bias.bias.toUpperCase()} — not confirmed. Tell Grok "accept" or your own view.`}
      </div>
      {recentTriggers.length > 0 && (
        <div className="mb-3 space-y-1">
          {recentTriggers.map((e) => (
            <div key={e.id} className="rounded-lg border border-accent-green/40 bg-accent-green/[0.08] px-3 py-2 text-[13px] text-accent-green">
              WOODS TRIGGER · {e.coin} {e.side} · all four legs · {whenShort(e.created_at)}
            </div>
          ))}
        </div>
      )}
      {live.length ? (
        <div className="grid gap-3 lg:grid-cols-2">{live.map((r) => <Ticket key={`${r.coin}-${r.side}`} r={r} sizing={sizing} />)}</div>
      ) : (
        <p className="text-[13.5px] text-white/60">No limit worth placing right now — every side is blocked below. That is a normal state.</p>
      )}
      {parked.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[12.5px] text-white/45 hover:text-white/70">
            <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span> {parked.length} side{parked.length === 1 ? "" : "s"} not now (anchor, no-man&apos;s land, R:R) — tap to see
          </summary>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">{parked.map((r) => <Ticket key={`${r.coin}-${r.side}`} r={r} sizing={sizing} />)}</div>
        </details>
      )}
      <p className="mt-3 text-[11.5px] text-white/35">Sized from your calculated BloFin balance. Score = the components (out of 110) scaled to 100 · A+ ≥ 75 · A ≥ 60 · B ≥ 45. A and A+ are paper-tracked automatically and graded every Saturday. Analysis only — you place every order.</p>
    </Card>
  );
}
