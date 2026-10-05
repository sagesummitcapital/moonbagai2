import { getRobinhoodBook } from "@/lib/moonbag/desk";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { ThesisCard } from "../_components/ThesisCard";
import { Badge, Card, Empty, Mono, Stat, Table, biasTone, money, num, statusTone, when } from "../_components/ui";

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

  return (
    <div className="space-y-6">
      <DataNotice error={error} />

      <div>
        <h1 className="text-[22px] font-semibold text-white">Long-term book <span className="text-white/40">· Robinhood Agentic account</span></h1>
        <p className="mt-1 text-[13.5px] text-white/55">
          The longer-term thesis, played out with small real positions. Moonbag decides, Grokbot executes, the database enforces the limits. Cash is a position.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <Stat label="Account" value={snapshot ? money(equity) : "—"} sub={snapshot ? `Cash ${money(snapshot.cash)} · reported ${when(snapshot.reported_at)}` : "Waiting for Grokbot's account snapshot"} />
        </Card>
        <Card>
          <Stat
            label="Loss box"
            value={<span className="text-[22px]">{money(box.used)} <span className="text-[14px] text-white/45">of {money(box.limit)}</span></span>}
            sub={`${money(boxLeft)} left · realised ${money(box.realisedLoss)} + at risk ${money(box.openRisk)}`}
          />
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${box.used / box.limit > 0.75 ? "bg-rose-400/70" : "bg-accent-green/70"}`} style={{ width: `${Math.min(100, (box.used / box.limit) * 100)}%` }} />
          </div>
        </Card>
        <Card>
          <Stat label="Fills this week" value={<span className="text-[22px]">{data.fillsThisWeek} <span className="text-[14px] text-white/45">of {num(risk?.max_fills_per_week, 0)}</span></span>} sub="Aim: one A-grade fill a week, only if an A exists and its stop fits the box." />
        </Card>
        <Card>
          <Stat
            label="Status"
            value={<span className="text-[18px]">{halted ? "Soft halt" : risk?.auto_execute ? "Auto within limits" : "Paused"}</span>}
            sub={`A setups only (score ≥ ${num(risk?.min_setup_score, 0)}) · halt at ${money(risk?.soft_halt_equity)} · never ${(risk?.blocked_symbols ?? []).join(", ") || "—"} · no crypto`}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.master ? <ThesisCard t={data.master} title="Longer-term thesis — macro" /> : <Card title="Longer-term thesis — macro"><Empty>No active master thesis.</Empty></Card>}
        {data.equityThesis ? <ThesisCard t={data.equityThesis} title="Longer-term thesis — equities" /> : <Card title="Longer-term thesis — equities"><Empty>No active equity thesis.</Empty></Card>}
      </div>

      <Card title="Investment themes" right={<Badge tone="gray">{activeThemes.length} active</Badge>}>
        {activeThemes.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeThemes.map((t) => (
              <div key={t.theme_id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-[13.5px]">
                <div className="flex items-center justify-between"><strong className="text-white">{t.name}</strong>{t.conviction != null && <Badge tone="cyan">conviction {num(t.conviction, 0)}</Badge>}</div>
                <p className="mt-2 text-white/70"><span className="text-white/45">Mechanism: </span>{t.mechanism}</p>
                <p className="mt-1.5 text-white/70"><span className="text-white/45">What would break it: </span>{t.what_would_break_it}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No theme is active yet. A theme only goes active once its economic mechanism and what would break it are written down — until then, long-term positions are blocked and tactical A setups are the only live trades.</Empty>
        )}
        {!!watchThemes.length && (
          <p className="mt-4 text-[12.5px] text-white/45">On watch: {watchThemes.map((t) => t.name).join(" · ")}</p>
        )}
      </Card>

      <Card title="Open positions">
        <Table
          head={["Trade", "Symbol", "Entry", "Stop (orig / now)", "Targets", "Risk", "Size", "Opened"]}
          rows={open.map((t) => [
            <Mono key="i">{t.trade_id}</Mono>,
            t.symbol,
            num(t.entry),
            `${num(t.stop)} / ${num(t.current_stop)}`,
            [t.current_tp1 ?? t.tp1 ?? t.target, t.current_tp2 ?? t.tp2].map((x) => num(x)).join(" · "),
            money(Math.max(0, (Number(t.entry) - Number(t.current_stop ?? t.stop)) * Number(t.quantity ?? 0))),
            `${num(t.quantity, 4)} · ${money(t.position_value)}`,
            when(t.opened_at),
          ])}
          empty="In cash. No A setup has met the standard — that is the plan working, not a gap."
        />
      </Card>

      {!!data.tickerTheses.length && (
        <Card title="Ticker theses">
          <div className="grid gap-4 lg:grid-cols-2">{data.tickerTheses.map((t) => <ThesisCard key={t.thesis_id} t={t} />)}</div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Handoffs to Grokbot">
          <Table
            head={["Handoff", "Symbol", "Status", "Created", "Note"]}
            rows={data.handoffs.slice(0, 8).map((h) => [
              <Mono key="i">{h.handoff_id}</Mono>,
              h.symbol,
              <Badge key="s" tone={statusTone(h.status)}>{h.status}</Badge>,
              when(h.created_at),
              <span key="n" className="text-white/55">{h.status_reason ?? h.position_guidance ?? "—"}</span>,
            ])}
            empty="No handoffs yet."
          />
        </Card>
        <Card title="Closed trades">
          <Table
            head={["Symbol", "Entry → exit", "P&L", "R", "Closed"]}
            rows={closed.slice(0, 8).map((t) => [
              t.symbol,
              `${num(t.entry)} → ${num(t.exit_price)}`,
              <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
              t.r_multiple != null ? `${num(t.r_multiple)}R` : "—",
              when(t.closed_at),
            ])}
            empty="No closed trades yet."
          />
        </Card>
      </div>

      <Card title="Paper trades — ideas being tested (never real orders)" right={<Badge tone="gray">{openPaper.length} open · {closedPaper.length} closed</Badge>}>
        <Table
          head={["Paper", "Symbol", "Side", "Setup", "Entry / stop / target", "Result", "Opened"]}
          rows={paper.slice(0, 15).map((p) => [
            <Mono key="i">{p.paper_id}</Mono>,
            p.symbol,
            <Badge key="d" tone={biasTone(p.direction)}>{p.direction}</Badge>,
            p.setup_type ?? "—",
            `${num(p.entry)} / ${num(p.stop)} / ${num(p.target)}`,
            p.status === "closed" ? `${p.r_multiple != null ? `${num(p.r_multiple)}R` : "closed"} · ${p.exit_reason ?? ""}` : <Badge key="s" tone="green">open</Badge>,
            when(p.opened_at),
          ])}
          empty="No paper trades yet. The weekly review opens them for B setups and new ideas."
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Journal — thesis, result, one mistake, one rule change">
          {data.journal.length ? (
            <ul className="space-y-3 text-[13.5px]">
              {data.journal.map((j) => (
                <li key={j.id} className="border-b border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2"><Badge tone="gray">{j.kind}</Badge><Mono>{j.ref ?? ""} · {when(j.created_at)}</Mono></div>
                  <p className="mt-1.5 text-white/75"><span className="text-white/45">Thesis: </span>{j.thesis}</p>
                  <p className="mt-1 text-white/75"><span className="text-white/45">Result: </span>{j.result}</p>
                  {j.mistake && <p className="mt-1 text-white/75"><span className="text-white/45">Mistake: </span>{j.mistake}</p>}
                  {j.rule_change && <p className="mt-1 text-white/75"><span className="text-white/45">Rule change: </span>{j.rule_change}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No journal lines yet. Every live and paper close gets one.</Empty>
          )}
        </Card>
        <Card title="Backtests — what counts as an A is re-tested weekly">
          <Table
            head={["Idea", "Symbol · TF", "Trades", "Win %", "Avg R", "Notes"]}
            rows={data.backtests.slice(0, 10).map((b) => [
              b.engine_code ?? "custom",
              `${b.asset} · ${b.timeframe}`,
              b.n_trades,
              num(b.win_rate, 0),
              b.avg_r != null ? `${num(b.avg_r)}R` : "—",
              <span key="n" className="text-white/55">{b.notes ?? "—"}</span>,
            ])}
            empty="First equity backtests run with the Saturday weekly review."
          />
        </Card>
      </div>
    </div>
  );
}
