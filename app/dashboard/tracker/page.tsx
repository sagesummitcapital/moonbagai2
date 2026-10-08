import Link from "next/link";
import { listTrades } from "@/lib/moonbag/db";
import { fmtPct, fmtRR, isDeskAlert, tradeMetrics, type LevSignal } from "@/lib/moonbag/desk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Trade } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Mono, Table, biasTone, money, num, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const TZ = "America/Phoenix";
const monthKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric" });

/** A trade counts as breakeven when it finished within a tenth of 1R of zero. */
const BE_BAND = 0.1;

type Row = { r: number | null; pct: number | null; pnl: number | null };

function tally(rows: Row[]) {
  let wins = 0, losses = 0, be = 0, totalR = 0, pct = 0, pnl = 0;
  for (const x of rows) {
    const r = x.r ?? (x.pnl != null ? Math.sign(x.pnl) : 0);
    if (Math.abs(r) < BE_BAND) be++; else if (r > 0) wins++; else losses++;
    totalR += x.r ?? 0;
    pct += x.pct ?? 0;
    pnl += x.pnl ?? 0;
  }
  const decided = wins + losses;
  return { trades: rows.length, wins, losses, be, totalR, pct, pnl, winRate: decided ? (wins * 100) / decided : null };
}

const tradeRow = (t: Trade): Row => ({
  r: t.r_multiple != null ? Number(t.r_multiple) : null,
  pct: tradeMetrics(t).resultPct,
  pnl: t.realized_pnl != null ? Number(t.realized_pnl) - Number(t.fees ?? 0) : null,
});

const signed = (v: number, d = 2, unit = "") => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}${unit}`;
const tone = (v: number | null) => (v == null || v === 0 ? "text-white/70" : v > 0 ? "text-accent-green" : "text-rose-300");

export default async function TrackerPage({ searchParams }: { searchParams?: { m?: string; book?: string } }) {
  const { data, error } = await load(async () => {
    const db = supabaseAdmin();
    const [trades, signals] = await Promise.all([
      listTrades({ status: "closed", limit: 1000 }),
      db.from("lev_signals").select("*").not("outcome", "is", null).order("resolved_at", { ascending: false }).limit(500),
    ]);
    if (signals.error) throw new Error(signals.error.message);
    return { trades, signals: (signals.data ?? []) as LevSignal[] };
  });
  if (!data) return <DataNotice error={error} />;

  const all = data.trades.filter((t) => t.closed_at);
  const nowKey = monthKey(new Date().toISOString());
  const months = Array.from(new Set([nowKey, ...all.map((t) => monthKey(t.closed_at!))])).sort().reverse().slice(0, 8);
  const m = searchParams?.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : nowKey;
  const book = searchParams?.book === "blofin" || searchParams?.book === "robinhood" ? searchParams.book : "all";

  const inMonth = all.filter((t) => monthKey(t.closed_at!) === m);
  const shown = inMonth.filter((t) => book === "all" || t.venue === book);
  const total = tally(shown.map(tradeRow));

  const group = (label: (t: Trade) => string, list = shown) => {
    const map = new Map<string, Trade[]>();
    for (const t of list) map.set(label(t), [...(map.get(label(t)) ?? []), t]);
    return Array.from(map.entries()).map(([name, ts]) => ({ name, ...tally(ts.map(tradeRow)) })).sort((a, b) => b.trades - a.trades);
  };
  const books = [
    { name: "Leverage — BloFin", ...tally(inMonth.filter((t) => t.venue === "blofin").map(tradeRow)) },
    { name: "Long-term — Robinhood", ...tally(inMonth.filter((t) => t.venue === "robinhood").map(tradeRow)) },
  ];

  // Moonbag's own calls, followed on paper whether or not they were taken — the benchmark for your trades.
  const sig = data.signals.filter((s) => s.resolved_at && monthKey(s.resolved_at) === m && ["tp1", "stop", "timeout"].includes(s.outcome ?? ""));
  const sigRow = (list: LevSignal[]) => tally(list.map((s) => ({ r: s.outcome_r != null ? Number(s.outcome_r) : null, pct: s.outcome_r != null && s.risk_percent != null ? Number(s.outcome_r) * Number(s.risk_percent) : null, pnl: null })));
  const calls = [
    { name: "DESK ALERT — grade 4–5 (A/A+)", ...sigRow(sig.filter((s) => isDeskAlert(s) && Number(s.confidence_grade) >= 4)) },
    { name: "DESK ALERT — grade 3 (B starter)", ...sigRow(sig.filter((s) => isDeskAlert(s) && s.confidence_grade === 3)) },
    { name: "RESEARCH ONLY (paper)", ...sigRow(sig.filter((s) => !isDeskAlert(s))) },
  ];

  // Moonbag vs your own calls — leverage trades, all time, so the sample builds up across months.
  const lev = all.filter((t) => t.venue === "blofin");
  const originName = (t: Trade) => (t.origin === "moonbag" ? "Moonbag DESK ALERT" : t.origin === "own" ? "Your own call" : "Not tagged yet");
  const head2head = ["Moonbag DESK ALERT", "Your own call", "Not tagged yet"].map((name) => ({ name, ...tally(lev.filter((t) => originName(t) === name).map(tradeRow)) }));
  const scored = lev.filter((t) => t.origin === "own" && t.moonbag_score != null);
  const ownHigh = tally(scored.filter((t) => Number(t.moonbag_score) >= 55).map(tradeRow));
  const ownLow = tally(scored.filter((t) => Number(t.moonbag_score) < 55).map(tradeRow));

  const href = (mm: string, b = book) => `/dashboard/tracker?m=${mm}${b !== "all" ? `&book=${b}` : ""}`;
  const statTable = (rows: (ReturnType<typeof tally> & { name: string })[], first: string, empty: string) => (
    <Table
      head={[first, "PnL %", "Total R", "Win rate", "Wins", "Losses", "BE", "Trades"]}
      rows={rows.filter((r) => r.trades > 0).map((r) => [
        <strong key="n" className="text-white">{r.name}</strong>,
        <span key="p" className={`font-mono ${tone(r.pct)}`}>{signed(r.pct, 2, "%")}</span>,
        <span key="r" className={`font-mono ${tone(r.totalR)}`}>{signed(r.totalR, 2, "R")}</span>,
        <span key="w" className={`font-mono ${r.winRate == null ? "text-white/50" : r.winRate >= 50 ? "text-accent-green" : "text-rose-300"}`}>{r.winRate == null ? "—" : `${r.winRate.toFixed(1)}%`}</span>,
        <span key="a" className="font-mono text-accent-green">{r.wins}</span>,
        <span key="b" className="font-mono text-rose-300">{r.losses}</span>,
        <span key="c" className="font-mono text-white/55">{r.be}</span>,
        <span key="d" className="font-mono text-amber-200">{r.trades}</span>,
      ])}
      empty={empty}
    />
  );

  return (
    <div className="space-y-6">
      <DataNotice error={error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-white">Trade tracker</h1>
          <p className="mt-1 text-[13.5px] text-white/55">Every closed trade, logged from the database. Nothing is left out or added by hand.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 text-[12.5px]">
          {[["all", "All books"], ["blofin", "Leverage"], ["robinhood", "Long-term"]].map(([k, label]) => (
            <Link key={k} href={href(m, k)} className={`rounded-full px-3 py-1 ${book === k ? "bg-white/[0.1] text-white" : "text-white/55 hover:text-white"}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 text-[13px]">
        {months.map((k) => (
          <Link key={k} href={href(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${k === m ? "border border-amber-300/50 bg-amber-300/10 text-white" : "text-white/55 hover:text-white"}`}>{monthLabel(k)}</Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Tile label="PnL %" value={signed(total.pct, 2, "%")} cls={tone(total.pct)} />
        <Tile label="Total R" value={signed(total.totalR, 2, "R")} cls={tone(total.totalR)} />
        <Tile label="Win rate" value={total.winRate == null ? "—" : `${total.winRate.toFixed(1)}%`} cls={total.winRate == null ? "text-white/60" : total.winRate >= 50 ? "text-accent-green" : "text-rose-300"} />
        <Tile label="Wins" value={String(total.wins)} cls="text-accent-green" />
        <Tile label="Losses" value={String(total.losses)} cls="text-rose-300" />
        <Tile label="BE" value={String(total.be)} cls="text-white/60" />
        <Tile label="Trades" value={String(total.trades)} cls="text-amber-200" />
      </div>
      <p className="-mt-3 text-[12px] text-white/40">
        PnL % = each trade&apos;s result after fees as a share of the account at the time, added up. R = result ÷ the risk to the original stop. Win rate leaves out breakevens (within {BE_BAND}R of zero). Net for {monthLabel(m)}: {money(total.pnl)}.
      </p>

      <Card title="Books">{statTable(books, "Book", `No closed trades in ${monthLabel(m)}.`)}</Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By market">{statTable(group((t) => t.symbol), "Symbol", "No closed trades this month.")}</Card>
        <Card title="By side">{statTable(group((t) => (t.direction === "short" ? "Short" : "Long")), "Side", "No closed trades this month.")}</Card>
      </div>
      <Card title="By setup">{statTable(group((t) => t.setup_type ?? "Off-plan / untagged"), "Setup", "No closed trades this month.")}</Card>

      <Card title="Moonbag's calls — the benchmark" right={<Mono>followed on paper, taken or not</Mono>}>
        {statTable(calls, "Signal grade", "No Moonbag signals finished this month yet.")}
        <p className="mt-3 text-[12.5px] text-white/45">If these rows beat your own trades, the calls are worth waiting for. If your trades beat them, the scoring needs work — the weekly review looks at exactly this.</p>
      </Card>

      <Card title="Moonbag vs your calls — leverage" right={<Mono>all closed BloFin trades</Mono>}>
        {statTable(head2head, "Who called it", "No closed leverage trades yet.")}
        <p className="mt-3 text-[12.5px] text-white/45">
          {scored.length
            ? `Your own trades that Moonbag would have scored 55+: ${ownHigh.trades} (${signed(ownHigh.totalR, 2, "R")}). Scored under 55: ${ownLow.trades} (${signed(ownLow.totalR, 2, "R")}). If the under-55 group keeps winning, the scoring is missing something you see — the weekly review turns that into a rule.`
            : "Each of your own trades is scored after the fact with Moonbag's rubric, so we can see whether the scoring misses setups you catch. Results build up as trades close."}
        </p>
      </Card>

      <Card title={`Trade log — ${monthLabel(m)}`}>
        {shown.length ? (
          <Table
            head={["Closed", "Market", "Side", "Call", "Planned R : R", "Risked", "Result %", "R", "P&L (net)", "Lev", "Held", "Exit"]}
            rows={shown.map((t) => {
              const x = tradeMetrics(t);
              return [
                <span key="c">{when(t.closed_at)}<br /><Mono>{t.trade_id}</Mono></span>,
                <span key="m">{t.symbol} <span className="text-white/40">· {t.venue}</span></span>,
                <Badge key="d" tone={biasTone(t.direction)}>{t.direction}</Badge>,
                <span key="o" className="text-[12.5px]">{t.origin === "moonbag" ? "Moonbag" : t.origin === "own" ? "Own" : "—"}{t.moonbag_score != null ? <span className="text-white/40"> · {num(t.moonbag_score, 0)}</span> : null}</span>,
                <span key="rr" className="font-mono">{fmtRR(x.rr)}</span>,
                <span key="rk" className="font-mono text-rose-300">{fmtPct(x.riskPct)}</span>,
                <span key="rs" className={`font-mono ${tone(x.resultPct)}`}>{fmtPct(x.resultPct, 2)}</span>,
                <span key="r" className={`font-mono ${tone(t.r_multiple)}`}>{t.r_multiple == null ? "—" : signed(Number(t.r_multiple), 2, "R")}</span>,
                <span key="p" className={`font-mono ${tone(Number(t.realized_pnl ?? 0) - Number(t.fees ?? 0))}`}>{money(Number(t.realized_pnl ?? 0) - Number(t.fees ?? 0))}</span>,
                t.leverage != null ? `${num(t.leverage, 0)}x` : "—",
                t.holding_period ?? "—",
                t.exit_reason ?? "—",
              ];
            })}
          />
        ) : (
          <Empty>No closed trades in {monthLabel(m)}.</Empty>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] border-b-amber-300/40 bg-white/[0.025] px-4 py-3.5">
      <div className="text-[12px] text-white/50">{label}</div>
      <div className={`mt-2 font-mono text-[20px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
