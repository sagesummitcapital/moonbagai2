import { getRobinhoodBook } from "@/lib/moonbag/desk";
import { load } from "../_components/data";
import { Bars, DivergingBars, Meter, ScoreBar, budgetTone } from "../_components/charts";
import { LiveMetric, LivePrice, TradeRail, type Stored } from "../_components/LivePrice";
import { NON_TRADABLE, cryptoSetFrom, loadLive, storedOf } from "../_components/live";
import { DataNotice } from "../_components/Notice";
import { ThesisCard } from "../_components/ThesisCard";
import { Badge, Card, Empty, Expander, Fold, Id, LongText, Mono, Note, PageHeader, Quiet, RMult, Section, Stat, Table, Tile, Unit, Updated, biasGlyph, biasTone, money, num, px, statusTone, when, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function RobinhoodPage() {
  const { data, error } = await load(getRobinhoodBook);
  if (!data) return <DataNotice error={error} />;

  const { risk, snapshot, box, open, closed, paper } = data;
  const equity = Number(snapshot?.equity ?? 0);
  const boxLeft = Math.max(0, box.limit - box.used);
  const halted = risk?.soft_halt_equity != null && equity > 0 && equity <= Number(risk.soft_halt_equity);
  const activeThemes = data.themes.filter((t) => t.status === "active");
  const watchThemes = data.themes.filter((t) => t.status !== "active" && t.status !== "retired");
  const openPaper = paper.filter((p) => p.status === "open");
  const closedPaper = paper.filter((p) => p.status === "closed");
  const maxFills = Number(risk?.max_fills_per_week ?? 0);
  const status = halted ? "Soft halt" : risk?.auto_execute ? "Auto within limits" : "Paused";
  const openRisk = (t: (typeof open)[number]) => Math.max(0, (Number(t.entry) - Number(t.current_stop ?? t.stop)) * Number(t.quantity ?? 0));

  // Live quotes (Yahoo Finance) for everything held or watched; the account snapshot's market values are the stored fallback.
  const cryptoSet = cryptoSetFrom();
  const live = await loadLive(
    [...open.map((t) => t.symbol), ...data.longTerm.sleeve.map((r) => r.symbol), ...data.tickerTheses.map((t) => t.asset).filter((a) => !NON_TRADABLE.has(a))],
    cryptoSet,
  );
  const snapPx: Record<string, Stored> = {};
  for (const p of (Array.isArray(snapshot?.positions) ? (snapshot!.positions as { symbol?: string; market_value?: number; quantity?: number }[]) : [])) {
    if (p.symbol && Number(p.quantity) > 0 && Number(p.market_value) > 0) snapPx[p.symbol] = storedOf(Number(p.market_value) / Number(p.quantity), snapshot!.reported_at, "account snapshot");
  }

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      <PageHeader
        title="Long-term book"
        kicker="Robinhood Agentic account"
        sub="The longer-term thesis, played out with small real positions. Moonbag decides, Grokbot executes, the database enforces the limits. Cash is a position."
        right={<Badge tone={halted ? "red" : risk?.auto_execute ? "green" : "amber"} dot>{status}</Badge>}
      />

      {/* ------------------------------------------------ KPIs */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Account" value={snapshot ? money(equity) : "—"} sub={snapshot ? <>Cash {money(snapshot.cash)} · <Updated label="snapshot" at={snapshot.reported_at} cadenceH={30} verb="reported by Grokbot" /></> : "Waiting for Grokbot's account snapshot"} />
        </Card>
        <Card>
          <Stat
            label="Loss box"
            size="md"
            value={<>{money(box.used)}<Unit>of {money(box.limit)}</Unit></>}
            tone={budgetTone(box.limit > 0 ? box.used / box.limit : 0) === "green" ? undefined : budgetTone(box.limit > 0 ? box.used / box.limit : 0)}
            meter={<Meter value={box.used} max={box.limit} height={8} labels={[<>{money(boxLeft)} left</>, <>limit {money(box.limit)}</>]} />}
            sub={<>realised <span className="font-mono tabular-nums">{money(box.realisedLoss)}</span> + at risk <span className="font-mono tabular-nums">{money(box.openRisk)}</span></>}
          />
        </Card>
        <Card>
          <Stat
            label="Fills this week"
            size="md"
            value={<>{data.fillsThisWeek}<Unit>of {num(maxFills, 0)}</Unit></>}
            meter={maxFills > 0 ? <Meter value={data.fillsThisWeek} max={maxFills} tone={data.fillsThisWeek >= maxFills ? "amber" : "cyan"} height={8} /> : undefined}
            sub="Aim: one A-grade fill a week, only if an A exists and its stop fits the box."
          />
        </Card>
        <Card tone={halted ? "warn" : undefined}>
          <Stat
            label="Status"
            size="sm"
            value={status}
            tone={halted ? "red" : undefined}
            sub={`A full size, B half (score ≥ ${num(risk?.min_setup_score, 1)}) · halt at ${money(risk?.soft_halt_equity)} · never ${(risk?.blocked_symbols ?? []).join(", ") || "—"} · no crypto`}
          />
        </Card>
      </div>


      {/* ------------------------------------------------ open positions */}
      <Card title="Open positions" right={open.length ? <Mono>{open.length} open · at risk {money(open.reduce((a, t) => a + openRisk(t), 0))}</Mono> : undefined}>
        {open.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {open.map((t) => (
              <Tile key={t.trade_id} tone="accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[15px] text-white">{t.symbol}</strong>
                    <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
                    {(t as { sleeve?: string | null }).sleeve === "investments" && <Badge tone="cyan">long-term sleeve</Badge>}
                    {t.status === "pending" && <Badge tone="amber">pending fill</Badge>}
                  </div>
                  <span className="text-[11.5px] text-white/40">opened {whenShort(t.opened_at ?? t.created_at)}</span>
                </div>
                <TradeRail className="mt-2.5" compact symbol={t.symbol} kind="stock" initial={live[t.symbol]} stored={snapPx[t.symbol]} direction={t.direction} entry={t.entry} stop={t.current_stop ?? t.stop} origStop={t.stop} target={t.current_tp1 ?? t.tp1 ?? t.target} qty={t.quantity} equity={equity || null} />
                {t.current_stop ?? t.stop ? null : <p className="mt-1.5 text-[11.5px] text-white/40">No stop on this lot (DCA position) — the rail shows entry → now only.</p>}
              </Tile>
            ))}
          </div>
        )}
        {open.length > 0 ? <Expander summary={<span className="text-white/70">Every column</span>}>
        <Table
          head={["Symbol", "Entry", "Now", "P&L", "Stop (orig / now)", "Targets", "Risk", "Size", "Opened"]}
          align={["l", "r", "r", "r", "r", "r", "r", "r", "l"]}
          minWidth={900}
          rows={open.map((t) => [
            <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id></span>,
            num(t.entry),
            <LivePrice key="n" symbol={t.symbol} kind="stock" initial={live[t.symbol]} stored={snapPx[t.symbol]} size="sm" />,
            <span key="pl"><LiveMetric symbol={t.symbol} kind="stock" initial={live[t.symbol]} stored={snapPx[t.symbol]} metric="pnl" entry={t.entry} qty={t.quantity} direction={t.direction} tag={false} /><div className="text-[11px]"><LiveMetric symbol={t.symbol} kind="stock" initial={live[t.symbol]} stored={snapPx[t.symbol]} metric="pct" entry={t.entry} direction={t.direction} /></div></span>,
            <span key="s">{num(t.stop)} <span className="text-white/30">/</span> {num(t.current_stop)}</span>,
            [t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp2 ?? t.tp2].map((x) => num(x)).join(" · "),
            money(openRisk(t)),
            <span key="z">{num(t.quantity, 4)} <span className="text-white/45">· {money(t.position_value)}</span></span>,
            <span key="o" className="whitespace-nowrap text-white/60">{when(t.opened_at)}</span>,
          ])}
          empty="In cash. No A setup has met the standard — that is the plan working, not a gap."
        />
        </Expander> : <Empty>In cash. No A setup has met the standard — that is the plan working, not a gap.</Empty>}
      </Card>

      {/* ------------------------------------------------ long-term sleeve */}
      <Card title="Long-term holdings — 25% sleeve, weekly DCA" right={<Badge tone="cyan">thesis: LONG_TERM_THESIS.md</Badge>}>
        {data.longTerm.sleeve.length ? (
          <>
            <Section title="Bought vs target" right={<span>green = bought · faint = still to buy</span>}>
              <Bars
                tone="green"
                max={Math.max(1, ...data.longTerm.sleeve.map((r) => Number(r.target_dollars)))}
                labelWidth="minmax(72px, 24%)"
                format={(v) => money(v)}
                items={data.longTerm.sleeve.map((r) => ({ label: r.symbol, sub: `${num(r.target_weight_pct, 0)}% · target ${money(r.target_dollars)}`, value: Number(r.cost_basis) }))}
              />
            </Section>
            <Expander className="mt-4" summary={<span><strong className="text-white/85">Every name</strong> <span className="text-white/45">· {data.longTerm.sleeve.length} names · &quot;now&quot; is a live quote · value = shares × now</span></span>}>
              <Table
                head={["Name", "Theme", "Target", "Target $", "Bought $", "Now", "Value · P&L", "Pending $", "Left to buy", "FUD boost"]}
                align={["l", "l", "r", "r", "r", "r", "r", "r", "r", "l"]}
                minWidth={1100}
                rows={data.longTerm.sleeve.map((r) => {
                  const qty = Number(r.qty ?? 0), cost = Number(r.cost_basis ?? 0);
                  const avg = qty > 0 && cost > 0 ? cost / qty : null;
                  return [
                  <span key="n"><strong className="text-white">{r.symbol}</strong><br /><span className="text-[12px] text-white/45">{r.name}</span></span>,
                  <Id key="t">{r.theme_id}</Id>,
                  `${num(r.target_weight_pct, 0)}%`,
                  money(r.target_dollars),
                  <span key="b" className={cost > 0 ? "text-accent-green" : "text-white/50"}>{money(r.cost_basis)}{avg != null && <div className="text-[11px] text-white/40">{num(qty, 4)} sh @ {px(avg)}</div>}</span>,
                  <LivePrice key="now" symbol={r.symbol} kind="stock" initial={live[r.symbol]} stored={snapPx[r.symbol]} size="sm" />,
                  qty > 0 && avg != null
                    ? <span key="v"><LiveMetric symbol={r.symbol} kind="stock" initial={live[r.symbol]} stored={snapPx[r.symbol]} metric="pnl" entry={avg} qty={qty} tag={false} /><div className="text-[11px]"><LiveMetric symbol={r.symbol} kind="stock" initial={live[r.symbol]} stored={snapPx[r.symbol]} metric="pct" entry={avg} /></div></span>
                    : <span key="v" className="text-white/40">—</span>,
                  money(r.pending_dollars),
                  money(Math.max(0, Number(r.gap_dollars))),
                  r.fud_boost ? <Badge key="f" tone="green">yes</Badge> : <span key="f" className="text-white/40">no</span>,
                ]; })}
              />
            </Expander>
          </>
        ) : (
          <Empty>The long-term sleeve isn&apos;t set up yet.</Empty>
        )}
        {!!data.longTerm.lists.length && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(["watch", "avoid"] as const).map((role) => (
              <Expander key={role} summary={<span><strong className="text-white/90">{role === "watch" ? "Watchlist" : "Avoid / paper short"}</strong> <span className="text-white/45">— {role === "watch" ? "buy only after promotion" : "entropy losers"} · {data.longTerm.lists.filter((x) => x.role === role).length}</span></span>}>
                <ul className="space-y-1.5 text-[13px]">
                  {data.longTerm.lists.filter((x) => x.role === role).map((x) => (
                    <li key={x.symbol} className="text-white/70"><strong className="text-white">{x.symbol}</strong> <span className="text-white/45">· {x.thesis}</span></li>
                  ))}
                </ul>
              </Expander>
            ))}
          </div>
        )}
      </Card>

      <Quiet title="Everything else in this book" sub="tap any row to open it">
      <Fold title="Longer-term theses — macro & equities" count={[data.master, data.equityThesis].filter(Boolean).length}>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.master ? <ThesisCard t={data.master} title="Longer-term thesis — macro" /> : <Card title="Longer-term thesis — macro"><Empty>No active master thesis.</Empty></Card>}
          {data.equityThesis ? <ThesisCard t={data.equityThesis} title="Longer-term thesis — equities" /> : <Card title="Longer-term thesis — equities"><Empty>No active equity thesis.</Empty></Card>}
        </div>
      </Fold>
      <Fold count={activeThemes.length} title="Investment themes" right={<Badge tone="gray">{activeThemes.length} active</Badge>}>
        {activeThemes.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeThemes.map((t) => (
              <Tile key={t.theme_id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-[14px] text-white">{t.name}</strong>
                  {t.conviction != null && (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-[11.5px] uppercase tracking-[0.1em] text-white/35">conviction</span>
                      <ScoreBar value={t.conviction} tone="cyan" label={`${num(t.conviction, 0)}`} width="w-[120px]" />
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1.5">
                  <LongText text={t.mechanism} label="Mechanism:" max={150} className="text-[13px] leading-snug text-white/75" />
                  <LongText text={t.what_would_break_it} label="What would break it:" max={130} className="text-[13px] leading-snug text-white/75" />
                </div>
              </Tile>
            ))}
          </div>
        ) : (
          <Empty>No theme is active yet. A theme only goes active once its economic mechanism and what would break it are written down — until then, long-term positions are blocked and tactical A setups are the only live trades.</Empty>
        )}
        {!!watchThemes.length && (
          <Note><span className="text-white/60">On watch:</span> {watchThemes.map((t) => t.name).join(" · ")}</Note>
        )}
      </Fold>

      {!!data.tickerTheses.length && (
        <Fold title="Ticker theses" right={<Badge tone="gray">{data.tickerTheses.length}</Badge>}>
          <div className="grid gap-3 lg:grid-cols-2">{data.tickerTheses.map((t) => <ThesisCard key={t.thesis_id} t={t} live={NON_TRADABLE.has(t.asset) ? undefined : live[t.asset] ?? null} kind="stock" />)}</div>
        </Fold>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Fold count={data.handoffs.length} title="Handoffs to Grokbot">
          <Table
            head={["Handoff", "Symbol", "Status", "Created", "Note"]}
            rows={data.handoffs.slice(0, 8).map((h) => [
              <Id key="i">{h.handoff_id}</Id>,
              <strong key="s" className="text-white">{h.symbol}</strong>,
              <Badge key="st" tone={statusTone(h.status)} dot>{h.status}</Badge>,
              <span key="c" className="whitespace-nowrap text-white/60">{when(h.created_at)}</span>,
              <LongText key="n" text={h.status_reason ?? h.position_guidance ?? "—"} max={100} className="min-w-[180px] text-[12.5px] leading-snug text-white/60" />,
            ])}
            empty="No handoffs yet."
          />
        </Fold>
        <Fold count={closed.length} title="Closed trades">
          {closed.length > 0 && (
            <DivergingBars
              className="mb-4"
              labelWidth="minmax(90px, 34%)"
              format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`}
              items={closed.slice(0, 8).map((t) => ({ label: t.symbol, sub: when(t.closed_at), value: t.realized_pnl == null ? null : Number(t.realized_pnl) }))}
            />
          )}
          <Table
            head={["Symbol", "Entry → exit", "P&L", "R", "Closed"]}
            align={["l", "r", "r", "r", "l"]}
            dense
            rows={closed.slice(0, 8).map((t) => [
              <strong key="s" className="text-white">{t.symbol}</strong>,
              `${num(t.entry)} → ${num(t.exit_price)}`,
              <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
              <RMult key="r" v={t.r_multiple} />,
              <span key="c" className="whitespace-nowrap text-white/60">{when(t.closed_at)}</span>,
            ])}
            empty="No closed trades yet."
          />
        </Fold>
      </div>

      <Fold count={paper.length} title="Paper trades — ideas being tested (never real orders)" right={<Badge tone="gray">{openPaper.length} open · {closedPaper.length} closed</Badge>}>
        <Table
          head={["Paper", "Symbol", "Side", "Setup", "Entry / stop / target", "Result", "Opened"]}
          align={["l", "l", "l", "l", "r", "l", "l"]}
          rows={paper.slice(0, 15).map((p) => [
            <Id key="i">{p.paper_id}</Id>,
            <strong key="s" className="text-white">{p.symbol}</strong>,
            <Badge key="d" tone={biasTone(p.direction)}>{biasGlyph(p.direction)} {p.direction}</Badge>,
            p.setup_type ?? "—",
            <span key="l" className="whitespace-nowrap">{num(p.entry)} <span className="text-white/30">/</span> {num(p.stop)} <span className="text-white/30">/</span> {num(p.target)}</span>,
            p.status === "closed" ? <span key="r" className="whitespace-nowrap">{p.r_multiple != null ? <RMult v={p.r_multiple} /> : "closed"} <span className="text-white/45">· {p.exit_reason ?? ""}</span></span> : <Badge key="s" tone="green" dot>open</Badge>,
            <span key="o" className="whitespace-nowrap text-white/60">{when(p.opened_at)}</span>,
          ])}
          empty="No paper trades yet. The weekly review opens them for B setups and new ideas."
        />
      </Fold>

      <div className="grid gap-3 lg:grid-cols-2">
        <Fold count={data.journal.length} title="Journal — thesis, result, one mistake, one rule change">
          {data.journal.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {data.journal.map((j) => (
                <li key={j.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="gray">{j.kind}</Badge><Mono>{j.ref ?? ""} · {when(j.created_at)}</Mono></div>
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
            <Empty>No journal lines yet. Every live and paper close gets one.</Empty>
          )}
        </Fold>
        <Fold count={data.backtests.length} title="Backtests — what counts as an A is re-tested weekly">
          <Table
            head={["Idea", "Symbol · TF", "Trades", "Win %", "Avg R", "Notes"]}
            align={["l", "l", "r", "r", "r", "l"]}
            dense
            rows={data.backtests.slice(0, 10).map((b) => [
              <Mono key="e" className="text-white/75">{b.engine_code ?? "custom"}</Mono>,
              <span key="a" className="whitespace-nowrap">{b.asset} · {b.timeframe}</span>,
              b.n_trades,
              num(b.win_rate, 0),
              <RMult key="r" v={b.avg_r} />,
              <LongText key="n" text={b.notes ?? "—"} max={80} className="min-w-[160px] text-[12.5px] leading-snug text-white/55" />,
            ])}
            empty="First equity backtests run with the Saturday weekly review."
          />
        </Fold>
      </div>
      </Quiet>
    </div>
  );
}
