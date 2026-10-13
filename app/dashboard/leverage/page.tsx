import { fmtPct, fmtRR, getLeverageDesk, signalLabel, tradeMetrics, type LevHourly, type LevSignal } from "@/lib/moonbag/desk";
import type { LivePrice as LP } from "@/lib/moonbag/prices";
import type { DailyThesis, Trade } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { getLossJournal } from "@/lib/moonbag/lossJournal";
import { getLimits } from "@/lib/moonbag/limits";
import { getBoard, tradingWindow } from "@/lib/moonbag/board";
import { Board, type APlus } from "../_components/Board";
import { Bars, DivergingBars, LevelLadder, Meter, Sparkline } from "../_components/charts";
import { LiveMetric, LivePrice, TradeRail, type Stored } from "../_components/LivePrice";
import { best, cryptoSetFrom, loadLive, storedOf } from "../_components/live";
import { DataNotice } from "../_components/Notice";
import {
  Badge, Card, Cell, DocText, Empty, Expander, KV, LongText, Id, Mono, Note, PageHeader, RMult, Section, Stat, Table, Tile, Unit, Updated,
  ago, biasGlyph, biasTone, gradeTone, list, money, money0, num, px, px2, when, whenShort,
} from "../_components/ui";

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

const signalTone = (s: string) =>
  s === "armed" ? "cyan" : s === "triggered" || s === "taken" ? "green" : s === "watching" ? "amber" : "gray";

export default async function LeveragePage() {
  const { data, error } = await load(getLeverageDesk);
  if (!data) return <DataNotice error={error} />;

  const { strategy, risk, equity, startingEquity, milestone, latest, signals, alerts, openTrades, closedTrades } = data;
  const rules = (strategy?.rules ?? {}) as Record<string, unknown>;
  const model = (strategy?.confidence_model ?? {}) as { components?: Record<string, number>; penalties?: Record<string, number>; grades?: Record<string, number> };
  const liveSetups = signals.filter((s) => ["watching", "armed", "triggered", "taken"].includes(s.status) && !s.outcome);
  const resolved = signals.filter((s) => s.outcome);
  const progress = milestone ? Math.max(0, Math.min(100, ((equity - startingEquity) / (milestone - startingEquity)) * 100)) : 100;
  const lastRun = data.hourly[0]?.ts;
  const stale = lastRun ? Date.now() - new Date(lastRun).getTime() > 2.5 * 3600_000 : true;
  const ladder = Array.isArray(rules.milestones) ? (rules.milestones as number[]) : [240, 1000, 10000, 100000, 1000000];
  const riskPct = Number(risk?.risk_per_trade_pct ?? 2);
  const seriesFor = (asset: string) => data.hourly.filter((h) => h.asset === asset).slice(0, 24).reverse().map((h) => Number(h.price));
  const compMax = Math.max(1, ...Object.values(model.components ?? {}).map((v) => (typeof v === "number" ? v : 0)));

  // Live prices (Coinbase spot; BloFin perps track it within a few dollars) for every coin on this page.
  const cryptoSet = cryptoSetFrom(data.universe.map((u) => u.asset), Object.keys(latest));
  const journal = await getLossJournal(12).catch(() => null);
  const limits = await getLimits().catch(() => null);
  const board = await getBoard().catch(() => null);
  const win = tradingWindow();
  // A+ setups — only from strategies with a positive record (backtest or resolved signals).
  const paperScore = limits?.scoreboard.find((x) => x.origin === "paper");
  const limitRecord = `limit-sweep recipe · backtest +0.13R/trade (278) · paper ${paperScore?.closed ? `${paperScore.closed} closed, ${Number(paperScore.avg_r ?? 0).toFixed(2)}R avg` : "just started"}`;
  const aplus: APlus[] = [];
  for (const r of [...(board?.core ?? []), ...(board?.movers ?? [])]) {
    for (const [side, p] of [["long", r.long_plan], ["short", r.short_plan]] as const) {
      if (p && p.grade === "A+") aplus.push({ key: `b-${r.asset}-${side}`, coin: r.asset, side, entry: p.entry, stop: p.stop, tp1: p.tp1, rr: p.rr, strategy: "Range-edge limit", record: limitRecord });
    }
  }
  for (const o of limits?.open ?? []) {
    if (o.origin === "paper" && o.grade === "A+" && !aplus.some((x) => x.coin === o.symbol && x.side === o.direction)) {
      aplus.push({ key: `l-${o.limit_id}`, coin: o.symbol, side: o.direction, entry: Number(o.limit_price), stop: Number(o.stop), tp1: o.tp1 == null ? null : Number(o.tp1), rr: o.plan_r == null ? null : Number(o.plan_r), strategy: "Paper limit (24h order)", record: limitRecord });
    }
  }
  for (const sg of signals) {
    if (sg.outcome || !["watching", "armed"].includes(sg.status) || Number(sg.confidence_grade) < 5) continue;
    const st = data.setups.find((x) => x.setup_id === sg.setup_id);
    const rec = st ? (Number(st.bt_avg_r) > 0 || Number(st.signal_avg_r) > 0) : false;
    if (!rec) continue;
    aplus.push({ key: `s-${sg.signal_id}`, coin: sg.asset, side: sg.direction, entry: Number(sg.entry), stop: Number(sg.stop), tp1: sg.tp1 == null ? null : Number(sg.tp1), rr: sg.rr_tp1 == null ? null : Number(sg.rr_tp1), strategy: st?.name ?? String(sg.setup_id), record: `backtest ${st?.bt_avg_r == null ? "—" : `${Number(st.bt_avg_r).toFixed(2)}R`} · signals ${st?.resolved ?? 0} resolved ${st?.signal_avg_r == null ? "" : `${Number(st.signal_avg_r).toFixed(2)}R`}` });
  }
  const boardUpdated = [...(board?.core ?? []), ...(board?.movers ?? [])].map((r) => r.updated_at).sort().pop() ?? null;
  const live = await loadLive(["BTC", "ETH", ...openTrades.map((t) => t.symbol), ...liveSetups.map((x) => x.asset), ...alerts.map((a) => a.asset)], cryptoSet);
  const storedFor = (asset: string): Stored | undefined => (latest[asset] ? storedOf(latest[asset].price, latest[asset].ts) : undefined);

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      <PageHeader
        title="Leverage desk"
        kicker="BloFin · BTC, ETH, SOL + top 5 movers"
        sub="Moonbag checks the market every hour and records it here. You place every order. No trade is the default."
        right={
          <>
            <Badge tone={openTrades.length ? "green" : "gray"} dot>{openTrades.length} open trade{openTrades.length === 1 ? "" : "s"}</Badge>
            <Badge tone={liveSetups.length ? "cyan" : "gray"} dot>{liveSetups.length} setup{liveSetups.length === 1 ? "" : "s"} watched</Badge>
          </>
        }
      />

      {board && <Board core={board.core} movers={board.movers} weekPlan={board.weekPlan} window={win} aplus={aplus} updatedAt={boardUpdated} />}

      {/* ------------------------------------------------ KPIs */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <Stat
            label="BloFin account"
            value={money(equity)}
            sub={<><Updated label="balance" at={data.equityReportedAt} cadenceH={30} verb="reported by Grokbot" /> {milestone ? `· ${num(progress, 1)}% of the way from ${money0(startingEquity)} to ${money0(milestone)}` : "· all milestones reached"}</>}
            meter={
              milestone ? (
                <Meter value={equity - startingEquity} max={milestone - startingEquity} tone="green" height={8} labels={[money0(startingEquity), <>next milestone <b className="font-mono text-white/75">{money0(milestone)}</b></>]} />
              ) : undefined
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11.5px] tabular-nums text-white/40">
            {ladder.map((m, i) => (
              <span key={m} className="inline-flex items-center gap-1.5">
                <span className={m <= equity ? "text-accent-green" : m === milestone ? "text-white/80" : ""}>{money0(m)}</span>
                {i < ladder.length - 1 && <span className="text-white/25">→</span>}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <Stat
            label="Risk per trade"
            size="md"
            value={<>{num(riskPct, 1)}%<Unit>≈ {money((equity * riskPct) / 100)}</Unit></>}
            sub={`Max ${num(risk?.max_leverage, 0)}x · margin cap ${money(risk?.max_margin_dollars)} · hold ≤ ${num(risk?.max_hold_days, 0)} days`}
          />
        </Card>
        <Card tone={stale ? "warn" : undefined}>
          <Stat
            label="Hourly watch"
            size="sm"
            value={lastRun ? ago(lastRun) : "not yet run"}
            tone={stale ? "amber" : undefined}
            right={<Badge tone={stale ? "amber" : "green"} dot>{stale ? "late" : "running"}</Badge>}
            sub={<><Updated at={lastRun} cadenceH={2} verb="last entry" /> — {stale ? "no hourly entry in the last 2½ hours: the stored prices and levels below are old; check the scheduled task. Prices marked live are still current." : "running. Pings DESK ALERTs (grade 3+ that pass the checklist)."}</>}
          />
        </Card>
      </div>

      {/* ------------------------------------------------ current thesis + levels */}
      <div className="grid gap-3 lg:grid-cols-2">
        {["BTC", "ETH"].map((a) => (
          <AssetCard
            key={a}
            asset={a}
            h={latest[a]}
            live={live[a]}
            series={seriesFor(a)}
            thesis={data.theses.find((t) => t.asset === a)}
            alerts={alerts.filter((x) => x.asset === a && x.status === "active")}
          />
        ))}
      </div>

      {/* ------------------------------------------------ live signals */}
      <Card title="Setups Moonbag is watching" right={<Badge tone="gray">{liveSetups.length} open</Badge>}>
        {liveSetups.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{liveSetups.map((s) => <SignalCard key={s.signal_id} s={s} max={model.components} live={live[s.asset]} stored={storedFor(s.asset)} />)}</div>
        ) : (
          <Empty>No setup forming right now. That is the normal state — Moonbag is waiting for price to reach a level.</Empty>
        )}
      </Card>

      {/* ------------------------------------------------ open trades */}
      <Card title="Open BloFin trades" right={openTrades.length ? <Mono>{openTrades.length} open · risk {money(openTrades.reduce((a, t) => a + Number(t.risk_dollars ?? 0), 0))}</Mono> : undefined}>
        {openTrades.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {openTrades.map((t) => <OpenTradeTile key={t.trade_id} t={t} live={live[t.symbol]} stored={storedFor(t.symbol)} />)}
          </div>
        )}
        {openTrades.length > 0 && <Section title="Every column" right={<span>plan, size and what has been banked</span>}><span /></Section>}
        <Table
          head={["Trade", "Side", "R : R", "Account % (stop / target)", "Entry", "Stop (orig / now)", "Targets", "Risk $", "Still open", "Banked", "Size · Lev", "Opened"]}
          align={["l", "l", "r", "r", "r", "r", "l", "r", "r", "r", "l", "l"]}
          minWidth={1180}
          rows={openTrades.map((t) => { const m = tradeMetrics(t); const riskFree = t.direction === "short" ? Number(t.current_stop) <= Number(t.entry) : Number(t.current_stop) >= Number(t.entry); return [
            <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id></span>,
            <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
            <strong key="rr" className="text-white">{fmtRR(m.rr)}</strong>,
            <span key="pc"><span className={Number(m.riskPct) < 0 ? "text-rose-300" : "text-accent-green"}>{fmtPct(m.riskPct)}</span> <span className="text-white/30">/</span> <span className="text-accent-green">{fmtPct(m.rewardPct)}</span></span>,
            num(t.entry),
            <span key="st">{num(t.stop)} <span className="text-white/30">/</span> {num(t.current_stop)}{riskFree && <> <Badge tone="green">risk-free</Badge></>}</span>,
            <span key="tg" className="font-mono tabular-nums">{([[t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp1_qty], [t.current_tp2 ?? t.tp2, t.current_tp2_qty], [t.current_tp3 ?? t.tp3, t.current_tp3_qty]] as [unknown, unknown][])
              .filter(([px]) => px != null)
              .map(([px, q]) => `${num(px)}${q != null && Number(t.qty_open ?? t.quantity) > 0 ? ` (${num((100 * Number(q)) / Number(t.qty_open ?? t.quantity), 0)}%)` : ""}`)
              .join(" · ") || "—"}{t.current_tp1_qty != null && <div className="text-[11.5px] text-accent-green/80">rest rides — runner</div>}</span>,
            money(t.risk_dollars),
            <span key="qo">{num(t.qty_open ?? t.quantity, 4)}{t.quantity ? <span className="text-white/45"> ({num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)</span> : null}</span>,
            <span key="bk" className={Number(t.banked_pnl) > 0 ? "text-accent-green" : Number(t.banked_pnl) < 0 ? "text-rose-300" : "text-white/50"}>{Number(t.banked_pnl) ? `${Number(t.banked_pnl) > 0 ? "+" : ""}${money(t.banked_pnl)}` : "—"}</span>,
            <span key="sz" className="font-mono tabular-nums text-white/75">{money(t.position_notional)} · {num(t.leverage)}x · m {money(t.margin)}</span>,
            <span key="op" className="whitespace-nowrap text-white/60">{when(t.opened_at)}</span>,
          ]; })}
          empty="No open trade. Tell Moonbag (or Grokbot) when you take one and it shows up here with its next levels."
        />
      </Card>

      {/* ------------------------------------------------ limit orders (Stavros, 2026-10-12) */}
      {limits && (
        <Card
          title="Open limits"
          sub="Your resting BloFin limit orders (Grok records them; each has a TradingView alert at its price) and Moonbag's paper limits testing the backtested limit recipe."
          right={<Badge tone={limits.open.some((o) => o.origin !== "paper") ? "cyan" : "gray"}>{limits.open.filter((o) => o.origin !== "paper").length} yours · {limits.open.filter((o) => o.origin === "paper").length} paper</Badge>}
        >
          <Table
            head={["Coin", "Side", "Limit", "Stop", "TP1", "R : R", "Size", "Status", "Expires"]}
            align={["l", "l", "r", "r", "r", "r", "r", "l", "l"]}
            minWidth={820}
            rows={limits.open.map((o) => [
              <span key="c"><strong className="text-white">{o.symbol}</strong>{" "}<Badge tone={o.origin === "paper" ? "gray" : "cyan"}>{o.origin === "paper" ? "paper" : o.origin === "moonbag" ? "Moonbag pick" : "yours"}</Badge><br /><Id>{o.limit_id}</Id></span>,
              <Badge key="d" tone={biasTone(o.direction)}>{biasGlyph(o.direction)} {o.direction === "long" ? "buy" : "sell"}</Badge>,
              <span key="l" className="font-mono tabular-nums text-white">{px2(o.limit_price)}</span>,
              <span key="s" className="font-mono tabular-nums text-rose-300">{px2(o.current_stop ?? o.stop)}</span>,
              <span key="t" className="font-mono tabular-nums text-accent-green">{px2(o.tp1)}</span>,
              <strong key="r" className="text-white">{fmtRR(o.plan_r == null ? null : Number(o.plan_r))}</strong>,
              <span key="q" className="text-white/70">{o.quantity != null ? num(o.quantity, 4) : "—"}{o.leverage != null ? ` · ${num(o.leverage, 0)}x` : ""}</span>,
              <Badge key="st" tone={o.status === "touched" ? "amber" : "gray"}>{o.status === "touched" ? "touched — filled?" : "working"}</Badge>,
              <span key="e" className="whitespace-nowrap text-white/60">{o.expires_at ? whenShort(o.expires_at) : "until cancelled"}</span>,
            ])}
            empty="No resting limits. Tell Grok when you place one and it shows up here with a TradingView alert at its price."
          />
          {limits.scoreboard.length > 0 && (
            <Section title="Limit scoreboard" right={<span>feeds the Saturday review</span>}>
              <div className="grid gap-2 sm:grid-cols-3">
                {limits.scoreboard.map((b) => (
                  <div key={b.origin} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[13px]">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/45">{b.origin === "paper" ? "Moonbag paper" : b.origin === "moonbag" ? "Moonbag picks you placed" : "Your own limits"}</div>
                    <div className="mt-1 text-white/85">{b.placed} placed · {b.filled} filled · {b.closed} closed</div>
                    <div className="text-white/70">{b.targets} target · {b.breakevens} break-even · {b.stops} stop</div>
                    <div className={Number(b.avg_r) > 0 ? "text-accent-green" : Number(b.avg_r) < 0 ? "text-rose-300" : "text-white/50"}>avg {b.avg_r == null ? "—" : `${Number(b.avg_r).toFixed(2)}R`} · total {b.total_r == null ? "—" : `${Number(b.total_r).toFixed(1)}R`}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </Card>
      )}

      {/* ------------------------------------------------ loss journal (Stavros + Grok, 2026-10-12) */}
      {journal && (
        <Card
          title="Loss journal"
          sub="Every loss and near-miss, why it happened, and the check that catches it next time. Grok and the desk read this before giving trade inputs."
          right={<Badge tone={journal.patterns.length ? "amber" : "gray"}>{journal.entries.length} entries</Badge>}
        >
          {journal.patterns.length > 0 && (
            <Section title="Pre-trade checks" right={<span>most repeated first</span>}>
              <div className="grid gap-2 md:grid-cols-2">
                {journal.patterns.map((p) => (
                  <div key={p.tag} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={p.losses ? "red" : "amber"}>{p.tag.replace(/_/g, " ")}</Badge>
                      <span className="text-[12px] text-white/50">{p.times}x{p.losses ? ` · ${p.losses} loss${p.losses > 1 ? "es" : ""} ${money(p.cost_usd)}` : " · no cost yet"}</span>
                    </div>
                    {p.latest_check && <p className="mt-1.5 text-[13px] leading-snug text-white/80">{p.latest_check}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="Entries" right={<span>newest first</span>}>
            <Table
              head={["Date", "Trade", "Result", "Why", "Lesson"]}
              align={["l", "l", "r", "l", "l"]}
              minWidth={760}
              rows={journal.entries.map((e) => [
                <span key="d" className="whitespace-nowrap text-white/60">{e.trade_date ?? whenShort(e.created_at)}</span>,
                <span key="t"><strong className="text-white">{e.symbol ?? "—"}</strong>{e.direction ? ` ${e.direction}` : ""} <Badge tone={e.kind === "loss" ? "red" : "amber"}>{e.kind === "loss" ? "loss" : "near-miss"}</Badge></span>,
                <span key="r" className={e.pnl != null && Number(e.pnl) < 0 ? "text-rose-300" : "text-white/50"}>{e.pnl != null ? money(e.pnl) : "—"}{e.r_multiple != null ? ` · ${num(e.r_multiple)}R` : ""}</span>,
                <span key="w" className="text-white/80">{e.why_lost ?? e.what_happened}</span>,
                <span key="l" className="text-white/70">{e.lesson ?? "—"}</span>,
              ])}
              empty="No losses journaled yet."
            />
          </Section>
        </Card>
      )}

      {/* ------------------------------------------------ strategy */}
      <Card
        title={strategy ? `Current strategy — v${strategy.version}` : "Current strategy"}
        right={strategy && <Mono>updated {when(strategy.created_at)}</Mono>}
      >
        {strategy ? (
          <>
            <LongText text={strategy.summary} max={260} className="text-[14px] leading-relaxed text-white/85" />
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <Section title="Rules">
                <KV
                  rows={[
                    ["Coins", Array.isArray(rules.assets) ? (rules.assets as string[]).join(", ") : "BTC, ETH"],
                    ["Positions at once", num(rules.max_positions, 0)],
                    ["Trade only at grade", `${num(rules.min_grade_to_trade, 0)} or 5`],
                    ["Risk by grade", Object.entries((rules.risk_pct_by_grade as Record<string, number>) ?? {}).sort().reverse().map(([g, p]) => `grade ${g} → ${p}%`).join(" · ") || "—"],
                    ["Minimum reward to TP1", `${num(rules.min_rr_tp1, 1)}R (aim ${num(rules.target_rr_tp1, 1)}R+)`],
                    ["At TP1", `close ${num(Number(rules.tp1_take_fraction ?? 0.5) * 100, 0)}%, ${String(rules.after_tp1 ?? "stop to breakeven")}`],
                    ["Time stop", `${num(rules.max_hold_hours, 0)} hours`],
                    ["Core hours", String(rules.core_hours ?? "—")],
                    ["Levels from / trigger on", `${Array.isArray(rules.level_timeframes) ? (rules.level_timeframes as string[]).join(", ") : "4h, 1D"} / ${String(rules.trigger_timeframe ?? "1h")}`],
                    ["After 2 losses in a row", "half risk until a win"],
                  ]}
                />
              </Section>
              <Section title="How the confidence score is built" right={<span>points per component</span>}>
                <Bars
                  tone="cyan"
                  max={compMax}
                  labelWidth="minmax(120px, 45%)"
                  items={Object.entries(model.components ?? {}).map(([k, pts]) => ({ label: COMPONENT_LABELS[k] ?? k, value: typeof pts === "number" ? pts : null }))}
                />
                <Note>
                  Penalties: {Object.entries(model.penalties ?? {}).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ") || "—"}.
                  {" "}Grades: {Object.entries(model.grades ?? {}).sort((a, b) => Number(b[0]) - Number(a[0])).filter(([, v]) => Number(v) > 0).map(([g, v]) => `${v}+ = ${g}`).join(" · ")}.
                </Note>
              </Section>
            </div>

            <div className="mt-4">
              <DocText summary="Read the full strategy" text={strategy.markdown} />
            </div>
            {strategy.change_reason && <LongText text={strategy.change_reason} label="Why this version:" max={160} className="mt-3 text-[12.5px] leading-snug text-white/50" />}
          </>
        ) : (
          <Empty>No strategy saved yet.</Empty>
        )}
      </Card>

      {/* ------------------------------------------------ playbook */}
      <Card title="Playbook — setups and their record">
        <Table
          head={["Setup", "Status", "Works in", "Backtest", "Backtest avg R", "Signals graded", "Signal avg R"]}
          align={["l", "l", "l", "l", "r", "l", "r"]}
          rows={data.setups.map((s) => [
            <span key="n"><strong className="text-white">{s.name}</strong><br /><Id>{s.setup_id}</Id></span>,
            <Badge key="s" tone={s.status === "live" ? "green" : s.status === "paper" ? "cyan" : s.status === "retired" ? "red" : "amber"} dot>{s.status}</Badge>,
            s.best_regime ?? "—",
            s.bt_trades != null ? <span key="bt" className="font-mono tabular-nums">{s.bt_trades} trades · {num(s.bt_win_rate, 0)}% wins <span className="text-white/45">· {s.bt_asset} {s.bt_timeframe}</span></span> : "—",
            <RMult key="b" v={s.bt_avg_r} />,
            s.resolved ? <span key="g" className="font-mono tabular-nums">{s.resolved} <span className="text-white/45">({num(s.win_rate_pct, 0)}% wins, {s.taken ?? 0} taken)</span></span> : <span key="g" className="font-mono text-white/45">0</span>,
            <RMult key="r" v={s.signal_avg_r} />,
          ])}
          empty="No setups in the playbook yet."
        />
        {!!data.playbook.length && (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {data.playbook.map((p) => (
              <Expander key={p.setup_id} summary={<span><strong className="text-white/90">{p.name}</strong> <span className="text-white/45">— rules</span></span>}>
                <div className="space-y-1.5 text-[13px] leading-snug text-white/70">
                  {p.description && <p>{p.description}</p>}
                  <KV rows={[["Entry", <span key="e" className="font-sans text-left text-white/80">{p.entry_rule}</span>], ["Stop", <span key="s" className="font-sans text-white/80">{p.stop_rule}</span>], ["Target", <span key="t" className="font-sans text-white/80">{p.target_rule}</span>]]} />
                  {p.notes && <p className="text-white/55"><span className="text-white/45">Evidence so far: </span>{p.notes}</p>}
                </div>
              </Expander>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ calibration + results */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Is the confidence score honest?" sub="Higher grades should win more and earn more R. If they don't, the weekly review tightens the score.">
          {data.calibration.some((c) => c.resolved > 0) && (
            <Bars
              className="mb-4"
              max={100}
              labelWidth="minmax(90px, 30%)"
              format={(v) => `${num(v, 0)}%`}
              items={data.calibration.filter((c) => c.resolved > 0).map((c) => ({ label: `grade ${c.confidence_grade ?? "—"}`, sub: `${c.resolved} graded`, value: c.win_rate_pct, tone: gradeTone(c.confidence_grade) }))}
            />
          )}
          <Table
            head={["Grade", "Signals", "Graded", "Win rate", "Avg R", "Taken"]}
            align={["l", "r", "r", "r", "r", "r"]}
            minWidth={0}
            rows={data.calibration.map((c) => [
              <Badge key="g" tone={gradeTone(c.confidence_grade)}>grade {c.confidence_grade ?? "—"}</Badge>,
              c.signals,
              c.resolved,
              c.resolved ? `${num(c.win_rate_pct, 0)}%` : "—",
              <RMult key="r" v={c.avg_r} />,
              c.taken,
            ])}
            empty="No graded signals yet. Every signal is followed after it triggers, taken or not, so this table fills in on its own."
          />
        </Card>
        <Card title="Closed BloFin trades" right={closedTrades.length ? <Mono>last {Math.min(10, closedTrades.length)}</Mono> : undefined}>
          {closedTrades.length > 0 && (
            <DivergingBars
              className="mb-4"
              labelWidth="minmax(96px, 36%)"
              format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`}
              items={closedTrades.slice(0, 10).map((t) => ({ label: `${t.symbol} ${t.direction}`, sub: when(t.closed_at), value: t.r_multiple == null ? null : Number(t.r_multiple) }))}
            />
          )}
          <Table
            head={["Coin", "Side", "Planned R : R", "Risked", "Result", "R", "P&L", "Lev", "Closed"]}
            align={["l", "l", "r", "r", "r", "r", "r", "r", "l"]}
            dense
            rows={closedTrades.slice(0, 10).map((t) => { const m = tradeMetrics(t); return [
              <strong key="s" className="text-white">{t.symbol}</strong>,
              <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
              fmtRR(m.rr),
              <span key="rk" className="text-rose-300">{fmtPct(m.riskPct)}</span>,
              <span key="rs" className={Number(m.resultPct) >= 0 ? "text-accent-green" : "text-rose-300"}>{fmtPct(m.resultPct, 2)}</span>,
              <RMult key="r" v={t.r_multiple} />,
              <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
              `${num(t.leverage, 0)}x`,
              <span key="c" className="whitespace-nowrap text-white/60">{when(t.closed_at)}</span>,
            ]; })}
            empty="No closed trades yet."
          />
        </Card>
      </div>

      <Card title="24-hour lookbacks — what could have gone better">
        {data.lookbacks.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.lookbacks.map((l) => (
              <Tile key={l.trade_id} tone={l.verdict === "well_managed" ? "accent" : l.verdict === "lucky" || l.verdict === "should_have_skipped" ? "warn" : undefined}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[14px] text-white">{l.symbol}</strong>
                    <Badge tone={l.verdict === "well_managed" ? "green" : l.verdict === "lucky" || l.verdict === "should_have_skipped" ? "red" : "amber"}>{l.verdict.replace(/_/g, " ")}</Badge>
                  </div>
                  <Id>{l.trade_id}</Id>
                </div>
                <DivergingBars
                  className="mt-3"
                  labelWidth="minmax(120px, 40%)"
                  format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`}
                  items={[
                    { label: "Got", value: l.r_realized },
                    { label: "Original plan would pay", value: l.r_if_held_to_plan },
                    { label: "Best possible", value: l.r_best_in_window },
                  ]}
                />
                <div className="mt-3 space-y-1.5">
                  <LongText text={l.what_went_well} label="Did well:" max={140} className="text-[13px] leading-snug text-white/75" />
                  <LongText text={l.could_do_better} label="Could do better:" max={140} className="text-[13px] leading-snug text-white/75" />
                  <LongText text={l.suggestion} label="Next time:" max={140} className="text-[13px] leading-snug text-white/75" />
                </div>
                <p className="mt-2 text-[12.5px] text-white/55">
                  {Number(l.dollars_left_on_table) > 0 && <>Left on the table <span className="font-mono text-rose-300">{money(l.dollars_left_on_table)}</span>. </>}
                  {Number(l.dollars_saved) > 0 && <>Saved by your management <span className="font-mono text-accent-green">{money(l.dollars_saved)}</span>. </>}
                  {Array.isArray(l.rules_broken) && l.rules_broken.length ? <>Rules broken: {l.rules_broken.join("; ")}.</> : <>All rules followed.</>}
                </p>
              </Tile>
            ))}
          </div>
        ) : (
          <Empty>No lookbacks yet. About 24 hours after each trade closes, Moonbag reviews what price did next and writes it here; a weekly breakdown follows on Saturday.</Empty>
        )}
      </Card>

      <Card title="Past signals and what happened" right={<Mono>last {Math.min(15, resolved.length)} of {resolved.length}</Mono>}>
        <Table
          head={["Signal", "Coin", "Side", "Setup", "Score", "Entry / stop / TP1", "Outcome", "Lesson"]}
          align={["l", "l", "l", "l", "l", "r", "l", "l"]}
          minWidth={960}
          rows={resolved.slice(0, 15).map((s) => [
            <span key="i"><span className="whitespace-nowrap text-white/70">{when(s.created_at)}</span><br /><Id>{s.signal_id}</Id></span>,
            <strong key="a" className="text-white">{s.asset}</strong>,
            <Badge key="d" tone={biasTone(s.direction)}>{biasGlyph(s.direction)} {s.direction}</Badge>,
            <Mono key="su" className="text-white/70">{s.setup_id}</Mono>,
            <Badge key="g" tone={gradeTone(s.confidence_grade)}>{num(s.confidence_score, 0)} · g{s.confidence_grade}</Badge>,
            <span key="pl" className="whitespace-nowrap">{num(s.entry)} <span className="text-white/30">/</span> {num(s.stop)} <span className="text-white/30">/</span> {num(s.tp1)}</span>,
            <span key="o" className="whitespace-nowrap"><Badge tone={s.outcome === "tp1" ? "green" : s.outcome === "stop" ? "red" : "gray"}>{s.outcome?.replace("_", " ")}</Badge> <RMult v={s.outcome_r} /> {s.status === "taken" && <Badge tone="green">taken</Badge>}</span>,
            <LongText key="l" text={s.lesson ?? s.status_reason ?? "—"} max={110} className="min-w-[200px] text-[12.5px] leading-snug text-white/65" />,
          ])}
          empty="No finished signals yet."
        />
      </Card>

      {/* ------------------------------------------------ learning */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Journal — one line per close or test">
          {data.journal.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {data.journal.map((j) => (
                <li key={j.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="gray">{j.kind}</Badge><Mono>{when(j.created_at)}</Mono></div>
                  <div className="mt-1.5 space-y-1">
                    <LongText text={j.thesis} label="Thesis:" max={150} className="text-[13px] leading-snug text-white/75" />
                    <LongText text={j.result} label="Result:" max={150} className="text-[13px] leading-snug text-white/75" />
                    <LongText text={j.mistake} label="Mistake:" max={150} className="text-[13px] leading-snug text-white/75" />
                    <LongText text={j.rule_change} label="Rule change:" max={150} className="text-[13px] leading-snug text-accent-green/90" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No journal lines yet.</Empty>
          )}
        </Card>
        <Card title="Latest backtests" sub="Fees included, one position at a time. Under 20 trades is not proof of anything.">
          <Table
            head={["Setup", "Coin · TF", "Trades", "Win %", "Avg R", "Max DD", "Notes"]}
            align={["l", "l", "r", "r", "r", "r", "l"]}
            dense
            rows={data.backtests.slice(0, 14).map((b) => [
              <Mono key="s" className="text-white/75">{b.setup_id ?? b.engine_code ?? "custom"}</Mono>,
              <span key="a" className="whitespace-nowrap">{b.asset} · {b.timeframe}</span>,
              b.n_trades,
              num(b.win_rate, 0),
              <RMult key="r" v={b.avg_r} />,
              `${num(b.max_drawdown_r, 1)}R`,
              <LongText key="n" text={b.notes ?? "—"} max={80} className="min-w-[160px] text-[12.5px] leading-snug text-white/55" />,
            ])}
            empty="No backtests saved yet."
          />
        </Card>
      </div>

      <Card title="Hourly log" right={<Mono>last 24 entries · Phoenix time</Mono>}>
        <Table
          head={["Time", "Coin", "Price", "Bias (1h / higher)", "Regime", "Note"]}
          align={["l", "l", "r", "l", "l", "l"]}
          dense
          maxHeight={460}
          rows={data.hourly.slice(0, 24).map((h) => [
            <span key="t" className="whitespace-nowrap text-white/70">{when(h.ts)}</span>,
            <strong key="a" className="text-white">{h.asset}</strong>,
            num(h.price),
            <span key="b" className="whitespace-nowrap"><Badge tone={biasTone(h.bias)}>{biasGlyph(h.bias)} {h.bias ?? "—"}</Badge> <Badge tone={biasTone(h.htf_bias)}>{h.htf_bias ?? "—"}</Badge></span>,
            h.regime ?? "—",
            <LongText key="n" text={h.note ?? "—"} max={120} className="min-w-[240px] text-[12.5px] leading-snug text-white/60" />,
          ])}
          empty="The hourly watch hasn't written its first entry yet. It runs at 25 minutes past every hour."
        />
      </Card>
    </div>
  );
}

function AssetCard({ asset, h, live, series, thesis, alerts }: {
  asset: string;
  h?: LevHourly;
  live?: LP;
  series: number[];
  thesis?: DailyThesis;
  alerts: { alert_id: string; condition: string; trigger_price: number | null; direction: string | null; action: string; message: string | null }[];
}) {
  const lv = (h?.levels ?? thesis?.levels ?? {}) as LevHourly["levels"];
  const stored = h ? storedOf(h.price, h.ts) : undefined;
  // Nearest levels are picked around the LIVE price when we have it, so "support" is really below price now.
  const now = best(live, h ? Number(h.price) : null);
  const price = now.price;
  const sup = (lv.support ?? []).map(Number).filter((x) => Number.isFinite(x) && (price == null || x < price)).sort((a, b) => b - a).slice(0, 3);
  const res = (lv.resistance ?? []).map(Number).filter((x) => Number.isFinite(x) && (price == null || x > price)).sort((a, b) => a - b).slice(0, 3);
  const change = series.length >= 2 ? ((series[series.length - 1] - series[0]) / series[0]) * 100 : null;
  const sinceCheck = now.isLive && h && Number(h.price) > 0 ? ((price! - Number(h.price)) / Number(h.price)) * 100 : null;
  return (
    <Card
      title={`${asset} — bias & levels`}
      right={
        <>
          <Badge tone={biasTone(h?.bias ?? thesis?.bias)}>{biasGlyph(h?.bias ?? thesis?.bias)} {h?.bias ?? thesis?.bias ?? "—"}</Badge>
          {h?.regime && <Badge tone="gray">{h.regime}</Badge>}
        </>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <LivePrice symbol={asset} kind="crypto" initial={live} stored={stored} size="hero" showChange />
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[11.5px] tabular-nums text-white/40">
            {h ? (
              <>
                <span>desk check</span>
                <span className="text-white/60">{px(h.price)}</span>
                <span>· {whenShort(h.ts)}</span>
                {sinceCheck != null && <span className={sinceCheck >= 0 ? "text-accent-green/80" : "text-rose-300/80"}>({sinceCheck >= 0 ? "+" : "−"}{Math.abs(sinceCheck).toFixed(2)}% since)</span>}
              </>
            ) : (
              <span>waiting for first hourly entry</span>
            )}
          </div>
        </div>
        {series.length >= 2 && (
          <div className="flex items-end gap-3">
            <div className="text-right text-[11.5px] leading-tight text-white/45">
              last {series.length} hourly checks<br />
              <span className={`font-mono tabular-nums ${change != null && change >= 0 ? "text-accent-green" : "text-rose-300"}`}>{change == null ? "" : `${change >= 0 ? "▲ +" : "▼ −"}${Math.abs(change).toFixed(2)}%`}</span>
            </div>
            <Sparkline points={series} width={140} height={40} />
          </div>
        )}
      </div>
      {h?.note && <LongText text={h.note} max={190} className="mt-3 text-[13.5px] leading-relaxed text-white/75" />}
      {!h && thesis?.primary_scenario && <LongText text={thesis.primary_scenario} max={190} className="mt-3 text-[13.5px] leading-relaxed text-white/75" />}

      {sup.length + res.length >= 2 && <LevelLadder className="mt-3" price={price} below={sup} above={res} live={{ symbol: asset, kind: "crypto", initial: live, stored }} />}

      <KV
        className="mt-2"
        cols={2}
        rows={[
          ["Higher-timeframe bias", <span key="h" className="font-sans"><Badge tone={biasTone(h?.htf_bias ?? thesis?.bias)}>{biasGlyph(h?.htf_bias ?? thesis?.bias)} {h?.htf_bias ?? thesis?.bias ?? "—"}</Badge></span>],
          ["Resistance", list(lv.resistance)],
          ["Support", list(lv.support)],
          ["Breakout above", num(lv.breakout)],
          ["Invalidation", num(lv.invalidation)],
          ...(lv.range_high != null ? ([["Range", `${num(lv.range_low)} – ${num(lv.range_high)}`]] as [string, string][]) : []),
        ]}
      />

      {!!h?.setups_forming?.length && (
        <Section title="Taking shape">
          <ul className="space-y-1.5 text-[13px] text-white/75">
            {h.setups_forming.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={biasTone(s.direction)}>{biasGlyph(s.direction)} {s.direction}</Badge>
                <span><Mono className="text-white/70">{s.setup_id}</Mono> near <span className="font-mono tabular-nums text-white">{num(s.level)}</span> — needs {s.needs}</span>
                {s.est_score != null && <span className="text-white/45">(est. {s.est_score}/100)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="TradingView alerts live on this coin" right={<Badge tone={alerts.length ? "cyan" : "gray"}>{alerts.length} live</Badge>}>
        {alerts.length ? (
          <ul className="space-y-1.5 text-[13px]">
            {alerts.map((a) => (
              <li key={a.alert_id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={a.action === "ENTER" ? biasTone(a.direction) : a.action === "EXIT" ? "amber" : "gray"}>
                    {a.action === "ENTER" ? `${a.direction} trigger` : a.action === "EXIT" ? "trade level" : "level watch"}
                  </Badge>
                  <span className="font-mono tabular-nums text-white/90">{a.condition === "cross_up" ? "↑" : "↓"} {num(a.trigger_price)}</span>
                  {a.trigger_price != null && <span className="inline-flex items-baseline gap-1 text-[12px] text-white/45">away <LiveMetric symbol={asset} kind="crypto" initial={live} stored={stored} metric="distPct" level={a.trigger_price} /></span>}
                </div>
                <LongText text={a.message} max={90} className="mt-0.5 text-[12.5px] leading-snug text-white/55" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-white/45">None right now.</p>
        )}
      </Section>
    </Card>
  );
}

function SignalCard({ s, max, live, stored }: { s: LevSignal; max?: Record<string, number>; live?: LP; stored?: Stored }) {
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
  const label = signalLabel(s);
  const alert = label === "DESK ALERT";
  return (
    <Tile tone={alert ? "accent" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[15px] text-white">{s.asset}</strong>
          <Badge tone={biasTone(s.direction)}>{biasGlyph(s.direction)} {s.direction}</Badge>
          <Badge tone={signalTone(s.status)} dot>{s.status}</Badge>
          <Badge tone={alert ? "green" : "gray"}>{label}</Badge>
        </div>
        <Badge tone={gradeTone(s.confidence_grade)}>grade {s.confidence_grade} · {num(s.confidence_score, 0)}/100</Badge>
      </div>
      <div className="mt-1 text-[12.5px] text-white/50"><Mono className="text-white/60">{s.setup_id}</Mono>{s.timeframe ? ` · ${s.timeframe}` : ""}</div>
      {s.trigger_condition && <LongText text={s.trigger_condition} label="Trigger:" max={150} className="mt-2 text-[13.5px] leading-snug text-white/85" />}

      {/* where price is against this plan, right now */}
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-1.5 text-[12.5px]">
        <span className="text-white/45">now</span>
        <LivePrice symbol={s.asset} kind="crypto" initial={live} stored={stored} size="inline" />
        <span className="text-white/45">to trigger {px(s.trigger_price ?? s.entry)}</span>
        <LiveMetric symbol={s.asset} kind="crypto" initial={live} stored={stored} metric="distPct" level={s.trigger_price ?? s.entry} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cell k="Entry" v={num(s.entry)} />
        <Cell k="Stop" v={num(s.stop)} tone="red" />
        <Cell k={`TP1 (${num(s.rr_tp1, 1)}R)`} v={num(s.tp1)} tone="green" />
        <Cell k="R : R" v={fmtRR(s.rr_tp1)} />
        <Cell k="Size" v={s.quantity != null ? `${num(s.quantity, 4)} (${money(s.notional)})` : "—"} />
        <Cell k="Leverage · margin" v={s.leverage != null ? `${num(s.leverage, 0)}x · ${money(s.margin)}` : "—"} />
        <Cell k="Risk $" v={money(s.risk_dollars)} />
        <Cell k="Account % (stop / TP1)" v={s.risk_percent != null ? `${fmtPct(-Number(s.risk_percent))} / ${fmtPct(Number(s.risk_percent) * Number(s.rr_tp1 ?? 0))}` : "—"} />
      </div>
      {(s.tp2 || s.tp3) && <div className="mt-2 text-[12.5px] text-white/50">Runner targets: <span className="font-mono tabular-nums text-white/70">{[s.tp2, s.tp3].filter(Boolean).map((x) => num(x)).join(" · ")}</span></div>}

      {!!comps.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {comps.map(([k, v]) => (
            <span key={k} className={`rounded-md px-2 py-0.5 font-mono text-[11.5px] ${Number(v) < 0 ? "bg-rose-400/10 text-rose-300" : "bg-white/[0.04] text-white/60"}`}>
              {(COMPONENT_LABELS[k] ?? k.replace(/_/g, " ")).toLowerCase()} {v}{max?.[k] ? `/${max[k]}` : ""}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-1.5">
        <LongText text={s.reasoning} label="Why:" max={160} className="text-[13px] leading-relaxed text-white/70" />
        <LongText text={s.evidence_against} label="Wrong if:" max={140} className="text-[13px] leading-relaxed text-white/70" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Id>{s.signal_id}</Id>
        {s.expires_at && <Mono>· expires {when(s.expires_at)}</Mono>}
      </div>
    </Tile>
  );
}


/** One open trade as a picture: stop → entry → target rail with the live price, R now and what is still open. */
function OpenTradeTile({ t, live, stored }: { t: Trade; live?: LP; stored?: Stored }) {
  const m = tradeMetrics(t);
  const riskFree = t.direction === "short" ? Number(t.current_stop) <= Number(t.entry) : Number(t.current_stop) >= Number(t.entry);
  return (
    <Tile tone="accent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="text-[15px] text-white">{t.symbol}</strong>
          <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
          <Badge tone="gray">{num(t.leverage, 0)}x</Badge>
          {riskFree && <Badge tone="green">risk-free</Badge>}
          {t.status === "pending" && <Badge tone="amber">pending fill</Badge>}
        </div>
        <span className="font-mono text-[12px] text-white/50">plan R:R <strong className="text-white">{fmtRR(m.rr)}</strong></span>
      </div>
      <TradeRail
        className="mt-3"
        symbol={t.symbol}
        kind="crypto"
        initial={live}
        stored={stored}
        direction={t.direction}
        entry={t.entry}
        stop={t.current_stop ?? t.stop}
        origStop={t.stop}
        target={t.current_tp1 ?? t.tp1 ?? t.target}
        qty={t.qty_open ?? t.quantity}
        equity={t.account_equity}
      />
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px] tabular-nums text-white/45">
        <span>risk {money(t.risk_dollars)} <span className="text-rose-300/80">{fmtPct(m.riskPct)}</span> / <span className="text-accent-green/80">{fmtPct(m.rewardPct)}</span> acct</span>
        <span>open {num(t.qty_open ?? t.quantity, 4)}{t.quantity ? ` (${num((100 * Number(t.qty_open ?? t.quantity)) / Number(t.quantity), 0)}%)` : ""}</span>
        {Number(t.banked_pnl) ? <span className={Number(t.banked_pnl) > 0 ? "text-accent-green" : "text-rose-300"}>banked {Number(t.banked_pnl) > 0 ? "+" : ""}{money(t.banked_pnl)}</span> : null}
        <span>opened {whenShort(t.opened_at)}</span>
        <Id>{t.trade_id}</Id>
      </div>
    </Tile>
  );
}
