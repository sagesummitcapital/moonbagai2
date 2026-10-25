// A+ SETUPS — the first thing on the leverage desk (Stavros, 2026-10-18: "any A+ moonbag limit setups for btc eth sol
// or top 5 ... make sure its prominent"). Display only: every row is a limit_orders row the page already loads
// (grade A+, status working), laid out the way BloFin's order form asks for it. From 2026-10-18 every A+ setup
// secures 2R at TP1 (take 70%, stop to entry) and TP2 is the runner — both targets are shown side by side.
import type { LimitInputs, LimitOrder } from "@/lib/moonbag/limits";
import { fmtRR } from "@/lib/moonbag/desk";
import { Badge, Card, Id, Updated, money, num, px2, whenShort } from "./ui";

const CORE = ["BTC", "ETH", "SOL"];

const SETUP_LABEL: Record<string, string> = {
  woods_limit: "Woods limit",
  limit_sweep: "Limit sweep",
  fib_75: "Fib 0.75 retrace",
};
const setupName = (id: string | null) => (id ? SETUP_LABEL[id] ?? id.replace(/_/g, " ") : "limit setup");

const originLabel = (o: LimitOrder["origin"]) => (o === "paper" ? "paper" : o === "moonbag" ? "Moonbag pick" : "yours");
const originTone = (o: LimitOrder["origin"]) => (o === "paper" ? "gray" : "cyan");

/** The A+ rows this strip shows: grade A+, still working, on BTC / ETH / SOL or the rotation top 5 (when the board gave us one). */
export function aplusRows(open: LimitOrder[] | null | undefined, movers: string[] | null | undefined): LimitOrder[] {
  const allowed = movers?.length ? new Set([...CORE, ...movers.map((m) => m.toUpperCase())]) : null;
  const rank = (s: string) => { const i = CORE.indexOf(s.toUpperCase()); return i === -1 ? CORE.length : i; };
  return (open ?? [])
    .filter((o) => (o.grade ?? "").toUpperCase() === "A+" && o.status === "working" && (!allowed || allowed.has(o.symbol.toUpperCase())))
    .sort((a, b) => rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol) || a.direction.localeCompare(b.direction));
}

/** One BloFin-style field: label over a big tabular figure, one short line under it. */
function Field({ k, v, sub, cls = "text-white" }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/25 px-2.5 py-2">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className={`mt-0.5 break-words font-mono text-[15px] font-semibold leading-tight tabular-nums ${cls}`}>{v}</div>
      {sub && <div className="mt-0.5 font-mono text-[11px] tabular-nums text-white/45">{sub}</div>}
    </div>
  );
}

function Ticket({ o, inputs, equity }: { o: LimitOrder; inputs: LimitInputs | null; equity: number | null }) {
  const long = o.direction === "long";
  const stop = o.current_stop ?? o.stop;
  const entry = Number(o.limit_price);
  const stopPct = stop != null && entry ? (Math.abs(entry - Number(stop)) / entry) * 100 : null;
  const sized = o.quantity != null;
  return (
    <div className="min-w-0 rounded-xl border border-accent-green/40 bg-accent-green/[0.06] p-3.5">
      {/* header: coin + side + grade + who placed it */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[16px] text-white">{o.symbol}</strong>
          <span className={`text-[13px] font-semibold ${long ? "text-accent-green" : "text-rose-300"}`}>{long ? "▲ LONG" : "▼ SHORT"}</span>
          <Badge tone="green">A+</Badge>
          <Badge tone={originTone(o.origin)}>{originLabel(o.origin)}</Badge>
        </div>
        <span className="font-mono text-[12.5px] tabular-nums text-white/60">{setupName(o.setup_id)} · <strong className="text-white">{fmtRR(o.plan_r == null ? null : Number(o.plan_r))}</strong></span>
      </div>

      {/* the order, laid out like BloFin's form */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Field k={long ? "Buy limit" : "Sell limit"} v={px2(o.limit_price)} sub={o.level != null ? `${(o.level_kind ?? "level").replace(/_/g, " ")} ${px2(o.level)}` : "isolated · stop on exchange"} />
        <Field k="Stop loss" v={px2(stop)} sub={stopPct == null ? undefined : `${num(stopPct, 2)}% away`} cls="text-rose-300" />
        <Field k="TP1 · take 70%" v={px2(o.tp1)} sub="then stop to entry" cls="text-accent-green" />
        <Field k="TP2 · runner" v={px2(o.tp2)} sub="rest rides" cls="text-accent-green" />
      </div>
      {sized ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Field k="Size" v={`${num(o.quantity, 4)} ${o.symbol}`} sub={o.notional != null ? `≈ ${money(o.notional)}` : undefined} />
          <Field k="Leverage" v={o.leverage != null ? `${num(o.leverage, 0)}x` : "—"} sub="isolated · stop on exchange" />
          <Field k="Margin" v={money(o.margin)} />
          <Field k="Risk" v={money(o.risk_dollars)} sub={o.risk_percent != null ? `${num(o.risk_percent, 2)}% of account` : undefined} cls="text-rose-300" />
        </div>
      ) : inputs ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <Field k="Size" v={`${inputs.qty} ${o.symbol}`} sub={`≈ ${money(inputs.notional)}`} />
          <Field k="Leverage" v={`${inputs.leverage}x`} sub={`max safe ${inputs.ceiling}x`} />
          <Field k="Margin" v={money(inputs.margin)} sub="isolated · stop on exchange" />
          <Field k="Risk" v={money(inputs.riskUsd)} sub={`${num(inputs.riskPct, 2)}% of ${money(equity)}`} cls="text-rose-300" />
          <Field k="Liq ≈" v={px2(inputs.liq)} sub={inputs.liqOk ? "beyond 1.25× stop" : "⚠ too close to stop"} cls={inputs.liqOk ? "text-amber-200" : "text-rose-300"} />
        </div>
      ) : null}

      {/* when this data is from, and when the order dies */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/45">
        <Updated label="setup" at={o.updated_at} cadenceH={12} verb="updated" />
        <span className="font-mono tabular-nums">{o.expires_at ? `cancel ${whenShort(o.expires_at)} if not filled` : "until cancelled"}</span>
        {!sized && <a href={`#inputs-${o.limit_id}`} className="inline-flex min-h-[40px] items-center text-accent-cyan hover:underline">full inputs →</a>}
        <Id className="ml-auto">{o.limit_id}</Id>
      </div>
      {o.invalid_if && <div className="mt-2 rounded-md bg-amber-300/[0.07] px-2.5 py-1.5 text-[12.5px] text-amber-200/90"><strong>Invalid if:</strong> {o.invalid_if}</div>}
      {o.reasoning && <p className="mt-2 text-[12.5px] leading-snug text-white/55">{o.reasoning}</p>}
    </div>
  );
}

/**
 * The strip. Loud (green card, one ticket per setup) when there is an A+ limit working; one quiet line when there is
 * none. The newest row's time is always in the header so the data's age is never in doubt.
 */
export function APlusStrip({ rows, inputsFor, equity, feedStale, mutedPaper = 0, source = "limit orders" }: {
  rows: LimitOrder[];
  inputsFor: (o: LimitOrder) => LimitInputs | null;
  equity: number | null;
  /** True when the market-data feed is red — the strip then carries the same "don't trade off this" warning. */
  feedStale?: boolean;
  /** Paper A+ limits left out because the paper limit record is negative (same rule as "needs you now"). */
  mutedPaper?: number;
  source?: string;
}) {
  const newest = rows.map((r) => r.updated_at).sort().pop() ?? null;
  if (!rows.length) {
    return (
      <div id="aplus" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[13.5px] text-white/55">
        <span className="h-2 w-2 shrink-0 rounded-full bg-white/25" aria-hidden />
        <span>No A+ setups right now</span>
        <span className="text-[12px] text-white/35">— BTC, ETH, SOL and the top 5, from {source}. Waiting is the normal state.</span>
        {mutedPaper > 0 && <span className="text-[12px] text-white/35">· {mutedPaper} paper A+ limit{mutedPaper === 1 ? "" : "s"} muted (paper record negative)</span>}
      </div>
    );
  }
  return (
    <div id="aplus" className="scroll-mt-32">
      <Card
        title="A+ setups"
        tone="accent"
        sub="Every working A+ limit on BTC, ETH, SOL and the rotation top 5. TP1 is exactly 2R — take 70% and move the stop to entry; TP2 is the runner. You place every order."
        right={
          <>
            <Badge tone="green" dot>{rows.length} working</Badge>
            <Updated label="data" at={newest} cadenceH={12} verb="updated" />
          </>
        }
      >
        {feedStale && (
          <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.07] px-3 py-2 text-[13px] text-rose-200">
            Market data is stale — check the stamp above before placing any of these.
          </div>
        )}
        {mutedPaper > 0 && <p className="mb-2 text-[12px] text-white/40">{mutedPaper} paper A+ limit{mutedPaper === 1 ? "" : "s"} muted — the paper limit record is negative.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((o) => <div key={o.limit_id} className="min-w-0"><Ticket o={o} inputs={inputsFor(o)} equity={equity} /></div>)}
        </div>
      </Card>
    </div>
  );
}
