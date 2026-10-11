import { getCoinbaseBook } from "@/lib/moonbag/desk";
import { load } from "../_components/data";
import { DivergingBars, Legend, Meter, Strip } from "../_components/charts";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Delta, LongText, Id, Mono, Note, PageHeader, RMult, Section, Stat, Table, Unit, money, num, statusTone, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const pct = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || !Number(b) ? null : ((Number(a) - Number(b)) / Number(b)) * 100;
const signed = (x: number | null, d = 1) => (x == null ? "—" : `${x > 0 ? "+" : ""}${num(x, d)}%`);
const regimeTone = (r?: string | null) => (r === "bull" ? "green" : r === "bear" ? "red" : "gray");

export default async function CoinbasePage() {
  const { data, error } = await load(getCoinbaseBook);
  if (!data) return <DataNotice error={error} />;
  const { risk, snapshot, equity, peak30, open, closed, universe, signals, handoffs, stats, paper } = data;
  const live = universe.filter((u) => u.live);
  const paperOnly = universe.filter((u) => !u.live);
  const riskPct = Number(risk?.risk_per_trade_pct ?? 5) / 100;
  const maxOpen = Number((risk as { max_open_risk_pct?: number } | null)?.max_open_risk_pct ?? 15);
  const ddPause = Number(risk?.drawdown_stop_pct ?? 20);
  const paused = peak30 > 0 && equity <= peak30 * (1 - ddPause / 100);
  const halfRisk = stats.lossStreak >= 3;
  const status = !risk?.auto_execute ? "Paused" : paused ? "Drawdown pause" : halfRisk ? "Half risk" : "Auto within limits";
  const bulls = universe.filter((u) => u.regime === "bull").length;
  const bears = universe.filter((u) => u.regime === "bear").length;
  const closedPaper = paper.filter((p) => p.status === "closed" && p.r != null);

  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Coinbase book"
        kicker="spot crypto trend, executed by Grokbot"
        right={<Badge tone={!risk?.auto_execute ? "amber" : paused ? "red" : halfRisk ? "amber" : "green"} dot>{status}</Badge>}
        sub={
          <LongText
            max={150}
            className="text-[13px] leading-snug text-white/55"
            text={`Open universe: ${universe.length} Coinbase coins scanned and paper-traded every day, long or cash (USDC). A coin is bought only when its trend is up (daily close above 1.02 × 200-day) and it closes above its 55-day high. BTC, ETH and SOL trade live at ${num(riskPct * 100, 0)}% risk; an alt trades live only after its own paper record earns it (4+ trades averaging +0.5R) — at half risk, and only while BTC is bull. Every trade uses a 3 × ATR stop, sells half at 3R and lets the rest run behind the 20-day low. A daily close below 0.97 × 200-day flips that coin bearish: out, cash, no longs. Directed by the Strategist; executed by Grok.`}
          />
        }
      />

      {/* ------------------------------------------------ KPIs */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Account" value={money(equity)} sub={snapshot ? `Cash ${money(snapshot.cash)} · reported ${when(snapshot.reported_at)}` : `Start ${money(risk?.starting_equity)} · waiting for Grokbot's first snapshot`} />
        </Card>
        <Card>
          <Stat
            label="Open risk"
            size="md"
            value={<>{num(data.openRiskPct, 1)}%<Unit>of {num(maxOpen, 0)}%</Unit></>}
            meter={<Meter value={data.openRiskPct} max={maxOpen} height={8} labels={[<>{money(data.openRisk)} to the stops</>, <>cap {num(maxOpen, 0)}%</>]} />}
            sub={`${open.length} open of ${num(risk?.max_open_positions, 0)} positions`}
          />
        </Card>
        <Card>
          <Stat
            label="Record"
            size="md"
            value={stats.closed ? <Delta v={stats.totalR} d={1} unit="R" arrow={false} className="text-[22px]" /> : "—"}
            sub={stats.closed ? `${stats.closed} closed · ${stats.wins} won · avg ${num(stats.avgR, 2)}R · ${money(stats.pnl)}` : "No closed trades yet. Backtest 2021–26: avg +1.15R, 52% won."}
          />
        </Card>
        <Card tone={paused ? "warn" : undefined}>
          <Stat
            label="Status"
            size="sm"
            value={status}
            tone={paused ? "red" : halfRisk || !risk?.auto_execute ? "amber" : undefined}
            sub={`${num(riskPct * 100, 0)}% risk/trade${halfRisk ? " → halved (3 losses in a row)" : ""} · pause at ${num(ddPause, 0)}% below the 30-day peak (${money(peak30)})`}
          />
        </Card>
      </div>

      {/* ------------------------------------------------ regime strip */}
      <Card title="Universe regime" right={<Mono>updated after each 00:00 UTC daily close by the Coinbase desk</Mono>}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[22px] font-semibold tabular-nums text-accent-green">{bulls} <span className="text-[13px] font-normal text-white/50">bull</span></span>
          <span className="font-mono text-[22px] font-semibold tabular-nums text-rose-300">{bears} <span className="text-[13px] font-normal text-white/50">bear</span></span>
          <span className="text-[12.5px] text-white/45">of {universe.length} coins · {live.length} live · {paperOnly.length} paper-only · {open.length} held</span>
        </div>
        <Meter className="mt-3" value={bulls} max={universe.length || 1} tone="green" height={6} />
        <Strip className="mt-3" items={universe.map((u) => ({ label: u.symbol, tone: open.some((t) => t.symbol === u.symbol) ? "cyan" : regimeTone(u.regime), title: `${u.symbol} · ${u.regime ?? "—"} since ${u.regime_since ?? "—"}` }))} />
        <Legend className="mt-2" items={[{ tone: "green", label: "bull — buys above its 55-day high" }, { tone: "red", label: "bear — cash, no longs" }, { tone: "cyan", label: "held" }]} />
      </Card>

      <Card title={`Live coins (${live.length}) — regime and triggers`} sub="Core coins run at full risk, alts at half. Stop and TP1 are what the trade would get if it triggered at the 55-day high today.">
        <Table
          head={["Coin", "Regime", "Close", "Bear line (0.97 × 200D)", "Entry trigger (55-day high)", "If it triggers: stop · TP1", "Size at its risk"]}
          align={["l", "l", "r", "r", "r", "r", "r"]}
          minWidth={900}
          rows={live.map((u) => {
            const stop = u.trigger_px != null && u.atr14 != null ? Number(u.trigger_px) - 3 * Number(u.atr14) : null;
            const tp1 = u.trigger_px != null && stop != null ? Number(u.trigger_px) + 3 * (Number(u.trigger_px) - stop) : null;
            const dist = u.trigger_px != null && stop != null ? (Number(u.trigger_px) - stop) / Number(u.trigger_px) + 0.012 : null;
            const size = dist ? Math.min((equity * riskPct * Number(u.risk_mult ?? 1)) / dist, equity) : null;
            const holding = open.some((t) => t.symbol === u.symbol);
            return [
              <span key="s"><strong className="text-white">{u.symbol}</strong> <Badge tone={u.tier === "core" ? "cyan" : "gray"}>{u.tier === "core" ? "core · full risk" : "alt · half risk"}</Badge><br /><Id>{u.product_id}</Id>{u.tier !== "core" && <div className="text-[11.5px] text-white/40">paper {u.paper_n} @ {num(u.paper_avg_r, 2)}R · RS vs BTC {u.rs90 != null ? `${num(u.rs90, 0)}%` : "—"}</div>}</span>,
              <span key="r"><Badge tone={regimeTone(u.regime)} dot>{u.regime ?? "—"}</Badge><div className="mt-1 text-[11.5px] text-white/45">since {u.regime_since ?? "—"}</div></span>,
              <span key="c">{num(u.close)}<div className="text-[11.5px] text-white/40">{u.as_of ?? ""}</div></span>,
              <span key="b">{num(u.bear_line)}<div className="text-[11.5px] text-rose-300/70">{signed(pct(u.bear_line, u.close))} from close</div></span>,
              <span key="t">{holding ? <Badge tone="cyan">holding</Badge> : num(u.trigger_px)}<div className="text-[11.5px] text-white/40">{holding ? "" : `${signed(pct(u.trigger_px, u.close))} to go`}</div></span>,
              <span key="p"><span className="text-rose-300/80">{num(stop)}</span> <span className="text-white/30">·</span> <span className="text-accent-green/80">{num(tp1)}</span></span>,
              <span key="z">{size ? money(size) : "—"}</span>,
            ];
          })}
          empty="cb_universe is empty."
        />
        <Note>
          Weekly 20-EMA is shown on the agent runs as an early warning only — as a hard rule it cost return in the backtest. Stavros&apos;s 100–105k BTC zone is a
          profit-taking zone (the runner trails the 10-day low above 100k), not a forecast.
        </Note>
      </Card>

      <Card title={`Paper-only coins (${paperOnly.length}) — scanned and paper-traded, not live yet`} right={<Mono>live after 4+ paper trades averaging +0.5R</Mono>}>
        <Table
          head={["Coin", "Regime", "Paper record", "Last 4", "RS vs BTC (90d)", "Trigger", "Status"]}
          align={["l", "l", "r", "r", "r", "r", "l"]}
          dense
          maxHeight={520}
          rows={paperOnly.map((u) => [
            <strong key="s" className="text-white">{u.symbol}</strong>,
            <Badge key="r" tone={regimeTone(u.regime)} dot>{u.regime ?? "—"}</Badge>,
            <span key="p">{u.paper_n} trades · {u.paper_avg_r != null ? <RMult v={u.paper_avg_r} /> : "—"}</span>,
            u.paper_last4 != null ? <RMult key="l" v={u.paper_last4} /> : "—",
            <span key="rs">{u.rs90 != null ? `${num(u.rs90, 0)}%` : "—"}</span>,
            <span key="t">{num(u.trigger_px)}<div className="text-[11.5px] text-white/40">{signed(pct(u.trigger_px, u.close))} to go</div></span>,
            <LongText key="st" text={u.status !== "active" ? `paused: ${u.notes ?? ""}` : u.live_reason ?? ""} max={70} className="min-w-[160px] text-[12px] leading-snug text-white/55" />,
          ])}
          empty="Every coin is live."
        />
      </Card>

      <Card title="Paper book (every coin, same rules)" right={<Mono>the record that decides which alts go live</Mono>}>
        {closedPaper.length > 0 && (
          <Section title="Last closed paper trades" right={<span>R per trade · newest first</span>}>
            <DivergingBars
              labelWidth="minmax(80px, 28%)"
              format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`}
              items={closedPaper.slice(0, 12).map((p) => ({ label: p.symbol, sub: p.closed_on ?? "", value: Number(p.r) }))}
            />
          </Section>
        )}
        <Section title="All paper positions" right={<span>{paper.length > 40 ? "first 40" : `${paper.length} rows`}</span>}>
          <Table
            head={["Coin", "Opened", "Entry", "Stop now", "TP1", "Closed", "R", "Why"]}
            align={["l", "l", "r", "r", "r", "l", "r", "l"]}
            dense
            maxHeight={520}
            rows={paper.slice(0, 40).map((p) => [
              <span key="s"><strong className="text-white">{p.symbol}</strong>{p.source === "backtest" && <div className="text-[11.5px] text-white/40">from backtest</div>}</span>,
              <span key="o" className="whitespace-nowrap">{p.opened_on}</span>,
              num(p.entry),
              <span key="c">{num(p.cur_stop)}{p.tp1_done && <> <Badge tone="green">TP1 banked</Badge></>}</span>,
              num(p.tp1),
              p.closed_on ?? <Badge key="o" tone="cyan" dot>open</Badge>,
              <RMult key="r" v={p.r} />,
              <span key="w" className="text-white/60">{p.why ?? "—"}</span>,
            ])}
            empty="No paper positions yet."
          />
        </Section>
      </Card>

      <Card title="Open positions" right={open.length ? <Mono>{open.length} open</Mono> : undefined}>
        <Table
          head={["Trade", "Entry", "Stop now", "TP1 (half)", "Still open", "Banked", "Opened"]}
          align={["l", "r", "r", "r", "r", "r", "l"]}
          rows={open.map((t) => {
            const r1 = Number(t.entry) - Number(t.stop);
            const riskFree = Number(t.current_stop ?? t.stop) >= Number(t.entry);
            return [
              <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id></span>,
              num(t.entry),
              <span key="s">{num(t.current_stop ?? t.stop)} {riskFree && <Badge tone="green">risk-free</Badge>}</span>,
              <span key="t">{num(t.current_tp1 ?? t.tp1)}<div className="text-[11.5px] text-white/40">{r1 > 0 ? `${num((Number(t.current_tp1 ?? t.tp1) - Number(t.entry)) / r1, 1)}R` : ""}</div></span>,
              num(t.qty_open ?? t.quantity, 6),
              money(t.banked_pnl),
              <span key="o" className="whitespace-nowrap text-white/60">{when(t.opened_at ?? t.created_at)}</span>,
            ];
          })}
          empty="Flat — cash in USDC until a coin triggers."
        />
      </Card>

      <Card title="Hand-offs to Grokbot (Coinbase)">
        <Table
          head={["Hand-off", "Action", "Coin", "Order", "Stop · TP1", "Risk", "Status"]}
          align={["l", "l", "l", "r", "r", "r", "l"]}
          rows={handoffs.map((h) => {
            const x = h as typeof h & { action?: string; quantity?: number; reference_price?: number; limit_price?: number; stop_price?: number; target_1?: number; risk_dollars?: number; order_type?: string };
            return [
              <Id key="i">{h.handoff_id}</Id>,
              x.action ?? "open",
              <strong key="s" className="text-white">{h.symbol}</strong>,
              <span key="o">{x.order_type ?? "—"} {num(x.quantity, 6)} @ {num(x.limit_price ?? x.reference_price)}</span>,
              <span key="st">{num(x.stop_price)} · {num(x.target_1)}</span>,
              money(x.risk_dollars),
              <span key="sx"><Badge tone={statusTone(h.status)} dot>{h.status}</Badge>{h.status_reason && <div className="mt-1 max-w-[260px] text-[12px] leading-snug text-white/45">{h.status_reason}</div>}</span>,
            ];
          })}
          empty="No Coinbase hand-offs yet."
        />
      </Card>

      <Card title="System decisions (paper record)" right={<Mono>every signal, taken or not — graded against live fills weekly</Mono>}>
        <Table
          head={["Day", "Coin", "Decision", "Close", "Trigger", "Stop · TP1", "Size", "Outcome / note"]}
          align={["l", "l", "l", "r", "r", "r", "r", "l"]}
          dense
          maxHeight={520}
          rows={signals.map((s) => [
            <span key="d" className="whitespace-nowrap">{s.as_of}</span>,
            <strong key="s" className="text-white">{s.symbol}</strong>,
            <Badge key="k" tone={s.kind === "entry" ? "green" : s.kind === "exit_regime" || s.kind === "stop" ? "red" : "gray"}>{s.kind.replace("_", " ")}</Badge>,
            num(s.close),
            num(s.trigger_px),
            <span key="p">{num(s.stop)} · {num(s.tp1)}</span>,
            s.notional ? money(s.notional) : "—",
            <span key="o" className="text-[12.5px] text-white/60">{s.outcome_r != null ? <><RMult v={s.outcome_r} /> · </> : ""}{s.blocked_by ? <><span className="text-amber-200">blocked: {s.blocked_by}</span> · </> : ""}{s.note ?? ""}</span>,
          ])}
          empty="No system decisions logged yet — the Coinbase desk writes one per coin after each daily close."
        />
      </Card>

      <Card title="Closed trades">
        <Table
          head={["Trade", "Entry → exit", "R", "P&L", "Fees", "Exit", "Closed"]}
          align={["l", "r", "r", "r", "r", "l", "l"]}
          rows={closed.map((t) => [
            <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id></span>,
            `${num(t.entry)} → ${num(t.exit_price)}`,
            <RMult key="r" v={t.r_multiple} />,
            <span key="p" className={Number(t.realized_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(t.realized_pnl)}</span>,
            money(t.fees),
            t.exit_reason ?? "—",
            <span key="c" className="whitespace-nowrap text-white/60">{when(t.closed_at)}</span>,
          ])}
          empty="None yet."
        />
      </Card>

      <Card title="Backtests (fees and slippage included)">
        <Table
          head={["Run", "Coins · period", "CAGR · worst drawdown", "Trades", "Avg R · total", "Notes"]}
          align={["l", "l", "r", "r", "r", "l"]}
          dense
          rows={data.backtests.map((b) => {
            const p = b.params as Record<string, unknown>;
            return [
              <span key="i"><Mono>{b.engine_code ?? "—"}</Mono><div className="text-[11.5px] text-white/40">{when(b.created_at)}</div></span>,
              <span key="a">{b.asset}<div className="text-[11.5px] text-white/40">{b.period_start} → {b.period_end}</div></span>,
              <span key="c"><span className="text-accent-green">{p.cagr_pct != null ? `${num(p.cagr_pct, 1)}%` : "—"}</span> · <span className="text-rose-300">{p.max_dd_pct != null ? `${num(p.max_dd_pct, 1)}%` : "—"}</span></span>,
              num(b.n_trades, 0),
              <span key="r"><RMult v={b.avg_r} /> · {num(b.total_r, 1)}R</span>,
              <LongText key="n" text={b.notes ?? ""} max={90} className="min-w-[200px] text-[12.5px] leading-snug text-white/55" />,
            ];
          })}
          empty="No backtests saved."
        />
      </Card>
    </div>
  );
}
