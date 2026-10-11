import { getActiveTheses, getSystemState, getYesterdayReview, latestReport } from "@/lib/moonbag/db";
import { buildBriefing } from "@/lib/moonbag/briefing";
import { getCoinbaseBook, getLeverageDesk, getRobinhoodBook, isDeskAlert } from "@/lib/moonbag/desk";
import Link from "next/link";
import { load } from "./_components/data";
import { Meter, ScoreBar } from "./_components/charts";
import { LiveMetric, LivePrice } from "./_components/LivePrice";
import { NON_TRADABLE, cryptoSetFrom, kindFor, loadLive, storedOf } from "./_components/live";
import { MorningBrief } from "./_components/MorningBrief";
import { DataNotice } from "./_components/Notice";
import { RightNow, type Freshness } from "./_components/RightNow";
import { ThesisCard } from "./_components/ThesisCard";
import { Badge, Card, Chip, Chips, DocText, Empty, LongText, Id, Mono, Stat, TextValue, Unit, Updated, biasGlyph, biasTone, gradeTone, money, money0, num, px, whenShort } from "./_components/ui";

export const dynamic = "force-dynamic";

const OpenLink = ({ href }: { href: string }) => (
  <Link href={href} className="text-[12.5px] font-medium text-accent-cyan hover:underline">Open →</Link>
);

export default async function TodayPage() {
  const { data, error } = await load(async () => {
    const [state, theses, yesterday, report] = await Promise.all([
      getSystemState(),
      getActiveTheses(),
      getYesterdayReview(),
      latestReport(),
    ]);
    return { state, theses, yesterday, report };
  });
  // The two books load separately so one failing never blanks the page.
  const [{ data: lev }, { data: rh }, { data: cb }, { data: briefing }] = await Promise.all([load(getLeverageDesk), load(getRobinhoodBook), load(getCoinbaseBook), load(buildBriefing)]);
  const liveSignals = (lev?.signals ?? []).filter((s) => ["armed", "triggered"].includes(s.status) && !s.outcome && isDeskAlert(s));

  const state = data?.state;
  const theses = data?.theses ?? [];
  const master = theses.find((t) => t.asset === "MASTER");
  const btc = theses.find((t) => t.asset === "BTC");
  const eth = theses.find((t) => t.asset === "ETH");
  const others = theses.filter((t) => !["MASTER", "BTC", "ETH"].includes(t.asset));
  const conf = Number(state?.system_confidence ?? 0);

  // ---------------------------------------------------------------- live prices (cached 1 h server-side, polled hourly in the browser)
  const cryptoSet = cryptoSetFrom((lev?.universe ?? []).map((u) => u.asset), (cb?.universe ?? []).map((u) => u.symbol));
  const openTrades = [...(lev?.openTrades ?? []), ...(rh?.open ?? []), ...(cb?.open ?? [])];
  const live = await loadLive(
    [
      "BTC", "ETH",
      ...openTrades.map((t) => t.symbol),
      ...liveSignals.map((s) => s.asset),
      ...(briefing?.brief.rotation.plays ?? []).map((r) => r.asset),
      ...(briefing?.brief.stocks.best ? [briefing.brief.stocks.best.symbol] : []),
      ...theses.map((t) => t.asset).filter((a) => !NON_TRADABLE.has(a)),
    ],
    cryptoSet,
  );
  const storedPx: Record<string, { price: number; ts: string }> = {};
  for (const [a, h] of Object.entries(lev?.latest ?? {})) storedPx[a] = { price: Number(h.price), ts: h.ts };
  for (const p of (Array.isArray(rh?.snapshot?.positions) ? (rh!.snapshot!.positions as { symbol?: string; market_value?: number; quantity?: number }[]) : [])) {
    if (p.symbol && Number(p.quantity) > 0 && Number(p.market_value) > 0 && !storedPx[p.symbol]) storedPx[p.symbol] = { price: Number(p.market_value) / Number(p.quantity), ts: rh!.snapshot!.reported_at };
  }
  const liveFor = (asset: string) => (NON_TRADABLE.has(asset) ? undefined : live[asset] ?? null);

  const deskCheckedAt = lev?.hourly[0]?.ts ?? null;
  const cbCloseDay = cb?.universe.map((u) => u.as_of).filter(Boolean).sort().reverse()[0] ?? null;
  // A daily close dated D happens at 00:00 UTC on D+1, so that is the instant its age counts from.
  const cbCloseAt = cbCloseDay ? new Date(Date.parse(`${cbCloseDay}T00:00:00Z`) + 86400_000).toISOString() : null;
  const freshness: Freshness[] = [
    { label: "BloFin hourly check", at: deskCheckedAt, cadenceH: 2, verb: "ran", href: "/dashboard/leverage" },
    { label: "BloFin balance", at: lev?.equityReportedAt, cadenceH: 30, verb: "reported", href: "/dashboard/leverage" },
    { label: "Robinhood snapshot", at: rh?.snapshot?.reported_at, cadenceH: 30, verb: "reported", href: "/dashboard/robinhood" },
    { label: "Coinbase snapshot", at: cb?.snapshot?.reported_at, cadenceH: 30, verb: "reported", href: "/dashboard/coinbase" },
    { label: "Coinbase daily close", at: cbCloseAt, cadenceH: 26, verb: cbCloseDay ? `${cbCloseDay} · processed` : "", href: "/dashboard/coinbase" },
    { label: "master thesis", at: master?.created_at, cadenceH: 26, verb: "written" },
    { label: "system state", at: state?.computed_at, cadenceH: 26, verb: "computed", href: "/dashboard/intelligence" },
  ];
  const pendingHandoffs = [...(rh?.handoffs ?? []), ...(cb?.handoffs ?? [])].filter((h) => ["pending", "acknowledged"].includes(h.status));

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      {/* ------------------------------------------------ what needs attention now */}
      {(lev || rh || cb) && (
        <RightNow
          trades={openTrades}
          alerts={liveSignals}
          handoffs={pendingHandoffs}
          armedAlerts={(lev?.alerts ?? []).filter((a) => a.status === "active").length}
          live={live}
          cryptoSet={cryptoSet}
          stored={storedPx}
          freshness={freshness}
        />
      )}

      {briefing ? (
        <MorningBrief
          brief={briefing.brief}
          live={live}
          meta={{ deskCheckedAt, thesisAt: master?.created_at ?? null, levEquityAt: lev?.equityReportedAt ?? null, rhEquityAt: rh?.snapshot?.reported_at ?? null }}
        />
      ) : null}

      {/* ------------------------------------------------ system state */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <Stat
            label="Moonbag System Confidence"
            value={<>{num(conf, 0)}<Unit>/ 100</Unit></>}
            tone={conf >= 70 ? "green" : conf >= 50 ? "cyan" : "amber"}
            meter={<Meter value={conf} max={100} tone={conf >= 70 ? "green" : conf >= 50 ? "cyan" : "amber"} height={6} labels={["0", "100"]} />}
            sub={<>Rolling {state?.rolling_window_days ?? 30} days · {state?.forecasts_graded ?? 0} forecasts graded — measured forecasting quality, not a win probability. <Updated at={state?.computed_at} cadenceH={26} verb="computed" /></>}
          />
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Market regime</div>
            <Updated at={state?.current_regime ? state.computed_at : master?.created_at} cadenceH={26} verb="" />
          </div>
          <div className="mt-1.5"><TextValue text={state?.current_regime ?? master?.market_regime ?? null} /></div>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Risk environment</div>
            <Updated at={state?.risk_environment ? state.computed_at : master?.created_at} cadenceH={26} verb="" />
          </div>
          <div className="mt-1.5"><TextValue text={state?.risk_environment ?? master?.risk_environment ?? null} /></div>
        </Card>
      </div>

      {/* ------------------------------------------------ the three books */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Book 1 · Long-term (Robinhood)" right={<OpenLink href="/dashboard/robinhood" />}>
          {rh ? (
            <>
              <Stat
                label="Account"
                value={rh.snapshot ? money(rh.snapshot.equity) : "—"}
                size="md"
                right={rh.equityThesis ? <Badge tone={biasTone(rh.equityThesis.bias)}>equities {biasGlyph(rh.equityThesis.bias)} {rh.equityThesis.bias}</Badge> : undefined}
                meter={<Meter value={rh.box.used} max={rh.box.limit} height={6} labels={[<>loss box <b className="font-mono text-white/70">{money(rh.box.used)}</b> of {money(rh.box.limit)}</>, <>fills {rh.fillsThisWeek}/{num(rh.risk?.max_fills_per_week, 0)} this week</>]} />}
                sub={<Updated label="account snapshot" at={rh.snapshot?.reported_at} cadenceH={30} verb="reported" />}
              />
              <div className="mt-4">
                {rh.open.length ? (
                  <div className="space-y-1.5">
                    {rh.open.map((t) => (
                      <div key={t.trade_id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12.5px]">
                        <span className="inline-flex flex-wrap items-baseline gap-x-2">
                          <span className="font-semibold text-white">{t.symbol}</span>
                          <span className="font-mono tabular-nums text-white/60">@ {px(t.entry)}{t.current_stop ?? t.stop ? ` · stop ${px(t.current_stop ?? t.stop)}` : ""}</span>
                        </span>
                        <span className="inline-flex flex-wrap items-baseline gap-x-2">
                          <LivePrice symbol={t.symbol} kind={kindFor(t.symbol, cryptoSet)} initial={live[t.symbol]} stored={storedPx[t.symbol] ? storedOf(storedPx[t.symbol].price, storedPx[t.symbol].ts, "account snapshot") : undefined} size="inline" />
                          <LiveMetric symbol={t.symbol} kind={kindFor(t.symbol, cryptoSet)} initial={live[t.symbol]} stored={storedPx[t.symbol] ? storedOf(storedPx[t.symbol].price, storedPx[t.symbol].ts, "account snapshot") : undefined} metric="pct" entry={t.entry} direction={t.direction} tag={false} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13.5px] text-white/75">In cash — no A-grade setup has met the standard.</p>
                )}
              </div>
              <p className="mt-2.5 text-[12.5px] text-white/50">
                {rh.themes.filter((t) => t.status === "active").length} active themes · {rh.paper.filter((p) => p.status === "open").length} paper trades open
              </p>
            </>
          ) : (
            <Empty>Long-term book not loaded.</Empty>
          )}
        </Card>

        <Card title="Book 2 · Leverage desk (BloFin)" right={<OpenLink href="/dashboard/leverage" />} tone={lev?.openTrades.length || liveSignals.length ? "accent" : undefined}>
          {lev ? (
            <>
              <Stat
                label="Account"
                value={money(lev.equity)}
                size="md"
                right={<Badge tone="gray">strategy v{lev.strategy?.version ?? "—"}</Badge>}
                meter={lev.milestone ? <Meter value={lev.equity} max={lev.milestone} tone="green" height={6} labels={[<>next milestone <b className="font-mono text-white/70">{money0(lev.milestone)}</b></>, <Updated key="u" label="balance" at={lev.equityReportedAt} cadenceH={30} verb="reported" />]} /> : <p className="text-[12.5px] text-white/50">milestones reached · <Updated label="balance" at={lev.equityReportedAt} cadenceH={30} verb="reported" /></p>}
                sub={<Updated label="hourly check" at={lev.hourly[0]?.ts} cadenceH={2} verb="ran" />}
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["BTC", "ETH"].map((a) => {
                  const h = lev.latest[a];
                  return (
                    <div key={a} className="min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[13px] font-semibold text-white">{a}</span>
                        <Badge tone={biasTone(h?.bias)}>{biasGlyph(h?.bias)} {h?.bias ?? "—"}</Badge>
                      </div>
                      <div className="mt-1"><LivePrice symbol={a} kind="crypto" initial={live[a]} stored={h ? storedOf(h.price, h.ts) : undefined} size="md" showChange /></div>
                      {h && <div className="mt-1 font-mono text-[11px] tabular-nums text-white/35">desk check {px(h.price)} · {whenShort(h.ts)}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 text-[13px] leading-snug text-white/75">
                {lev.openTrades.length ? (
                  <div className="space-y-1">
                    {lev.openTrades.map((t) => (
                      <div key={t.trade_id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-white/45">In a trade:</span>
                        <span>{t.symbol} {t.direction} @ {px(t.entry)}</span>
                        <LiveMetric symbol={t.symbol} kind={kindFor(t.symbol, cryptoSet)} initial={live[t.symbol]} stored={storedPx[t.symbol] ? storedOf(storedPx[t.symbol].price, storedPx[t.symbol].ts) : undefined} metric="r" entry={t.entry} stop={t.stop} direction={t.direction} />
                      </div>
                    ))}
                  </div>
                ) : liveSignals.length ? (
                  <Chips>
                    {liveSignals.map((s) => (
                      <Badge key={s.signal_id} tone={gradeTone(s.confidence_grade)}>{s.asset} {s.direction} {s.status} — grade {s.confidence_grade} ({num(s.confidence_score, 0)}/100)</Badge>
                    ))}
                  </Chips>
                ) : (
                  <span className="text-white/50">No DESK ALERT right now — waiting for levels.</span>
                )}
              </div>
            </>
          ) : (
            <Empty>Leverage desk not loaded.</Empty>
          )}
        </Card>

        <Card title="Book 3 · Crypto trend (Coinbase)" className="lg:col-span-2" right={<OpenLink href="/dashboard/coinbase" />}>
          {cb ? (
            <>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Stat
                  label="Account"
                  value={money(cb.equity)}
                  size="md"
                  meter={<Meter value={cb.openRiskPct} max={15} height={6} labels={[<>open risk <b className="font-mono text-white/70">{num(cb.openRiskPct, 1)}%</b> of 15%</>, cb.stats.closed ? `${cb.stats.closed} closed · ${num(cb.stats.totalR, 1)}R` : "no closed trades yet"]} />}
                  sub={<Updated label="account snapshot" at={cb.snapshot?.reported_at} cadenceH={30} verb="reported" />}
                />
                <div className="text-[12.5px] text-white/50 md:text-right">
                  <span className="rounded-md bg-accent-green/15 px-1.5 py-0.5 font-mono text-accent-green">{cb.universe.filter((u) => u.regime === "bull").length} bull</span>
                  <span className="ml-1.5 rounded-md bg-rose-400/15 px-1.5 py-0.5 font-mono text-rose-300">{cb.universe.filter((u) => u.regime === "bear").length} bear</span>
                  <span className="ml-1.5">of {cb.universe.length} coins · {cb.open.length} held</span>
                  <div className="mt-1.5 md:flex md:justify-end"><Updated label="regimes" at={cbCloseAt} cadenceH={26} verb={`daily close ${cbCloseDay ?? ""} · processed`} /></div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                {cb.universe.map((u) => {
                  const held = cb.open.find((t) => t.symbol === u.symbol);
                  return held ? (
                    <Chip key={u.symbol} tone="cyan" label={`${u.symbol} held`} value={<>@ {px(held.entry)} · stop {px(held.current_stop ?? held.stop)} · <LiveMetric symbol={u.symbol} initial={live[u.symbol]} metric="r" entry={held.entry} stop={held.stop} direction="long" tag={false} /></>} />
                  ) : (
                    <Chip key={u.symbol} tone={u.regime === "bull" ? "green" : u.regime === "bear" ? "red" : "gray"} label={u.symbol} value={`${u.regime ?? "—"} · buy > ${px(u.trigger_px)}`} />
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-white/40">"buy &gt;" is the 55-day high that triggers an entry (set at the daily close); bear coins stay in cash.</p>
            </>
          ) : (
            <Empty>Coinbase book not loaded.</Empty>
          )}
        </Card>
      </div>

      {briefing && <DocText summary="Text version — the same brief Grokbot sends" text={briefing.text} />}

      {/* ------------------------------------------------ theses */}
      {master ? <ThesisCard t={master} title="Master thesis" /> : <Card title="Master thesis"><Empty>No master thesis published today.</Empty></Card>}

      <div className="grid gap-3 lg:grid-cols-2">
        {btc ? <ThesisCard t={btc} title="BTC thesis" live={liveFor("BTC")} kind="crypto" /> : <Card title="BTC thesis"><Empty>No active BTC thesis.</Empty></Card>}
        {eth ? <ThesisCard t={eth} title="ETH thesis" live={liveFor("ETH")} kind="crypto" /> : <Card title="ETH thesis"><Empty>No active ETH thesis.</Empty></Card>}
      </div>

      <Card title="Equity & other theses" right={<Badge tone="gray">{others.length} active</Badge>}>
        {others.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{others.map((t) => <ThesisCard key={t.thesis_id} t={t} live={liveFor(t.asset)} kind={kindFor(t.asset, cryptoSet)} />)}</div>
        ) : (
          <Empty>No active equity theses.</Empty>
        )}
      </Card>

      {/* ------------------------------------------------ yesterday */}
      <Card title={`Yesterday's review (${data?.yesterday.date ?? "—"})`}>
        {data?.yesterday.theses.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {data.yesterday.theses.map((t) => {
              const ev = data.yesterday.evaluations.find((e) => e.thesis_id === t.thesis_id);
              return (
                <li key={t.thesis_id} className="grid items-start gap-x-4 gap-y-1 py-2.5 text-[13.5px] md:grid-cols-[150px_120px_minmax(0,1fr)]">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <strong className="text-white">{t.asset}</strong>
                    <Badge tone={biasTone(t.bias)}>{biasGlyph(t.bias)} {t.bias}</Badge>
                  </div>
                  <div>{ev ? <ScoreBar value={ev.total_score} tone={Number(ev.total_score) >= 70 ? "green" : Number(ev.total_score) >= 50 ? "cyan" : "amber"} label={`${num(ev.total_score, 0)}/100`} width="w-[120px]" /> : <Badge tone="amber">needs grading</Badge>}</div>
                  <div className="min-w-0">
                    {ev?.lesson && <LongText text={ev.lesson} max={160} className="text-[13px] leading-snug text-white/70" />}
                    <Id>{t.thesis_id}</Id>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No theses were recorded yesterday.</Empty>
        )}
      </Card>

      <Card title="Latest Moonbag Daily report" right={data?.report ? <Mono>{data.report.report_date} · saved {whenShort(data.report.created_at)}</Mono> : undefined}>
        {data?.report ? (
          <DocText summary={<span className="font-medium text-white/85">{data.report.title ?? "Read the full report"}</span>} text={data.report.markdown} />
        ) : (
          <Empty>No daily report saved yet.</Empty>
        )}
      </Card>
    </div>
  );
}
