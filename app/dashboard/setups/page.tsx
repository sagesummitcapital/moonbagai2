import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, PageHeader, Stamps, Updated, whenShort } from "../_components/ui";
import { clean, fmt, getSetupsPage, rr, type Setup, type StrategyRow } from "@/lib/moonbag/site";

export const dynamic = "force-dynamic";

/**
 * SETUPS (CR-78, Stavros 2026-11-13): "a+ trades, and strategies being tested".
 * Top: the A / A+ setups live right now, as order tickets. Middle: how those grades have actually done.
 * Bottom: every strategy, by stage (live → paper → lab → retired), with its real record and what is missing before it counts as proven.
 */
const STAGE: Record<string, { label: string; tone: string }> = {
  live: { label: "Live", tone: "green" }, paper: { label: "Paper", tone: "cyan" }, lab: { label: "Testing", tone: "amber" },
  benchmark: { label: "Benchmark", tone: "gray" }, retired: { label: "Retired", tone: "gray" }, graveyard: { label: "Retired", tone: "gray" },
};

function Ticket({ s }: { s: Setup }) {
  const long = s.direction === "long";
  const row = (k: string, v: string) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.05] py-1.5 first:border-t-0">
      <span className="text-[12px] text-white/45">{k}</span>
      <span className="font-mono text-[13.5px] tabular-nums text-white">{v}</span>
    </div>
  );
  return (
    <details className="rounded-2xl border border-white/[0.07] bg-white/[0.02] open:bg-white/[0.035]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          <Badge tone={s.grade === "A+" ? "green" : "cyan"}>{s.grade}</Badge>
          <span className="text-[15px] font-semibold text-white">{s.symbol} <span className={long ? "text-accent-green" : "text-rose-300"}>{long ? "long" : "short"}</span></span>
          {s.origin === "paper" && <span className="text-[11px] text-white/35">paper-tracked</span>}
          {s.status === "touched" && <Badge tone="amber">price is at the entry</Badge>}
        </div>
        <span className="font-mono text-[12.5px] tabular-nums text-white/70">entry {fmt(s.limit_price)} · stop {fmt(s.stop)} · target {fmt(s.tp1)} · {s.plan_r != null ? `${Number(s.plan_r).toFixed(1)}R` : "—"}</span>
      </summary>
      <div className="grid gap-4 border-t border-white/[0.06] px-4 py-3 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          {row("Entry (limit)", fmt(s.limit_price))}
          {row("Stop", fmt(s.stop))}
          {row("Target 1", fmt(s.tp1))}
          {s.tp2 != null && row("Target 2", fmt(s.tp2))}
          {row("Reward to risk", s.plan_r != null ? `${Number(s.plan_r).toFixed(2)}R` : "—")}
          {s.expires_at && row("Good until", whenShort(s.expires_at))}
        </div>
        <div className="space-y-2 text-[12.5px] leading-relaxed text-white/70">
          {s.reasoning && <p><span className="text-white/40">Why: </span>{clean(s.reasoning)}</p>}
          {s.bull_case && <p><span className="text-white/40">For: </span>{clean(s.bull_case)}</p>}
          {s.bear_case && <p><span className="text-white/40">Against: </span>{clean(s.bear_case)}</p>}
          {s.invalid_if && <p><span className="text-white/40">Dead if: </span>{clean(s.invalid_if)}</p>}
          <p className="text-white/35">Run the prop check with Grok before any order. Size comes from the check, not from this card.</p>
        </div>
      </div>
    </details>
  );
}

function Strategy({ s }: { s: StrategyRow }) {
  const st = STAGE[s.stage] ?? { label: s.stage, tone: "gray" };
  const n = s.league?.n ?? s.trades ?? 0;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <span className="truncate text-[13.5px] font-medium text-white">{clean(s.name)}</span>
        </div>
        <span className="font-mono text-[12.5px] tabular-nums text-white/75">
          {n ? `${n} trades` : "no trades yet"}{s.league?.avg_r != null ? ` · ${rr(s.league.avg_r)} avg · ${rr(s.league.total_r)} total` : ""}
        </span>
      </div>
      {(s.flags?.length ?? 0) > 0 && <div className="mt-1 text-[12px] text-amber-200/80">Before it counts as proven: {s.flags!.map(clean).join(" · ")}</div>}
      {s.retired_reason && <div className="mt-1 text-[12px] text-white/45">Retired: {clean(s.retired_reason)}</div>}
      {s.kill_line && !s.retired_reason && <div className="mt-1 text-[12px] text-white/40">Stops being used if: {clean(s.kill_line)}</div>}
    </div>
  );
}

export default async function SetupsPage() {
  const { data, error } = await load(getSetupsPage);
  const live = data?.live ?? [];
  const strategies = data?.strategies ?? [];
  const active = strategies.filter((s) => ["live", "paper", "lab"].includes(s.stage));
  const rest = strategies.filter((s) => !["live", "paper", "lab"].includes(s.stage));
  return (
    <div className="space-y-6">
      <PageHeader title="Setups" sub="The A and A+ setups live right now, how those grades have really done, and every strategy being tested. No trade is the default." />
      <Stamps><Updated at={data?.as_of} label="setups" verb="as of" cadenceH={1} /></Stamps>
      <DataNotice error={error} />

      <Card title="Live now" right={<span>{live.length} setup{live.length === 1 ? "" : "s"}</span>}>
        {live.length === 0 ? <Empty>No A or A+ setup right now. Waiting is a position.</Empty> : <div className="space-y-2">{live.map((s) => <Ticket key={s.limit_id} s={s} />)}</div>}
      </Card>

      <Card title="How these grades have done" sub="Last 30 days, every A and A+ setup Moonbag posted, taken or not.">
        {(data?.record ?? []).length === 0 ? <Empty>No graded setups in the last 30 days.</Empty> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data!.record!.map((r) => (
              <div key={r.grade} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <Badge tone={r.grade === "A+" ? "green" : "cyan"}>{r.grade}</Badge>
                  <span className="font-mono text-[12px] text-white/45">{r.n} posted · {r.resolved} resolved</span>
                </div>
                <div className="mt-1.5 font-mono text-[20px] tabular-nums text-white">{rr(r.avg_r)} <span className="text-[12px] text-white/45">avg · {r.win_pct ?? "—"}% wins</span></div>
                {r.resolved < 30 && <div className="mt-1 text-[11.5px] text-amber-200/75">Under 30 resolved — too few to trust yet.</div>}
              </div>
            ))}
          </div>
        )}
        {(data?.recent ?? []).length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-white/55 hover:text-white">Last {data!.recent!.length} resolved setups</summary>
            <div className="mt-2 space-y-1">
              {data!.recent!.map((r) => (
                <div key={r.limit_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] py-1.5 text-[12.5px]">
                  <span className="text-white/80">{r.grade} · {r.symbol} {r.direction} @ {fmt(r.limit_price)}</span>
                  <span className="font-mono tabular-nums text-white/60">{clean((r.outcome ?? "").replace(/_/g, " "))}{r.outcome_r != null ? ` · ${rr(r.outcome_r)}` : ""} · {whenShort(r.resolved_at)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </Card>

      <Card title="Strategies being tested" sub="A strategy is proven only with 30+ trades, a clear reason it makes money, and a clean test. Until then it is paper or testing.">
        {active.length === 0 ? <Empty>No strategies on file.</Empty> : <div className="space-y-2">{active.map((s) => <Strategy key={s.strategy_key} s={s} />)}</div>}
        {rest.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-white/55 hover:text-white">Benchmark and retired ({rest.length})</summary>
            <div className="mt-2 space-y-2">{rest.map((s) => <Strategy key={s.strategy_key} s={s} />)}</div>
          </details>
        )}
      </Card>
    </div>
  );
}
