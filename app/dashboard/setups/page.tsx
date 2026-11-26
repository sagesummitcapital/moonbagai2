import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, PageHeader, Stamps, Updated, whenShort } from "../_components/ui";
import { clean, fmt, getSetupsPage, rr, type LedgerRow, type Setup, type StrategyRow } from "@/lib/moonbag/site";
import { getPlans, planRecord, STATUS_WORD, type Plan } from "@/lib/moonbag/plans";

export const dynamic = "force-dynamic";

/**
 * SETUPS — the prop trade engine (CR-91, Stavros 2026-11-21): "focus on getting trades in front of me to take on my prop firm account.
 * i want you to track the outcome of every trade you give regardless of if i take it or not ... reviewing yourself and making improvements."
 * Live trades (from strategies that passed the evidence gate) · every trade Moonbag gave and how it ended · each strategy's record, history vs live.
 * The engine runs in the database every 15 minutes; the gate promotes and demotes strategies by their own results.
 */
const STAGE: Record<string, { label: string; tone: string }> = {
  live: { label: "Sent to you", tone: "green" }, paper: { label: "Tracked, not sent", tone: "amber" }, lab: { label: "Lab", tone: "gray" },
  retired: { label: "Off", tone: "gray" },
};

const OUTCOME: Record<LedgerRow["status"], { label: string; tone: string }> = {
  pending: { label: "waiting for fill", tone: "gray" }, filled: { label: "in the trade", tone: "cyan" }, won: { label: "target hit", tone: "green" },
  lost: { label: "stopped", tone: "red" }, timeout: { label: "timed out", tone: "amber" }, expired: { label: "never filled", tone: "gray" }, ran_away: { label: "ran without filling", tone: "gray" },
};

function Ticket({ s, live }: { s: Setup; live: boolean }) {
  const long = s.direction === "long";
  const row = (k: string, v: string) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.05] py-1.5 first:border-t-0">
      <span className="text-[12px] text-white/45">{k}</span>
      <span className="font-mono text-[13.5px] tabular-nums text-white">{v}</span>
    </div>
  );
  return (
    <details className="rounded-2xl border border-white/[0.07] bg-white/[0.02] open:bg-white/[0.035]" open={live}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          <Badge tone={live ? "green" : "amber"}>{live ? "Take-able" : "Test"}</Badge>
          <span className="text-[15px] font-semibold text-white">{s.symbol} <span className={long ? "text-accent-green" : "text-rose-300"}>{long ? "long" : "short"}</span></span>
          <span className="text-[12px] text-white/40">{clean(s.level_kind)}</span>
          {s.status === "touched" && <Badge tone="cyan">filled — in the trade</Badge>}
        </div>
        <span className="font-mono text-[12.5px] tabular-nums text-white/70">limit {fmt(s.limit_price)} · stop {fmt(s.stop)} · target {fmt(s.tp1)} · 2R</span>
      </summary>
      <div className="grid gap-4 border-t border-white/[0.06] px-4 py-3 sm:grid-cols-[260px_minmax(0,1fr)]">
        <div>
          {row("Limit entry", fmt(s.limit_price))}
          {row("Stop", fmt(s.stop))}
          {row("Target (2R)", fmt(s.tp1))}
          {s.expires_at && row("Good until", whenShort(s.expires_at))}
          {(s.sizing ?? []).map((z) => row(z.account.replace("BRK-PRO-", ""), z.qty ? `${z.qty} ${s.symbol} · $${z.risk}${z.over_cap ? " · over lev cap" : ""}` : "no room / locked"))}
        </div>
        <div className="space-y-2 text-[12.5px] leading-relaxed text-white/70">
          {s.reasoning && <p><span className="text-white/40">Why: </span>{clean(s.reasoning)}</p>}
          <p className="text-white/40">Run the prop check with Grok before placing it. Tracked to the end whether you take it or not.</p>
        </div>
      </div>
    </details>
  );
}

const OPEN_PLAN = ["watching", "armed", "reclaimed"];

/** CR-96: his own conditional setups — watched every 15 minutes, fired only when the structure confirms, graded either way. */
function PlanRow({ p }: { p: Plan }) {
  const long = p.side === "long";
  const zone = Number(p.zone_lo) === Number(p.zone_hi) ? fmt(p.zone_lo) : `${fmt(p.zone_lo)}–${fmt(p.zone_hi)}`;
  const open = OPEN_PLAN.includes(p.status);
  const r = p.r_net == null ? null : Number(p.r_net);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={open ? (p.status === "watching" ? "gray" : "cyan") : p.status === "triggered" ? (r == null ? "cyan" : r > 0 ? "green" : "red") : "gray"}>
            {p.status === "triggered" ? (r == null ? "fired — live" : rr(r)) : STATUS_WORD[p.status]}
          </Badge>
          <span className="text-[13.5px] font-medium text-white">#{p.plan_id} {p.coin} <span className={long ? "text-accent-green" : "text-rose-300"}>{p.side}</span></span>
          <span className="text-[12px] text-white/45">{p.setup}{p.retest ? " + retest" : ""} at {zone} · {p.confirm_tf}</span>
        </div>
        <span className="font-mono text-[12px] tabular-nums text-white/60">
          {p.status === "triggered" ? `entry ${fmt(p.entry)} · stop ${fmt(p.stop)} · target ${fmt(p.tp)}` : `stop ${p.stop_px != null ? fmt(p.stop_px) : "past the wick"} · target ${p.target_px != null ? fmt(p.target_px) : "2R"}`}
          {p.taken_trade_id ? " · you took it" : ""}
        </span>
      </div>
      {(p.name || (p.status_note && !open)) && <p className="mt-1 text-[12px] leading-snug text-white/50">{clean(p.name ?? "")}{p.name && p.status_note && !open ? " — " : ""}{!open ? clean(p.status_note) : ""}</p>}
      {open && <p className="mt-1 text-[11.5px] text-white/35">good until {whenShort(p.valid_until)}</p>}
    </div>
  );
}

function Strategy({ s }: { s: StrategyRow }) {
  const st = STAGE[s.stage] ?? { label: s.stage, tone: "gray" };
  const h = s.history;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <span className="truncate text-[13.5px] font-medium text-white">{clean(s.name)}</span>
        </div>
        <span className="font-mono text-[12px] tabular-nums text-white/70">
          history {h?.n ?? 0} trades · {rr(h?.avg_r)} avg · {h?.win_pct ?? "—"}% wins · PF {h?.pf ?? "—"}
          <span className="text-white/35"> | </span>
          live {s.league?.n ?? 0} · {rr(s.league?.avg_r)}
        </span>
      </div>
      {s.notes && <p className="mt-1 text-[12px] leading-snug text-white/50">{clean(s.notes)}</p>}
      {s.retired_reason && <p className="mt-1 text-[12px] text-amber-200/75">{clean(s.retired_reason)}</p>}
    </div>
  );
}

export default async function SetupsPage() {
  const { data, error } = await load(getSetupsPage);
  const plansRes = await load(() => getPlans(30));
  const plans = plansRes.data ?? [];
  const openPlans = plans.filter((p) => OPEN_PLAN.includes(p.status));
  const donePlans = plans.filter((p) => !OPEN_PLAN.includes(p.status));
  const planRec = planRecord(plans);
  const live = data?.live ?? [];
  const testing = data?.testing ?? [];
  const ledger = data?.ledger ?? [];
  const strategies = data?.strategies ?? [];
  const sent = ledger.filter((l) => l.pushed);
  const graded = sent.filter((l) => l.r_net != null);
  const totalR = graded.reduce((a, l) => a + Number(l.r_net), 0);
  const wins = graded.filter((l) => Number(l.r_net) > 0).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Setups"
        sub="Prop trades Moonbag finds for you, every one graded to the end whether you take it or not, and the strategies behind them. A strategy only sends you trades while its own record earns it."
      />
      <Stamps><Updated at={data?.as_of} label="engine" verb="as of" cadenceH={0.5} /></Stamps>
      <DataNotice error={error} />

      <Card title="Take-able now" right={<span>{live.length} trade{live.length === 1 ? "" : "s"}</span>}>
        {live.length === 0 ? <Empty>Nothing to take right now. Grok sends each new one to you as it fires.</Empty> : <div className="space-y-2">{live.map((s) => <Ticket key={s.limit_id} s={s} live />)}</div>}
      </Card>

      <Card
        title="Your plans"
        right={<span>{openPlans.length} open</span>}
        sub="Your setups, given to Grok — structure, not predictions. Each fires only when price confirms it, comes to you like any trade, and is graded whether you take it or not."
      >
        {plans.length === 0 ? <Empty>No plans yet. Tell Grok a setup, e.g. &ldquo;BTC short if it deviates above 64.5–65.5K, stop above the wick.&rdquo;</Empty> : (
          <div className="space-y-2">
            {openPlans.map((p) => <PlanRow key={p.plan_id} p={p} />)}
            {donePlans.slice(0, 12).map((p) => <PlanRow key={p.plan_id} p={p} />)}
            {planRec.length > 0 && (
              <p className="pt-1 text-[12.5px] text-white/60">
                Your record (30 days): {planRec.map((r) => `${r.setup} — ${r.n} trades, ${rr(r.avg_r)} avg, ${r.win_pct}% wins`).join(" · ")}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Every trade Moonbag sent you"
        right={<span className="font-mono">{graded.length} graded · {wins} won · <span className={totalR >= 0 ? "text-accent-green" : "text-rose-300"}>{rr(totalR)}</span></span>}
        sub="Graded on BloFin candles with fees. A bar that touches both the stop and the target counts as the stop."
      >
        {sent.length === 0 ? <Empty>No trades sent yet. The first ones arrive at the next 4-hour closes.</Empty> : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-white/40">
                  <th className="pb-2 pr-3 font-medium">Sent</th><th className="pb-2 pr-3 font-medium">Trade</th><th className="pb-2 pr-3 text-right font-medium">Entry / stop / target</th>
                  <th className="pb-2 pr-3 font-medium">Outcome</th><th className="pb-2 pr-3 text-right font-medium">R</th><th className="pb-2 font-medium">You</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((l) => (
                  <tr key={l.signal_id} className="border-t border-white/[0.05]">
                    <td className="py-1.5 pr-3 font-mono text-white/50">{whenShort(l.signal_at)}</td>
                    <td className="py-1.5 pr-3 text-white">{l.coin} <span className={l.side === "long" ? "text-accent-green" : "text-rose-300"}>{l.side}</span></td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-white/70">{fmt(l.entry)} / {fmt(l.stop)} / {fmt(l.tp)}</td>
                    <td className="py-1.5 pr-3"><Badge tone={OUTCOME[l.status].tone}>{OUTCOME[l.status].label}</Badge></td>
                    <td className={`py-1.5 pr-3 text-right font-mono tabular-nums ${l.r_net == null ? "text-white/30" : Number(l.r_net) > 0 ? "text-accent-green" : "text-rose-300"}`}>{l.r_net == null ? "—" : rr(l.r_net)}</td>
                    <td className="py-1.5 text-white/60">{l.taken_trade_id ? "took it" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Strategies" sub="Sent to you only while: 30+ trades of history, +0.05R or better on average after fees, profit factor 1.1+, and the last 60 days not negative. Pulled automatically if its last 10 live trades average −0.25R or worse. Checked every day after the 5:30 PM reset.">
        {strategies.length === 0 ? <Empty>No strategies on file.</Empty> : <div className="space-y-2">{strategies.map((s) => <Strategy key={s.strategy_key} s={s} />)}</div>}
      </Card>

      {testing.length > 0 && (
        <Card title="Being tested (not sent to you)" sub="Strategies that have not earned it yet. Tracked the same way, so they can promote themselves.">
          <div className="space-y-2">{testing.slice(0, 8).map((s) => <Ticket key={s.limit_id} s={s} live={false} />)}</div>
        </Card>
      )}
    </div>
  );
}
