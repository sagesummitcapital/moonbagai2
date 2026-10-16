import Link from "next/link";
import { listTrades } from "@/lib/moonbag/db";
import { fmtPct, fmtRR, isDeskAlert, tradeMetrics, type LevSignal } from "@/lib/moonbag/desk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Trade } from "@/lib/moonbag/types";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { OpenTradeTile } from "../_components/Attention";
import { cryptoSetFrom, loadLive } from "../_components/live";
import { DivergingBars } from "../_components/charts";
import { Badge, Card, Empty, Fold, Id, Mono, Note, PageHeader, Quiet, Table, biasGlyph, biasTone, money, num, px2, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const TZ = "America/Phoenix";
const monthKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
/** Monday of the Phoenix week that contains this day key. */
const weekKey = (dk: string) => { const d = new Date(`${dk}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric" });

/** A trade counts as breakeven when it finished within a tenth of 1R of zero. */
const BE_BAND = 0.1;

type Row = { r: number | null; pct: number | null; pnl: number | null };

type Metrics = Record<string, number | string | null>;
type ScoreRow = { week_start: string; metrics: Metrics; targets: Record<string, string> | null; met: Record<string, boolean> | null; score: number | null; score_of: number | null; focus: string | null; focus_kpi: string | null; last_change_verdict: string | null };
type Review72 = { trade_id: string; symbol: string; direction: string; opened_at: string; r_realized: number | null; mfe_r: number | null; capture_pct: number | null; best_play: string | null; what_price_did: string | null; improve: string | null; verdict: string | null };
/** Monday of this week in Phoenix (YYYY-MM-DD). */
function phoenixMonday() {
  const d = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const KPIS: [key: string, label: string, fmt: (v: number) => string][] = [
  ["sent_avg_r", "Moonbag's calls (avg R)", (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}R`],
  ["model_avg_r", "All desk plays (avg R)", (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}R`],
  ["bias_hit_pct", "Open-plan bias right", (v) => `${v.toFixed(0)}%`],
  ["you_avg_r", "Your trades (avg R)", (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}R`],
  ["capture_pct", "Move you kept", (v) => `${v.toFixed(0)}%`],
  ["rule_breaks", "Risk-rule breaks", (v) => `${v.toFixed(0)}`],
];

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
    const wk = phoenixMonday();
    const [trades, open, signals, cards, live, reviews] = await Promise.all([
      listTrades({ status: "closed", limit: 1000 }),
      listTrades({ status: "open", limit: 200 }),
      db.from("lev_signals").select("*").not("outcome", "is", null).order("resolved_at", { ascending: false }).limit(500),
      db.from("lev_scorecard").select("week_start, metrics, targets, met, score, score_of, focus, focus_kpi, last_change_verdict").order("week_start", { ascending: false }).limit(8),
      db.rpc("lev_weekly_scorecard", { p_week_start: wk }),
      db.from("trade_review_72h").select("trade_id, symbol, direction, opened_at, r_realized, mfe_r, capture_pct, best_play, what_price_did, improve, verdict").order("opened_at", { ascending: false }).limit(20),
    ]);
    if (signals.error) throw new Error(signals.error.message);
    return {
      trades, open, signals: (signals.data ?? []) as LevSignal[],
      // feedback loop (display only): weekly scorecards, this week so far, and the 72h trade reviews
      cards: (cards.data ?? []) as ScoreRow[],
      thisWeek: (live.data ?? null) as Metrics | null,
      reviews: (reviews.data ?? []) as Review72[],
      wk,
    };
  });
  if (!data) return <DataNotice error={error} />;

  const all = data.trades.filter((t) => t.closed_at);
  const nowKey = monthKey(new Date().toISOString());
  const months = Array.from(new Set([nowKey, ...all.map((t) => monthKey(t.closed_at!))])).sort().reverse().slice(0, 8);
  const m = searchParams?.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : nowKey;
  // Leverage is the daily income and the default view; Coinbase + Robinhood are long-term holds and live on their own tab
  // (Stavros 2026-10-16: "keep the coinbase seperate on trade tracker ... a place to see my lev trade results").
  const book: "blofin" | "longterm" = ["robinhood", "coinbase", "longterm"].includes(searchParams?.book ?? "") ? "longterm" : "blofin";

  const inMonth = all.filter((t) => monthKey(t.closed_at!) === m);
  const shown = inMonth.filter((t) => (book === "blofin" ? t.venue === "blofin" : t.venue !== "blofin"));
  const total = tally(shown.map(tradeRow));

  const group = (label: (t: Trade) => string, list = shown) => {
    const map = new Map<string, Trade[]>();
    for (const t of list) map.set(label(t), [...(map.get(label(t)) ?? []), t]);
    return Array.from(map.entries()).map(([name, ts]) => ({ name, ...tally(ts.map(tradeRow)) })).sort((a, b) => b.trades - a.trades);
  };
  const books = [
    { name: "Coinbase — crypto holds", ...tally(inMonth.filter((t) => t.venue === "coinbase").map(tradeRow)) },
    { name: "Robinhood — stock holds", ...tally(inMonth.filter((t) => t.venue === "robinhood").map(tradeRow)) },
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

  const href = (mm: string, b: string = book) => `/dashboard/tracker?m=${mm}${b !== "blofin" ? `&book=${b}` : ""}`;

  // ---- leverage income: today / this week / this month / all time (Phoenix days), independent of the month picker
  const todayK = dayKey(new Date().toISOString());
  const levDay = (t: Trade) => dayKey(t.closed_at!);
  const income = [
    { label: "Today", ...tally(lev.filter((t) => levDay(t) === todayK).map(tradeRow)) },
    { label: "This week", ...tally(lev.filter((t) => weekKey(levDay(t)) === weekKey(todayK)).map(tradeRow)) },
    { label: "This month", ...tally(lev.filter((t) => monthKey(t.closed_at!) === nowKey).map(tradeRow)) },
    { label: "All time", ...tally(lev.map(tradeRow)) },
  ];
  // day-by-day for the selected month (leverage only)
  const days = Array.from(new Set(lev.filter((t) => monthKey(t.closed_at!) === m).map(levDay))).sort().reverse()
    .map((d) => ({ name: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), ...tally(lev.filter((t) => levDay(t) === d).map(tradeRow)) }));

  // ---- open trades (display only)
  const openLev = data.open.filter((t) => t.venue === "blofin");
  const openLT = data.open.filter((t) => t.venue === "coinbase" || t.venue === "robinhood");
  const cbSyms = data.open.filter((t) => t.venue === "coinbase" || t.venue === "blofin").map((t) => t.symbol);
  const live = await loadLive((book === "blofin" ? openLev : openLT).map((t) => t.symbol), cryptoSetFrom(cbSyms));
  const statTable = (rows: (ReturnType<typeof tally> & { name: string })[], first: string, empty: string, bars = true) => {
    const live = rows.filter((r) => r.trades > 0);
    return (
    <>
      {bars && live.length > 0 && (
        <DivergingBars
          className="mb-4"
          labelWidth="minmax(110px, 34%)"
          format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`}
          items={live.map((r) => ({ label: r.name, sub: `${r.trades} trade${r.trades === 1 ? "" : "s"}`, value: r.totalR }))}
        />
      )}
    <Table
      head={[first, "PnL %", "Total R", "Win rate", "Wins", "Losses", "BE", "Trades"]}
      align={["l", "r", "r", "r", "r", "r", "r", "r"]}
      rows={live.map((r) => [
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
    </>
    );
  };

  const tabs = (
    <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 text-[12.5px]">
      {([["blofin", "Leverage · daily income"], ["longterm", "Long-term holds"]] as const).map(([k, label]) => (
        <Link key={k} href={href(m, k)} className={`whitespace-nowrap rounded-full px-3 py-1 ${book === k ? "bg-white/[0.1] font-medium text-white" : "text-white/55 hover:text-white"}`}>{label}</Link>
      ))}
    </div>
  );
  const monthPicker = (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 text-[13px]">
      {months.map((k) => (
        <Link key={k} href={href(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${k === m ? "border border-amber-300/50 bg-amber-300/10 font-medium text-white" : "text-white/55 hover:text-white"}`}>{monthLabel(k)}</Link>
      ))}
    </div>
  );
  const tradeLog = (
    <Fold count={shown.length} title={`Trade log — ${monthLabel(m)}`} open={book === "blofin"}>
      {shown.length ? (
        <Table
          head={["Closed", "Market", "Side", "Call", "Planned R : R", "Risked", "Result %", "R", "P&L (net)", "Lev", "Held", "Exit"]}
          align={["l", "l", "l", "l", "r", "r", "r", "r", "r", "r", "l", "l"]}
          minWidth={1100}
          rows={shown.map((t) => {
            const x = tradeMetrics(t);
            return [
              <span key="c"><span className="whitespace-nowrap">{when(t.closed_at)}</span><br /><Id>{t.trade_id}</Id></span>,
              <span key="m">{t.symbol} <span className="text-white/40">· {t.venue}</span></span>,
              <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
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
    </Fold>
  );
  const monthTiles = (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Tile label={`Net ${monthLabel(m)}`} value={money(total.pnl)} cls={tone(total.pnl)} wide />
        <Tile label="PnL %" value={signed(total.pct, 2, "%")} cls={tone(total.pct)} />
        <Tile label="Total R" value={signed(total.totalR, 2, "R")} cls={tone(total.totalR)} />
        <Tile label="Win rate" value={total.winRate == null ? "—" : `${total.winRate.toFixed(1)}%`} cls={total.winRate == null ? "text-white/60" : total.winRate >= 50 ? "text-accent-green" : "text-rose-300"} />
        <Tile label="Wins" value={String(total.wins)} cls="text-accent-green" />
        <Tile label="Losses" value={String(total.losses)} cls="text-rose-300" />
        <Tile label="Trades" value={`${total.trades}${total.be ? ` · ${total.be} BE` : ""}`} cls="text-amber-200" />
      </div>
      <Note className="-mt-2">
        Net = P&amp;L after fees. PnL % = each trade&apos;s result as a share of the account at the time, added up. R = result ÷ the risk to the original stop. Win rate leaves out breakevens (within {BE_BAND}R of zero).
      </Note>
    </>
  );

  if (book === "longterm") {
    const holdRows = (venue: string) => openLT.filter((t) => t.venue === venue).map((t) => {
      const p = live[t.symbol.toUpperCase()]?.ok ? live[t.symbol.toUpperCase()]?.price ?? null : null;
      const q = Number(t.qty_open ?? t.quantity ?? 0), cost = Number(t.entry) * q;
      const val = p != null ? p * q : null;
      const up = val != null ? val - cost : null;
      return [
        <span key="s"><strong className="text-white">{t.symbol}</strong><br /><Id>{t.trade_id}</Id></span>,
        <span key="e" className="font-mono">{px2(t.entry)}</span>,
        <span key="q" className="font-mono">{num(q, 6)}</span>,
        <span key="c" className="font-mono">{money(cost)}</span>,
        <span key="p" className="font-mono">{p == null ? "—" : px2(p)}</span>,
        <span key="u" className={`font-mono ${tone(up)}`}>{up == null ? "—" : `${money(up)} (${signed((up * 100) / (cost || 1), 1, "%")})`}</span>,
        <span key="w" className="font-mono text-white/60">{t.current_stop ?? t.stop ? `${px2(t.current_stop ?? t.stop)} · warn only` : "no stop"}</span>,
        <span key="o" className="whitespace-nowrap text-white/60">{when(t.opened_at)}</span>,
      ];
    });
    const holdTable = (venue: string, empty: string) => (
      <Table head={["Holding", "Avg entry", "Qty", "Cost", "Now", "Unrealised", "Warning line", "Bought"]} align={["l", "r", "r", "r", "r", "r", "r", "l"]} minWidth={860} rows={holdRows(venue)} empty={empty} />
    );
    return (
      <div className="space-y-5">
        <DataNotice error={error} />
        <PageHeader
          title="Trade tracker"
          kicker="Long-term holds"
          sub="Coinbase and Robinhood are long-term investments — kept apart from your leverage income. Moonbag never sells a hold on its own: a break below the warning line is a message to you, and only you decide to sell."
          right={tabs}
        />
        <Card title="Coinbase — crypto holds" right={<Mono>{openLT.filter((t) => t.venue === "coinbase").length} open</Mono>}>
          {holdTable("coinbase", "No Coinbase holds open.")}
        </Card>
        <Card title="Robinhood — stock holds" right={<Mono>{openLT.filter((t) => t.venue === "robinhood").length} open</Mono>}>
          {holdTable("robinhood", "No Robinhood holds open.")}
        </Card>
        {monthPicker}
        <Card title={`Closed — ${monthLabel(m)}`}>{statTable(books, "Book", `Nothing closed on Coinbase or Robinhood in ${monthLabel(m)}.`)}</Card>
        <Quiet title="The log" sub="tap to open">{tradeLog}</Quiet>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      <PageHeader
        title="Trade tracker"
        kicker="Leverage · BloFin"
        sub="Your daily income — every closed BloFin trade, straight from the database. Coinbase and Robinhood are on the Long-term tab."
        right={tabs}
      />

      {/* ---- 1. income at a glance */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {income.map((x) => (
          <div key={x.label} className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">{x.label}</div>
            <div className={`mt-2 break-words font-mono text-[22px] font-semibold leading-none tabular-nums ${tone(x.pnl)}`}>{x.trades ? money(x.pnl) : "—"}</div>
            <div className="mt-1.5 font-mono text-[12px] tabular-nums text-white/55">
              {x.trades ? <><span className={tone(x.totalR)}>{signed(x.totalR, 2, "R")}</span> · {x.trades} trade{x.trades === 1 ? "" : "s"}{x.winRate != null ? ` · ${x.winRate.toFixed(0)}% win` : ""}</> : "no closed trades"}
            </div>
          </div>
        ))}
      </div>

      {/* ---- 2. open right now */}
      <Card title="Open leverage trades" right={<Mono>{openLev.length} open{openLev.length ? ` · risk ${money(openLev.reduce((a, t) => a + Number(t.risk_dollars ?? 0), 0))}` : ""}</Mono>}>
        {openLev.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {openLev.map((t) => <OpenTradeTile key={t.trade_id} t={t} live={live[t.symbol.toUpperCase()]} />)}
          </div>
        ) : (
          <Empty>No open leverage trade. When you take one, tell Grok and it shows up here with entry, stop, targets, size, leverage, liquidation and live P&amp;L.</Empty>
        )}
      </Card>

      {/* ---- 3. getting better? (the weekly feedback loop) */}
      <Card title="Getting better?" sub="Scored every Saturday against the last 4 weeks. One focus a week fixes the biggest miss." right={<Mono>{data.cards[0] ? `last scored ${data.cards[0].score}/${data.cards[0].score_of}` : "first score Saturday"}</Mono>}>
        {data.cards[0]?.focus && (
          <Note className="mb-3"><strong className="text-white">This week&apos;s focus:</strong> {data.cards[0].focus}{data.cards[0].last_change_verdict ? <span className="text-white/50"> · last focus: {data.cards[0].last_change_verdict}</span> : null}</Note>
        )}
        <Table
          head={["", `This week so far`, ...data.cards.slice(0, 5).map((c) => new Date(`${c.week_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }))]}
          align={["l", "r", ...data.cards.slice(0, 5).map(() => "r" as const)]}
          minWidth={620}
          rows={[
            ...KPIS.map(([k, label, f]) => {
              const cell = (m: Metrics | null | undefined, ok?: boolean) => {
                const v = m?.[k];
                if (v == null) return <span className="text-white/30">—</span>;
                return <span className={`font-mono ${ok == null ? "text-white/80" : ok ? "text-accent-green" : "text-rose-300"}`}>{f(Number(v))}{ok == null ? "" : ok ? " ✓" : " ✗"}</span>;
              };
              return [<span key="l" className="text-white/80">{label}</span>, <span key="t">{cell(data.thisWeek)}</span>, ...data.cards.slice(0, 5).map((c) => <span key={c.week_start}>{cell(c.metrics, c.met?.[k])}</span>)];
            }),
            [<strong key="s" className="text-white">Score</strong>, <span key="t" className="text-white/40">Saturday</span>, ...data.cards.slice(0, 5).map((c) => <strong key={c.week_start} className="font-mono text-amber-200">{c.score}/{c.score_of}</strong>)],
          ]}
        />
        <Note className="mt-2">✓ / ✗ = met that week&apos;s target. &quot;Moonbag&apos;s calls&quot; = the grade 4–5 alerts and limit setups it sent you, followed to the end. &quot;Move you kept&quot; = your R ÷ the best R price offered in the 72h after your entry.</Note>
      </Card>

      {data.reviews.length > 0 && (
        <Fold title="72-hour reviews — what price did after your entries" count={data.reviews.length} open>
          <div className="space-y-2">
            {data.reviews.slice(0, 8).map((r) => (
              <div key={r.trade_id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-[13px] leading-relaxed">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-white">{r.symbol}</strong>
                  <Badge tone={biasTone(r.direction)}>{biasGlyph(r.direction)} {r.direction}</Badge>
                  <span className="font-mono text-white/60">{when(r.opened_at)}</span>
                  <span className={`font-mono ${tone(r.r_realized)}`}>you {r.r_realized == null ? "—" : signed(Number(r.r_realized), 2, "R")}</span>
                  <span className="font-mono text-white/60">best {r.mfe_r == null ? "—" : signed(Number(r.mfe_r), 2, "R")}</span>
                  {r.capture_pct != null && <span className="font-mono text-amber-200">kept {Number(r.capture_pct).toFixed(0)}%</span>}
                  {r.verdict && r.verdict !== "backfill" && <Badge tone="gray">{r.verdict.replace(/_/g, " ")}</Badge>}
                </div>
                {r.what_price_did && <div className="mt-1 text-white/70">{r.what_price_did}</div>}
                {r.best_play && <div className="mt-1 text-white/60">Best play: {r.best_play}</div>}
                {r.improve && <div className="mt-1 text-accent-green/90">Next time: {r.improve}</div>}
              </div>
            ))}
          </div>
        </Fold>
      )}

      {/* ---- 4. the month */}
      {monthPicker}
      {monthTiles}

      <Card title={`Day by day — ${monthLabel(m)}`}>{statTable(days, "Day", `No closed leverage trades in ${monthLabel(m)}.`)}</Card>

      {tradeLog}

      <Quiet title="Breakdowns" sub="tap any row to open it">
      <div className="space-y-2">
        <Fold title="By market">{statTable(group((t) => t.symbol), "Symbol", "No closed trades this month.")}</Fold>
        <Fold title="By side">{statTable(group((t) => (t.direction === "short" ? "Short" : "Long")), "Side", "No closed trades this month.", false)}</Fold>
        <Fold title="By setup">{statTable(group((t) => t.setup_type ?? "Off-plan / untagged"), "Setup", "No closed trades this month.")}</Fold>

        <Fold title="Moonbag's calls — the benchmark" right={<Mono>followed on paper, taken or not</Mono>}>
          {statTable(calls, "Signal grade", "No Moonbag signals finished this month yet.")}
          <Note>If these rows beat your own trades, the calls are worth waiting for. If your trades beat them, the scoring needs work — the weekly review looks at exactly this.</Note>
        </Fold>

        <Fold title="Moonbag vs your calls" right={<Mono>all closed BloFin trades</Mono>}>
          {statTable(head2head, "Who called it", "No closed leverage trades yet.")}
          <Note>
            {scored.length
              ? `Your own trades that Moonbag would have scored 55+: ${ownHigh.trades} (${signed(ownHigh.totalR, 2, "R")}). Scored under 55: ${ownLow.trades} (${signed(ownLow.totalR, 2, "R")}). If the under-55 group keeps winning, the scoring is missing something you see — the weekly review turns that into a rule.`
              : "Each of your own trades is scored after the fact with Moonbag's rubric, so we can see whether the scoring misses setups you catch. Results build up as trades close."}
          </Note>
        </Fold>
      </div>
      </Quiet>
    </div>
  );
}

function Tile({ label, value, cls, wide = false }: { label: string; value: string; cls: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 ${wide ? "col-span-2 md:col-span-1" : ""}`}>
      <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className={`mt-2 break-words font-mono text-[22px] font-semibold leading-none tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
