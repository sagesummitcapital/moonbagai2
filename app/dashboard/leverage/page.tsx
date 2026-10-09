import { fmtPct, fmtRR, getLeverageDesk, signalLabel, tradeMetrics, type LevHourly, type LevSignal } from "@/lib/moonbag/desk";
import type { DailyThesis } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Mono, Stat, Table, biasTone, list, money, num, statusTone, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const COMPONENT_LABELS: Record<string, string> = {
  htf_alignment: "Higher-timeframe alignment",
  level_quality: "Level quality",
  trigger_quality: "Trigger quality",
  reward_risk: "Reward : risk",
  regime_fit: "Regime fit",
  setup_track_record: "Setup track record",
  macro_catalyst: "Macro & catalysts",
};

const gradeTone = (g?: number | null) => (g == null ? "gray" : g >= 5 ? "green" : g >= 4 ? "cyan" : g >= 3 ? "amber" : "gray");
const signalTone = (s: string) =>
  s === "armed" ? "cyan" : s === "triggered" || s === "taken" ? "green" : s === "watching" ? "amber" : "gray";

export default async function LeveragePage() {
  const { data, error } = await load(getLeverageDesk);
  if (!data) return <DataNotice error={error} />;

  const { strategy, risk, equity, startingEquity, milestone, latest, signals, alerts, openTrades, closedTrades } = data;
  const rules = (strategy?.rules ?? {}) as Record<string, unknown>;
  const model = (strategy?.confidence_model ?? {}) as { components?: Record<string, number>; penalties?: Record<string, number>; grades?: Record<string, number> };
  const live = signals.filter((s) => ["watching", "armed", "triggered", "taken"].includes(s.status) && !s.outcome);
  const resolved = signals.filter((s) => s.outcome);
  const progress = milestone ? Math.max(0, Math.min(100, ((equity - startingEquity) / (milestone - startingEquity)) * 100)) : 100;
  const lastRun = data.hourly[0]?.ts;
  const stale = lastRun ? Date.now() - new Date(lastRun).getTime() > 2.5 * 3600_000 : true;

  return (
    <div className="space-y-6">
      <DataNotice error={error} />

      <div>
        <h1 className="text-[22px] font-semibold text-white">Leverage desk <span className="text-white/40">· BloFin · BTC &amp; ETH</span></h1>
        <p className="mt-1 text-[13.5px] text-white/55">
          Moonbag checks the market every hour and records it here. You place every order. No trade is the default.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <Stat
            label="BloFin account"
            value={money(equity)}
            sub={milestone ? `${data.equityReportedAt ? `Reported ${when(data.equityReportedAt)} · ` : ""}Next milestone ${money(milestone)} · ${num(progress, 1)}% of the way from ${money(startingEquity)}` : "All milestones reached"}
          />
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-accent-green/70" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 font-mono text-[11.5px] text-white/40">
            {(Array.isArray(rules.milestones) ? (rules.milestones as number[]) : [240, 1000, 10000, 100000, 1000000]).map((m) => money(m).replace(".00", "")).join("  →  ")}
          </div>
        </Card>
        <Card>
          <Stat
            label="Risk per trade"
            value={<span className="text-[22px]">{num(risk?.risk_per_trade_pct, 1)}% <span className="text-[14px] text-white/45">≈ {money((equity * Number(risk?.risk_per_trade_pct ?? 2)) / 100)}</span></span>}
            sub={`Max ${num(risk?.max_leverage, 0)}x · margin cap ${money(risk?.max_margin_dollars)} · hold ≤ ${num(risk?.max_hold_days, 0)} days`}
          />
        </Card>
        <Card>
          <Stat
            label="Hourly watch"
            value={<span className="text-[18px]">{lastRun ? when(lastRun) : "not yet run"}</span>}
            sub={stale ? "No hourly entry in the last 2½ hours — check the scheduled task." : "Running. Pings DESK ALERTs (grade 3+ that pass the checklist)."}
          />
        </Card>
      </div>

      {/* ------------------------------------------------ current thesis + levels */}
      <div className="grid gap-4 lg:grid-cols-2">
        {["BTC", "ETH"].map((a) => (
          <AssetCard
            key={a}
            asset={a}
            h={latest[a]}
            thesis={data.theses.find((t) => t.asset === a)}
            alerts={alerts.filter((x) => x.asset === a && x.status === "active")}
          />
        ))}
      </div>

      {/* ------------------------------------------------ live signals */}
      <Card title="Setups Moonbag is watching" right={<Badge tone="gray">{live.length} open</Badge>}>
        {live.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{live.map((s) => <SignalCard key={s.signal_id} s={s} max={model.components} />)}</div>
        ) : (
          <Empty>No setup forming right now. That is the normal state — Moonbag is waiting for price to reach a level.</Empty>
        )}
      </Card>

      {/* ------------------------------------------------ open trades */}
      <Card title="Open BloFin trades">
        <Table
          head={["Trade", "Coin", "Side", "R : R", "Account % (stop / target)", "Entry", "Stop (orig / now)", "Targets", "Risk $", "Still open", "Banked", "Size · Lev", "Opened"]}
          rows={openTrades.map((t) => { const m = tradeMetrics(t); return [
            <Mono key="i">{t.trade_id}</Mono>,
            t.symbol,
            <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
            <strong key="rr" className="font-mono text-white">{fmtRR(m.rr)}</strong>,
            <span key="pc" className="font-mono"><span className={Number(m.riskPct) < 0 ? "text-rose-300" : "text-accent-green"}>{fmtPct(m.riskPct)}</span> / <span className="text-accent-green">{fmtPct(m.rewardPct)}</span></span>,
            num(t.entry),
            <span key="st">{num(t.stop)} / {num(t.current_stop)}{(t.direction === "short" ? Number(t.current_stop) <= Number(t.entry) : Number(t.current_stop) >= Number(t.entry)) && <> <Badge tone="green">risk-free</Badge></>}</span>,
            [t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp2 ?? t.tp2, t.current_tp3 ?? t.tp3].map((x) => num(x)).join(" · "),
            money(t.risk_dollars),
            <span key="qo" className="font-mono">{num(t.qty_open ?? t.quantity, 4)}{t.quantity ? <span className="text-white/45"> ({num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)</span> : null}</span>,
            <span key="bk" className={`font-mono ${Number(t.banked_pnl) > 0 ? "text-accent-green" : Number(t.banked_pnl) < 0 ? "text-rose-300" : "text-white/50"}`}>{Number(t.banked_pnl) ? money(t.banked_pnl) : "—"}</span>,
            `${money(t.position_notional)} · ${num(t.leverage)}x · m ${money(t.margin)}`,
            when(t.opened_at),
          ]; })}
          empty="No open trade. Tell Moonbag (or Grokbot) when you take one and it shows up here with its next levels."
        />
      </Card>

      {/* ------------------------------------------------ strategy */}
      <Card
        title={strategy ? `Current strategy — v${strategy.version}` : "Current strategy"}
        right={strategy && <Mono>updated {when(strategy.created_at)}</Mono>}
      >
        {strategy ? (
          <>
            <p className="text-[14.5px] leading-relaxed text-white/80">{strategy.summary}</p>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
              <Row k="Coins" v={Array.isArray(rules.assets) ? (rules.assets as string[]).join(", ") : "BTC, ETH"} />
              <Row k="Positions at once" v={num(rules.max_positions, 0)} />
              <Row k="Trade only at grade" v={`${num(rules.min_grade_to_trade, 0)} or 5`} />
              <Row k="Risk by grade" v={Object.entries((rules.risk_pct_by_grade as Record<string, number>) ?? {}).sort().reverse().map(([g, p]) => `grade ${g} → ${p}%`).join(" · ") || "—"} />
              <Row k="Minimum reward to TP1" v={`${num(rules.min_rr_tp1, 1)}R (aim ${num(rules.target_rr_tp1, 1)}R+)`} />
              <Row k="At TP1" v={`close ${num(Number(rules.tp1_take_fraction ?? 0.5) * 100, 0)}%, ${String(rules.after_tp1 ?? "stop to breakeven")}`} />
              <Row k="Time stop" v={`${num(rules.max_hold_hours, 0)} hours`} />
              <Row k="Core hours" v={String(rules.core_hours ?? "—")} />
              <Row k="Levels from / trigger on" v={`${Array.isArray(rules.level_timeframes) ? (rules.level_timeframes as string[]).join(", ") : "4h, 1D"} / ${String(rules.trigger_timeframe ?? "1h")}`} />
              <Row k="After 2 losses in a row" v="half risk until a win" />
            </dl>

            <h3 className="mt-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">How the confidence score is built</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {Object.entries(model.components ?? {}).map(([k, pts]) => (
                <div key={k} className="flex items-center gap-3 text-[13px]">
                  <span className="w-52 shrink-0 text-white/65">{COMPONENT_LABELS[k] ?? k}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-accent-cyan/60" style={{ width: `${Number(pts) * 5}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-white/70">{typeof pts === "object" ? "—" : String(pts)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] text-white/50">
              Penalties: {Object.entries(model.penalties ?? {}).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ") || "—"}.
              {" "}Grades: {Object.entries(model.grades ?? {}).sort((a, b) => Number(b[0]) - Number(a[0])).filter(([, v]) => Number(v) > 0).map(([g, v]) => `${v}+ = ${g}`).join(" · ")}.
            </p>

            <details className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <summary className="cursor-pointer text-[13px] text-white/70">Read the full strategy</summary>
              <pre className="mt-4 max-h-[640px] overflow-auto whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-white/75">{strategy.markdown}</pre>
            </details>
            {strategy.change_reason && <p className="mt-3 text-[12.5px] text-white/45">Why this version: {strategy.change_reason}</p>}
          </>
        ) : (
          <Empty>No strategy saved yet.</Empty>
        )}
      </Card>

      {/* ------------------------------------------------ playbook */}
      <Card title="Playbook — setups and their record">
        <Table
          head={["Setup", "Status", "Works in", "Backtest", "Backtest avg R", "Signals graded", "Signal avg R"]}
          rows={data.setups.map((s) => [
            <span key="n"><strong className="text-white">{s.name}</strong><br /><Mono>{s.setup_id}</Mono></span>,
            <Badge key="s" tone={s.status === "live" ? "green" : s.status === "paper" ? "cyan" : s.status === "retired" ? "red" : "amber"}>{s.status}</Badge>,
            s.best_regime ?? "—",
            s.bt_trades != null ? `${s.bt_trades} trades · ${num(s.bt_win_rate, 0)}% wins · ${s.bt_asset} ${s.bt_timeframe}` : "—",
            <R key="b" v={s.bt_avg_r} />,
            s.resolved ? `${s.resolved} (${num(s.win_rate_pct, 0)}% wins, ${s.taken ?? 0} taken)` : "0",
            <R key="r" v={s.signal_avg_r} />,
          ])}
          empty="No setups in the playbook yet."
        />
        <div className="mt-4 space-y-3">
          {data.playbook.map((p) => (
            <details key={p.setup_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[13px] text-white/70">
              <summary className="cursor-pointer text-white/80">{p.name} — rules</summary>
              <p className="mt-2">{p.description}</p>
              <p className="mt-1.5"><span className="text-white/45">Entry: </span>{p.entry_rule}</p>
              <p className="mt-1"><span className="text-white/45">Stop: </span>{p.stop_rule}</p>
              <p className="mt-1"><span className="text-white/45">Target: </span>{p.target_rule}</p>
              {p.notes && <p className="mt-1.5 text-white/55"><span className="text-white/45">Evidence so far: </span>{p.notes}</p>}
            </details>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------ calibration + results */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Is the confidence score honest?">
          <Table
            head={["Grade", "Signals", "Graded", "Win rate", "Avg R", "Taken"]}
            rows={data.calibration.map((c) => [
              <Badge key="g" tone={gradeTone(c.confidence_grade)}>grade {c.confidence_grade ?? "—"}</Badge>,
              c.signals,
              c.resolved,
              c.resolved ? `${num(c.win_rate_pct, 0)}%` : "—",
              <R key="r" v={c.avg_r} />,
              c.taken,
            ])}
            empty="No graded signals yet. Every signal is followed after it triggers, taken or not, so this table fills in on its own."
          />
          <p className="mt-3 text-[12.5px] text-white/45">Higher grades should win more and earn more R. If they don&apos;t, the weekly review tightens the score.</p>
        </Card>
        <Card title="Closed BloFin trades">
          <Table
            head={["Coin", "Side", "Planned R : R", "Risked", "Result", "R", "P&L", "Lev", "Closed"]}
            rows={closedTrades.slice(0, 10).map((t) => { const m = tradeMetrics(t); return [
              t.symbol,
              <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
              <span key="rr" className="font-mono">{fmtRR(m.rr)}</span>,
              <span key="rk" className="font-mono text-rose-300">{fmtPct(m.riskPct)}</span>,
              <span key="rs" className={`font-mono ${Number(m.resultPct) >= 0 ? "text-accent-green" : "text-rose-300"}`}>{fmtPct(m.resultPct, 2)}</span>,
              <R key="r" v={t.r_multiple} />,
              <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
              `${num(t.leverage, 0)}x`,
              when(t.closed_at),
            ]; })}
            empty="No closed trades yet."
          />
        </Card>
      </div>

      <Card title="24-hour lookbacks — what could have gone better">
        {data.lookbacks.length ? (
          <ul className="space-y-4 text-[13.5px]">
            {data.lookbacks.map((l) => (
              <li key={l.trade_id} className="border-b border-white/[0.04] pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-white">{l.symbol}</strong>
                  <Badge tone={l.verdict === "well_managed" ? "green" : l.verdict === "lucky" || l.verdict === "should_have_skipped" ? "red" : "amber"}>{l.verdict.replace(/_/g, " ")}</Badge>
                  <span className="text-white/60">got <R v={l.r_realized} /> · original plan would have paid <R v={l.r_if_held_to_plan} /> · best possible <R v={l.r_best_in_window} /></span>
                  <Mono>{l.trade_id}</Mono>
                </div>
                {l.what_went_well && <p className="mt-1.5 text-white/75"><span className="text-white/45">Did well: </span>{l.what_went_well}</p>}
                <p className="mt-1 text-white/75"><span className="text-white/45">Could do better: </span>{l.could_do_better}</p>
                <p className="mt-1 text-white/75"><span className="text-white/45">Next time: </span>{l.suggestion}</p>
                <p className="mt-1 text-white/55">
                  {Number(l.dollars_left_on_table) > 0 && <>Left on the table {money(l.dollars_left_on_table)}. </>}
                  {Number(l.dollars_saved) > 0 && <>Saved by your management {money(l.dollars_saved)}. </>}
                  {Array.isArray(l.rules_broken) && l.rules_broken.length ? <>Rules broken: {l.rules_broken.join("; ")}.</> : <>All rules followed.</>}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No lookbacks yet. About 24 hours after each trade closes, Moonbag reviews what price did next and writes it here; a weekly breakdown follows on Saturday.</Empty>
        )}
      </Card>

      <Card title="Past signals and what happened">
        <Table
          head={["Signal", "Coin", "Side", "Setup", "Score", "Plan", "Outcome", "Lesson"]}
          rows={resolved.slice(0, 15).map((s) => [
            <span key="i"><Mono>{s.signal_id}</Mono><br /><Mono>{when(s.created_at)}</Mono></span>,
            s.asset,
            <Badge key="d" tone={biasTone(s.direction)}>{s.direction}</Badge>,
            s.setup_id,
            <Badge key="g" tone={gradeTone(s.confidence_grade)}>{num(s.confidence_score, 0)} · g{s.confidence_grade}</Badge>,
            `${num(s.entry)} / ${num(s.stop)} / ${num(s.tp1)}`,
            <span key="o">{s.outcome?.replace("_", " ")} <R v={s.outcome_r} /> {s.status === "taken" && <Badge tone="green">taken</Badge>}</span>,
            <span key="l" className="text-white/60">{s.lesson ?? s.status_reason ?? "—"}</span>,
          ])}
          empty="No finished signals yet."
        />
      </Card>

      {/* ------------------------------------------------ learning */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Journal — one line per close or test">
          {data.journal.length ? (
            <ul className="space-y-3 text-[13.5px]">
              {data.journal.map((j) => (
                <li key={j.id} className="border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2"><Badge tone="gray">{j.kind}</Badge><Mono>{when(j.created_at)}</Mono></div>
                  <p className="mt-1.5 text-white/75"><span className="text-white/45">Thesis: </span>{j.thesis}</p>
                  <p className="mt-1 text-white/75"><span className="text-white/45">Result: </span>{j.result}</p>
                  {j.mistake && <p className="mt-1 text-white/75"><span className="text-white/45">Mistake: </span>{j.mistake}</p>}
                  {j.rule_change && <p className="mt-1 text-white/75"><span className="text-white/45">Rule change: </span>{j.rule_change}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No journal lines yet.</Empty>
          )}
        </Card>
        <Card title="Latest backtests">
          <Table
            head={["Setup", "Coin · TF", "Trades", "Win %", "Avg R", "Max DD", "Notes"]}
            rows={data.backtests.slice(0, 14).map((b) => [
              b.setup_id ?? b.engine_code ?? "custom",
              `${b.asset} · ${b.timeframe}`,
              b.n_trades,
              num(b.win_rate, 0),
              <R key="r" v={b.avg_r} />,
              `${num(b.max_drawdown_r, 1)}R`,
              <span key="n" className="text-white/55">{b.notes ?? "—"}</span>,
            ])}
            empty="No backtests saved yet."
          />
          <p className="mt-3 text-[12.5px] text-white/45">Fees included, one position at a time. Under 20 trades is not proof of anything.</p>
        </Card>
      </div>

      <Card title="Hourly log">
        <Table
          head={["Time (Phoenix)", "Coin", "Price", "Bias (1h / higher)", "Regime", "Note"]}
          rows={data.hourly.slice(0, 24).map((h) => [
            when(h.ts),
            h.asset,
            num(h.price),
            <span key="b"><Badge tone={biasTone(h.bias)}>{h.bias ?? "—"}</Badge> <Badge tone={biasTone(h.htf_bias)}>{h.htf_bias ?? "—"}</Badge></span>,
            h.regime ?? "—",
            <span key="n" className="text-white/60">{h.note ?? "—"}</span>,
          ])}
          empty="The hourly watch hasn't written its first entry yet. It runs at 25 minutes past every hour."
        />
      </Card>
    </div>
  );
}

function AssetCard({ asset, h, thesis, alerts }: {
  asset: string;
  h?: LevHourly;
  thesis?: DailyThesis;
  alerts: { alert_id: string; condition: string; trigger_price: number | null; direction: string | null; action: string; message: string | null }[];
}) {
  const lv = (h?.levels ?? thesis?.levels ?? {}) as LevHourly["levels"];
  return (
    <Card
      title={`${asset} — bias & levels`}
      right={
        <div className="flex items-center gap-1.5">
          <Badge tone={biasTone(h?.bias ?? thesis?.bias)}>{h?.bias ?? thesis?.bias ?? "—"}</Badge>
          {h?.regime && <Badge tone="gray">{h.regime}</Badge>}
        </div>
      }
    >
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[26px] font-semibold text-white">{h ? num(h.price) : "—"}</div>
        <Mono>{h ? `as of ${when(h.ts)}` : "waiting for first hourly entry"}</Mono>
      </div>
      {h?.note && <p className="mt-2 text-[13.5px] leading-relaxed text-white/70">{h.note}</p>}
      {!h && thesis?.primary_scenario && <p className="mt-2 text-[13.5px] leading-relaxed text-white/70">{thesis.primary_scenario}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <Row k="Higher-timeframe bias" v={h?.htf_bias ?? thesis?.bias ?? "—"} />
        <Row k="Resistance" v={list(lv.resistance)} />
        <Row k="Support" v={list(lv.support)} />
        <Row k="Breakout above" v={num(lv.breakout)} />
        <Row k="Invalidation" v={num(lv.invalidation)} />
        {lv.range_high != null && <Row k="Range" v={`${num(lv.range_low)} – ${num(lv.range_high)}`} />}
      </dl>

      {!!h?.setups_forming?.length && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Taking shape</div>
          <ul className="mt-1.5 space-y-1 text-[13px] text-white/70">
            {h.setups_forming.map((s, i) => (
              <li key={i}>
                <Badge tone={biasTone(s.direction)}>{s.direction}</Badge> {s.setup_id} near {num(s.level)} — needs {s.needs}
                {s.est_score != null && <span className="text-white/45"> (est. {s.est_score}/100)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">TradingView alerts live on this coin</div>
        {alerts.length ? (
          <ul className="mt-1.5 space-y-1.5 text-[13px]">
            {alerts.map((a) => (
              <li key={a.alert_id} className="flex items-start gap-2">
                <Badge tone={a.action === "ENTER" ? biasTone(a.direction) : a.action === "EXIT" ? "amber" : "gray"}>
                  {a.action === "ENTER" ? `${a.direction} trigger` : a.action === "EXIT" ? "trade level" : "level watch"}
                </Badge>
                <span className="font-mono text-white/85">{a.condition === "cross_up" ? "↑" : "↓"} {num(a.trigger_price)}</span>
                <span className="line-clamp-2 text-white/50">{a.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] text-white/45">None right now.</p>
        )}
      </div>
    </Card>
  );
}

function SignalCard({ s, max }: { s: LevSignal; max?: Record<string, number> }) {
  // Components are numbers, but the desk sometimes stores a group (e.g. penalties: {} or {chasing: -10}).
  // Never render a raw object — React crashes the whole page on it. Sum groups; drop empty ones.
  const comps = Object.entries((s.confidence_components ?? {}) as Record<string, unknown>)
    .map(([k, v]): [string, number | string | null] => {
      if (typeof v === "number" || typeof v === "string") return [k, v];
      if (v && typeof v === "object") {
        const vals = Object.values(v as Record<string, unknown>).map(Number).filter((x) => Number.isFinite(x));
        return [k, vals.length ? vals.reduce((a, b) => a + b, 0) : null];
      }
      return [k, null];
    })
    .filter(([, v]) => v !== null && v !== 0 && v !== "");
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <strong className="text-[15px] text-white">{s.asset}</strong>
          <Badge tone={biasTone(s.direction)}>{s.direction}</Badge>
          <Badge tone={signalTone(s.status)}>{s.status}</Badge>
        </div>
        <Badge tone={gradeTone(s.confidence_grade)}>grade {s.confidence_grade} · {num(s.confidence_score, 0)}/100</Badge>
      </div>
      <div className="mt-1 text-[12.5px] text-white/50">{s.setup_id}{s.timeframe ? ` · ${s.timeframe}` : ""}</div>
      {s.trigger_condition && <p className="mt-2 text-[13.5px] text-white/80"><span className="text-white/45">Trigger: </span>{s.trigger_condition}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
        <Cell k="Entry" v={num(s.entry)} />
        <Cell k="Stop" v={num(s.stop)} />
        <Cell k={`TP1 (${num(s.rr_tp1, 1)}R)`} v={num(s.tp1)} />
        <Cell k="Size" v={s.quantity != null ? `${num(s.quantity, 4)} (${money(s.notional)})` : "—"} />
        <Cell k="Leverage · margin" v={s.leverage != null ? `${num(s.leverage, 0)}x · ${money(s.margin)}` : "—"} />
        <Cell k="Risk $" v={money(s.risk_dollars)} />
        <Cell k="R : R" v={fmtRR(s.rr_tp1)} />
        <Cell k="Account % (stop / TP1)" v={s.risk_percent != null ? `${fmtPct(-Number(s.risk_percent))} / ${fmtPct(Number(s.risk_percent) * Number(s.rr_tp1 ?? 0))}` : "—"} />
      </div>
      {(s.tp2 || s.tp3) && <div className="mt-2 text-[12.5px] text-white/50">Runner targets: {[s.tp2, s.tp3].filter(Boolean).map((x) => num(x)).join(" · ")}</div>}

      {!!comps.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {comps.map(([k, v]) => (
            <span key={k} className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/60">
              {(COMPONENT_LABELS[k] ?? k.replace(/_/g, " ")).toLowerCase()} {v}{max?.[k] ? `/${max[k]}` : ""}
            </span>
          ))}
        </div>
      )}
      {s.reasoning && <p className="mt-3 text-[13px] leading-relaxed text-white/70"><span className="text-white/45">Why: </span>{s.reasoning}</p>}
      {s.evidence_against && <p className="mt-1.5 text-[13px] leading-relaxed text-white/70"><span className="text-white/45">Wrong if: </span>{s.evidence_against}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Mono>{s.signal_id}</Mono>
        {s.expires_at && <Mono>· expires {when(s.expires_at)}</Mono>}
        <Badge tone={signalLabel(s) === "DESK ALERT" ? "green" : "gray"}>{signalLabel(s)}</Badge>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.04] pb-1.5">
      <dt className="text-white/45">{k}</dt>
      <dd className="text-right font-mono text-white/80">{v}</dd>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className="mt-0.5 font-mono text-white/90">{v}</div>
    </div>
  );
}

function R({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-white/40">—</span>;
  const n = Number(v);
  return <span className={`font-mono ${n > 0 ? "text-accent-green" : n < 0 ? "text-rose-300" : "text-white/70"}`}>{n > 0 ? "+" : ""}{n.toFixed(2)}R</span>;
}
