import { getCoinbaseBook } from "@/lib/moonbag/desk";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Stat, Table, money, num, statusTone, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const pct = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || !Number(b) ? null : ((Number(a) - Number(b)) / Number(b)) * 100;
const signed = (x: number | null, d = 1) => (x == null ? "—" : `${x > 0 ? "+" : ""}${num(x, d)}%`);

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

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <div>
        <h1 className="text-[22px] font-semibold text-white">Coinbase book <span className="text-white/40">· spot crypto trend, executed by Grokbot</span></h1>
        <p className="mt-1 text-[13.5px] text-white/55">
          Open universe: {universe.length} Coinbase coins scanned and paper-traded every day, long or cash (USDC). A coin is bought only when its
          trend is up (daily close above 1.02 × 200-day) and it closes above its 55-day high. BTC, ETH and SOL trade live at {num(riskPct * 100, 0)}% risk;
          an alt trades live only after its own paper record earns it (4+ trades averaging +0.5R) — at half risk, and only while BTC is bull.
          Every trade uses a 3 × ATR stop, sells half at 3R and lets the rest run behind the 20-day low. A daily close below 0.97 × 200-day flips
          that coin bearish: out, cash, no longs. Directed by the Strategist; executed by Grok.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <Stat label="Account" value={money(equity)} sub={snapshot ? `Cash ${money(snapshot.cash)} · reported ${when(snapshot.reported_at)}` : `Start ${money(risk?.starting_equity)} · waiting for Grokbot's first snapshot`} />
        </Card>
        <Card>
          <Stat
            label="Open risk"
            value={<span className="text-[22px]">{num(data.openRiskPct, 1)}% <span className="text-[14px] text-white/45">of {num(maxOpen, 0)}%</span></span>}
            sub={`${money(data.openRisk)} to the stops · ${open.length} open of ${num(risk?.max_open_positions, 0)}`}
          />
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${data.openRiskPct / maxOpen > 0.75 ? "bg-rose-400/70" : "bg-accent-green/70"}`} style={{ width: `${Math.min(100, (data.openRiskPct / maxOpen) * 100)}%` }} />
          </div>
        </Card>
        <Card>
          <Stat
            label="Record"
            value={<span className="text-[22px]">{stats.closed ? `${num(stats.totalR, 1)}R` : "—"}</span>}
            sub={stats.closed ? `${stats.closed} closed · ${stats.wins} won · avg ${num(stats.avgR, 2)}R · ${money(stats.pnl)}` : "No closed trades yet. Backtest 2021–26: avg +1.15R, 52% won."}
          />
        </Card>
        <Card>
          <Stat
            label="Status"
            value={<span className="text-[18px]">{!risk?.auto_execute ? "Paused" : paused ? "Drawdown pause" : halfRisk ? "Half risk" : "Auto within limits"}</span>}
            sub={`${num(riskPct * 100, 0)}% risk/trade${halfRisk ? " → halved (3 losses in a row)" : ""} · pause at ${num(ddPause, 0)}% below the 30-day peak (${money(peak30)})`}
          />
        </Card>
      </div>

      <Card title={`Live coins (${live.length}) — regime and triggers`} right={<Mono>updated after each 00:00 UTC daily close by the Coinbase desk</Mono>}>
        <Table
          head={["Coin", "Regime", "Close", "Bear line (0.97 × 200D)", "Entry trigger (55-day high)", "If it triggers: stop · TP1", "Size at its risk"]}
          rows={live.map((u) => {
            const stop = u.trigger_px != null && u.atr14 != null ? Number(u.trigger_px) - 3 * Number(u.atr14) : null;
            const tp1 = u.trigger_px != null && stop != null ? Number(u.trigger_px) + 3 * (Number(u.trigger_px) - stop) : null;
            const dist = u.trigger_px != null && stop != null ? (Number(u.trigger_px) - stop) / Number(u.trigger_px) + 0.012 : null;
            const size = dist ? Math.min((equity * riskPct * Number(u.risk_mult ?? 1)) / dist, equity) : null;
            const holding = open.some((t) => t.symbol === u.symbol);
            return [
              <span key="s"><strong className="text-white">{u.symbol}</strong> <Badge tone={u.tier === "core" ? "cyan" : "gray"}>{u.tier === "core" ? "core · full risk" : "alt · half risk"}</Badge><br /><Mono>{u.product_id}</Mono>{u.tier !== "core" && <div className="text-[11px] text-white/40">paper {u.paper_n} @ {num(u.paper_avg_r, 2)}R · RS vs BTC {u.rs90 != null ? `${num(u.rs90, 0)}%` : "—"}</div>}</span>,
              <span key="r"><Badge tone={u.regime === "bull" ? "green" : u.regime === "bear" ? "red" : "gray"}>{u.regime ?? "—"}</Badge><div className="mt-1 text-[11.5px] text-white/45">since {u.regime_since ?? "—"}</div></span>,
              <span key="c" className="font-mono">{num(u.close)}<div className="text-[11px] text-white/40">{u.as_of ?? ""}</div></span>,
              <span key="b" className="font-mono">{num(u.bear_line)}<div className="text-[11px] text-white/40">{signed(pct(u.bear_line, u.close))} from close</div></span>,
              <span key="t" className="font-mono">{holding ? <Badge tone="cyan">holding</Badge> : num(u.trigger_px)}<div className="text-[11px] text-white/40">{holding ? "" : `${signed(pct(u.trigger_px, u.close))} to go`}</div></span>,
              <span key="p" className="font-mono">{num(stop)} · {num(tp1)}</span>,
              <span key="z" className="font-mono">{size ? money(size) : "—"}</span>,
            ];
          })}
          empty="cb_universe is empty."
        />
        <p className="mt-3 text-[12.5px] text-white/45">
          Weekly 20-EMA is shown on the agent runs as an early warning only — as a hard rule it cost return in the backtest. Stavros&apos;s 100–105k BTC zone is a
          profit-taking zone (the runner trails the 10-day low above 100k), not a forecast.
        </p>
      </Card>

      <Card title={`Paper-only coins (${paperOnly.length}) — scanned and paper-traded, not live yet`} right={<Mono>live after 4+ paper trades averaging +0.5R</Mono>}>
        <Table
          head={["Coin", "Regime", "Paper record", "Last 4", "RS vs BTC (90d)", "Trigger", "Status"]}
          rows={paperOnly.map((u) => [
            <span key="s"><strong className="text-white">{u.symbol}</strong></span>,
            <Badge key="r" tone={u.regime === "bull" ? "green" : u.regime === "bear" ? "red" : "gray"}>{u.regime ?? "—"}</Badge>,
            <span key="p" className="font-mono">{u.paper_n} trades · {u.paper_avg_r != null ? `${num(u.paper_avg_r, 2)}R` : "—"}</span>,
            <span key="l" className="font-mono">{u.paper_last4 != null ? `${num(u.paper_last4, 2)}R` : "—"}</span>,
            <span key="rs" className="font-mono">{u.rs90 != null ? `${num(u.rs90, 0)}%` : "—"}</span>,
            <span key="t" className="font-mono">{num(u.trigger_px)}<div className="text-[11px] text-white/40">{signed(pct(u.trigger_px, u.close))} to go</div></span>,
            <span key="st" className="text-[12px] text-white/55">{u.status !== "active" ? `paused: ${u.notes ?? ""}` : u.live_reason ?? ""}</span>,
          ])}
          empty="Every coin is live."
        />
      </Card>

      <Card title="Paper book (every coin, same rules)" right={<Mono>the record that decides which alts go live</Mono>}>
        <Table
          head={["Coin", "Opened", "Entry", "Stop now", "TP1", "Closed", "R", "Why"]}
          rows={paper.slice(0, 40).map((p) => [
            <span key="s"><strong className="text-white">{p.symbol}</strong>{p.source === "backtest" && <div className="text-[11px] text-white/40">from backtest</div>}</span>,
            p.opened_on,
            <span key="e" className="font-mono">{num(p.entry)}</span>,
            <span key="c" className="font-mono">{num(p.cur_stop)}{p.tp1_done && <> <Badge tone="green">TP1 banked</Badge></>}</span>,
            <span key="t" className="font-mono">{num(p.tp1)}</span>,
            p.closed_on ?? <Badge key="o" tone="cyan">open</Badge>,
            <span key="r" className={`font-mono ${Number(p.r) >= 0 ? "text-accent-green" : "text-rose-300"}`}>{p.r != null ? num(p.r, 2) : "—"}</span>,
            p.why ?? "—",
          ])}
          empty="No paper positions yet."
        />
      </Card>

      <Card title="Open positions">
        <Table
          head={["Trade", "Entry", "Stop now", "TP1 (half)", "Still open", "Banked", "Opened"]}
          rows={open.map((t) => {
            const r1 = Number(t.entry) - Number(t.stop);
            const riskFree = Number(t.current_stop ?? t.stop) >= Number(t.entry);
            return [
              <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Mono>{t.trade_id}</Mono></span>,
              <span key="e" className="font-mono">{num(t.entry)}</span>,
              <span key="s" className="font-mono">{num(t.current_stop ?? t.stop)} {riskFree && <Badge tone="green">risk-free</Badge>}</span>,
              <span key="t" className="font-mono">{num(t.current_tp1 ?? t.tp1)}<div className="text-[11px] text-white/40">{r1 > 0 ? `${num((Number(t.current_tp1 ?? t.tp1) - Number(t.entry)) / r1, 1)}R` : ""}</div></span>,
              <span key="q" className="font-mono">{num(t.qty_open ?? t.quantity, 6)}</span>,
              money(t.banked_pnl),
              when(t.opened_at ?? t.created_at),
            ];
          })}
          empty="Flat — cash in USDC until a coin triggers."
        />
      </Card>

      <Card title="Hand-offs to Grokbot (Coinbase)">
        <Table
          head={["Hand-off", "Action", "Coin", "Order", "Stop · TP1", "Risk", "Status"]}
          rows={handoffs.map((h) => {
            const x = h as typeof h & { action?: string; quantity?: number; reference_price?: number; limit_price?: number; stop_price?: number; target_1?: number; risk_dollars?: number; order_type?: string };
            return [
              <Mono key="i">{h.handoff_id}</Mono>,
              x.action ?? "open",
              h.symbol,
              <span key="o" className="font-mono">{x.order_type ?? "—"} {num(x.quantity, 6)} @ {num(x.limit_price ?? x.reference_price)}</span>,
              <span key="s" className="font-mono">{num(x.stop_price)} · {num(x.target_1)}</span>,
              money(x.risk_dollars),
              <span key="st"><Badge tone={statusTone(h.status)}>{h.status}</Badge>{h.status_reason && <div className="mt-1 text-[12px] text-white/45">{h.status_reason}</div>}</span>,
            ];
          })}
          empty="No Coinbase hand-offs yet."
        />
      </Card>

      <Card title="System decisions (paper record)" right={<Mono>every signal, taken or not — graded against live fills weekly</Mono>}>
        <Table
          head={["Day", "Coin", "Decision", "Close", "Trigger", "Stop · TP1", "Size", "Outcome / note"]}
          rows={signals.map((s) => [
            s.as_of,
            s.symbol,
            <Badge key="k" tone={s.kind === "entry" ? "green" : s.kind === "exit_regime" || s.kind === "stop" ? "red" : "gray"}>{s.kind.replace("_", " ")}</Badge>,
            <span key="c" className="font-mono">{num(s.close)}</span>,
            <span key="t" className="font-mono">{num(s.trigger_px)}</span>,
            <span key="p" className="font-mono">{num(s.stop)} · {num(s.tp1)}</span>,
            <span key="z" className="font-mono">{s.notional ? money(s.notional) : "—"}</span>,
            <span key="o" className="text-[12.5px] text-white/60">{s.outcome_r != null ? `${num(s.outcome_r, 2)}R · ` : ""}{s.blocked_by ? `blocked: ${s.blocked_by} · ` : ""}{s.note ?? ""}</span>,
          ])}
          empty="No system decisions logged yet — the Coinbase desk writes one per coin after each daily close."
        />
      </Card>

      <Card title="Closed trades">
        <Table
          head={["Trade", "Entry → exit", "R", "P&L", "Fees", "Exit", "Closed"]}
          rows={closed.map((t) => [
            <span key="i"><strong className="text-white">{t.symbol}</strong><br /><Mono>{t.trade_id}</Mono></span>,
            <span key="e" className="font-mono">{num(t.entry)} → {num(t.exit_price)}</span>,
            <span key="r" className={`font-mono ${Number(t.r_multiple) >= 0 ? "text-accent-green" : "text-rose-300"}`}>{num(t.r_multiple, 2)}</span>,
            money(t.realized_pnl),
            money(t.fees),
            t.exit_reason ?? "—",
            when(t.closed_at),
          ])}
          empty="None yet."
        />
      </Card>

      <Card title="Backtests (fees and slippage included)">
        <Table
          head={["Run", "Coins · period", "CAGR · worst drawdown", "Trades", "Avg R · total", "Notes"]}
          rows={data.backtests.map((b) => {
            const p = b.params as Record<string, unknown>;
            return [
              <span key="i"><Mono>{b.engine_code ?? "—"}</Mono><div className="text-[11px] text-white/40">{when(b.created_at)}</div></span>,
              <span key="a">{b.asset}<div className="text-[11px] text-white/40">{b.period_start} → {b.period_end}</div></span>,
              <span key="c" className="font-mono">{p.cagr_pct != null ? `${num(p.cagr_pct, 1)}%` : "—"} · {p.max_dd_pct != null ? `${num(p.max_dd_pct, 1)}%` : "—"}</span>,
              num(b.n_trades, 0),
              <span key="r" className="font-mono">{num(b.avg_r, 2)} · {num(b.total_r, 1)}R</span>,
              <span key="n" className="text-[12.5px] text-white/55">{b.notes ?? ""}</span>,
            ];
          })}
          empty="No backtests saved."
        />
      </Card>
    </div>
  );
}
