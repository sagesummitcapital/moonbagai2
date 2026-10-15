import { getActiveTheses, getSystemState, getYesterdayReview, latestReport } from "@/lib/moonbag/db";
import { buildBriefing } from "@/lib/moonbag/briefing";
import { getCoinbaseBook, getLeverageDesk, getRobinhoodBook, isDeskAlert } from "@/lib/moonbag/desk";
import { load } from "./_components/data";
import { Meter, ScoreBar } from "./_components/charts";
import { LiveMetric, LivePrice } from "./_components/LivePrice";
import { NON_TRADABLE, cryptoSetFrom, kindFor, loadLive, storedOf } from "./_components/live";
import { MorningBrief } from "./_components/MorningBrief";
import { DataNotice } from "./_components/Notice";
import { RightNow, type Freshness } from "./_components/RightNow";
import { ThesisCard } from "./_components/ThesisCard";
import { Badge, Card, Chip, Chips, DocText, Empty, Fold, GoLink, LongText, Id, Mono, Quiet, Stat, TextValue, Unit, Updated, biasGlyph, biasTone, gradeTone, money, money0, num, px, whenShort } from "./_components/ui";

export const dynamic = "force-dynamic";

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

  const bm = briefing?.brief.market;
  const marketBias = bm?.bias ?? master?.bias ?? null;
  const regimeText = bm?.regime ?? state?.current_regime ?? master?.market_regime ?? null;
  const riskText = bm?.risk ?? state?.risk_environment ?? master?.risk_environment ?? null;
  const confTone = conf >= 70 ? "green" : conf >= 50 ? "cyan" : "amber";
  const needsCount = openTrades.length + liveSignals.length + pendingHandoffs.length;

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      {/* ------------------------------------------------ 1. what needs attention now */}
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

      {/* ------------------------------------------------ 2. the three books — one number each */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card tone={lev?.openTrades.length || liveSignals.length ? "accent" : undefined}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Leverage · BloFin</div>
            <GoLink href="/dashboard/leverage" />
          </div>
          {lev ? (
            <>
              <div className="mt-1.5 font-mono text-[26px] font-semibold leading-none tabular-nums text-white">{money(lev.equity)}</div>
              <div className="mt-3 text-[13px] leading-snug text-white/75">
                {lev.openTrades.length ? (
                  <div className="space-y-1">
                    {lev.openTrades.map((t) => (
                      <div key={t.trade_id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-white">{t.symbol} {t.direction}</span>
                        <span className="font-mono text-[12px] tabular-nums text-white/50">@ {px(t.entry)}</span>
                        <LiveMetric symbol={t.symbol} kind={kindFor(t.symbol, cryptoSet)} initial={live[t.symbol]} stored={storedPx[t.symbol] ? storedOf(storedPx[t.symbol].price, storedPx[t.symbol].ts) : undefined} metric="r" entry={t.entry} stop={t.stop} direction={t.direction} />
                      </div>
                    ))}
                  </div>
                ) : liveSignals.length ? (
                  <Chips>
                    {liveSignals.map((s) => (
                      <Badge key={s.signal_id} tone={gradeTone(s.confidence_grade)}>{s.asset} {s.direction} {s.status} — grade {s.confidence_grade}</Badge>
                    ))}
                  </Chips>
                ) : (
                  <span className="text-white/55">Flat — no DESK ALERT, waiting for levels.</span>
                )}
              </div>
              {lev.milestone ? (
                <Meter className="mt-3" value={lev.equity} max={lev.milestone} tone="green" height={5} labels={[<>next milestone <b className="font-mono text-white/70">{money0(lev.milestone)}</b></>, <Updated key="u" label="balance" at={lev.equityReportedAt} cadenceH={30} verb="reported" />]} />
              ) : (
                <p className="mt-3 text-[12px] text-white/45">milestones reached · <Updated label="balance" at={lev.equityReportedAt} cadenceH={30} verb="reported" /></p>
              )}
            </>
          ) : (
            <Empty>Leverage desk not loaded.</Empty>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Long-term · Robinhood</div>
            <GoLink href="/dashboard/robinhood" />
          </div>
          {rh ? (
            <>
              <div className="mt-1.5 font-mono text-[26px] font-semibold leading-none tabular-nums text-white">{rh.snapshot ? money(rh.snapshot.equity) : "—"}</div>
              <div className="mt-3 text-[13px] leading-snug text-white/75">
                {rh.open.length ? (
                  <div className="space-y-1">
                    {rh.open.map((t) => (
                      <div key={t.trade_id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-white">{t.symbol}</span>
                        <span className="font-mono text-[12px] tabular-nums text-white/50">@ {px(t.entry)}</span>
                        <LiveMetric symbol={t.symbol} kind={kindFor(t.symbol, cryptoSet)} initial={live[t.symbol]} stored={storedPx[t.symbol] ? storedOf(storedPx[t.symbol].price, storedPx[t.symbol].ts, "account snapshot") : undefined} metric="pct" entry={t.entry} direction={t.direction} tag={false} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-white/55">In cash — no A-grade setup has met the standard.</span>
                )}
                {rh.equityThesis && <div className="mt-1.5"><Badge tone={biasTone(rh.equityThesis.bias)}>equities {biasGlyph(rh.equityThesis.bias)} {rh.equityThesis.bias}</Badge></div>}
              </div>
              <Meter className="mt-3" value={rh.box.used} max={rh.box.limit} height={5} labels={[<>loss box <b className="font-mono text-white/70">{money(rh.box.used)}</b> of {money(rh.box.limit)}</>, <>fills {rh.fillsThisWeek}/{num(rh.risk?.max_fills_per_week, 0)}</>]} />
            </>
          ) : (
            <Empty>Long-term book not loaded.</Empty>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Crypto trend · Coinbase</div>
            <GoLink href="/dashboard/coinbase" />
          </div>
          {cb ? (
            <>
              <div className="mt-1.5 font-mono text-[26px] font-semibold leading-none tabular-nums text-white">{money(cb.equity)}</div>
              <div className="mt-3 text-[13px] leading-snug text-white/75">
                {cb.open.length ? (
                  <div className="space-y-1">
                    {cb.open.map((t) => (
                      <div key={t.trade_id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-white">{t.symbol}</span>
                        <span className="font-mono text-[12px] tabular-nums text-white/50">@ {px(t.entry)}</span>
                        <LiveMetric symbol={t.symbol} initial={live[t.symbol]} metric="r" entry={t.entry} stop={t.stop} direction="long" tag={false} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-white/55">Flat — cash until a coin closes above its 55-day high.</span>
                )}
                <div className="mt-1.5 text-[12.5px] text-white/50">
                  <span className="font-mono text-accent-green">{cb.universe.filter((u) => u.regime === "bull").length} bull</span> · <span className="font-mono text-rose-300">{cb.universe.filter((u) => u.regime === "bear").length} bear</span> of {cb.universe.length} coins
                </div>
              </div>
              <Meter className="mt-3" value={cb.openRiskPct} max={15} height={5} labels={[<>open risk <b className="font-mono text-white/70">{num(cb.openRiskPct, 1)}%</b> of 15%</>, cb.stats.closed ? `${cb.stats.closed} closed · ${num(cb.stats.totalR, 1)}R` : "no closed trades yet"]} />
            </>
          ) : (
            <Empty>Coinbase book not loaded.</Empty>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------ 3. the market today — one line, two prices */}
      <Card title="Market today" right={<><Updated label="thesis" at={master?.created_at} cadenceH={26} verb="written" /><Updated label="desk check" at={deskCheckedAt} cadenceH={2} verb="" /></>}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`font-mono text-[26px] font-semibold leading-none ${biasTone(marketBias) === "green" ? "text-accent-green" : biasTone(marketBias) === "red" ? "text-rose-300" : "text-white/70"}`}>{biasGlyph(marketBias)} {marketBias ? marketBias[0].toUpperCase() + marketBias.slice(1) : "No view"}</span>
              <span className="text-[13px] text-white/50">confidence <b className={`font-mono tabular-nums ${confTone === "green" ? "text-accent-green" : confTone === "cyan" ? "text-accent-cyan" : "text-amber-200"}`}>{num(conf, 0)}</b>/100</span>
            </div>
            {bm?.view && <LongText text={bm.view} max={180} className="mt-2 text-[14px] leading-relaxed text-white/85" />}
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-white/55">
              {regimeText && <span><span className="text-white/40">Regime:</span> <span className="text-white/80">{regimeText.length > 60 ? `${regimeText.slice(0, 59).trimEnd()}…` : regimeText}</span></span>}
              {riskText && <span><span className="text-white/40">Risk:</span> <span className="text-white/80">{riskText.length > 60 ? `${riskText.slice(0, 59).trimEnd()}…` : riskText}</span></span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["BTC", "ETH"].map((a) => {
              const h = lev?.latest[a];
              return (
                <div key={a} className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[13px] font-semibold text-white">{a}</span>
                    <Badge tone={biasTone(h?.bias)}>{biasGlyph(h?.bias)} {h?.bias ?? "—"}</Badge>
                  </div>
                  <div className="mt-1"><LivePrice symbol={a} kind="crypto" initial={live[a]} stored={h ? storedOf(h.price, h.ts) : undefined} size="md" showChange /></div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------ 4. everything else — present, quiet */}
      <Quiet title="Everything else today" sub={needsCount ? undefined : "tap any row to open it"}>
        {briefing && (
          <Fold title="Morning brief" right={<Mono>built {whenShort(briefing.brief.date)}</Mono>}>
            <MorningBrief
              brief={briefing.brief}
              live={live}
              meta={{ deskCheckedAt, thesisAt: master?.created_at ?? null, levEquityAt: lev?.equityReportedAt ?? null, rhEquityAt: rh?.snapshot?.reported_at ?? null }}
            />
            <div className="mt-3"><DocText summary="Text version — the same brief Grokbot sends" text={briefing.text} /></div>
          </Fold>
        )}

        <Fold title="System state" right={<Updated at={state?.computed_at} cadenceH={26} verb="computed" />}>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat
              label="Moonbag System Confidence"
              size="md"
              value={<>{num(conf, 0)}<Unit>/ 100</Unit></>}
              tone={confTone}
              meter={<Meter value={conf} max={100} tone={confTone} height={6} labels={["0", "100"]} />}
              sub={<>Rolling {state?.rolling_window_days ?? 30} days · {state?.forecasts_graded ?? 0} forecasts graded — measured forecasting quality, not a win probability.</>}
            />
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Market regime</div>
                <Updated at={state?.current_regime ? state.computed_at : master?.created_at} cadenceH={26} verb="" />
              </div>
              <div className="mt-1.5"><TextValue text={state?.current_regime ?? master?.market_regime ?? null} /></div>
            </div>
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Risk environment</div>
                <Updated at={state?.risk_environment ? state.computed_at : master?.created_at} cadenceH={26} verb="" />
              </div>
              <div className="mt-1.5"><TextValue text={state?.risk_environment ?? master?.risk_environment ?? null} /></div>
            </div>
          </div>
        </Fold>

        {cb && (
          <Fold title="Coinbase universe — regime & triggers" count={cb.universe.length} right={<Updated label="regimes" at={cbCloseAt} cadenceH={26} verb={`daily close ${cbCloseDay ?? ""} · processed`} />}>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
              {cb.universe.map((u) => {
                const held = cb.open.find((t) => t.symbol === u.symbol);
                return held ? (
                  <Chip key={u.symbol} tone="cyan" label={`${u.symbol} held`} value={<>@ {px(held.entry)} · stop {px(held.current_stop ?? held.stop)} · <LiveMetric symbol={u.symbol} initial={live[u.symbol]} metric="r" entry={held.entry} stop={held.stop} direction="long" tag={false} /></>} />
                ) : (
                  <Chip key={u.symbol} tone={u.regime === "bull" ? "green" : u.regime === "bear" ? "red" : "gray"} label={u.symbol} value={`${u.regime ?? "—"} · buy > ${px(u.trigger_px)}`} />
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-white/40">&quot;buy &gt;&quot; is the 55-day high that triggers an entry (set at the daily close); bear coins stay in cash. {cb.open.length} held · <Updated label="snapshot" at={cb.snapshot?.reported_at} cadenceH={30} verb="reported" /></p>
          </Fold>
        )}

        {rh && (
          <Fold title="Robinhood — themes & paper" right={<Updated label="snapshot" at={rh.snapshot?.reported_at} cadenceH={30} verb="reported" />}>
            <p className="text-[13px] text-white/70">
              {rh.themes.filter((t) => t.status === "active").length} active themes · {rh.paper.filter((p) => p.status === "open").length} paper trades open
              {rh.open.length ? <> · {rh.open.map((t) => `${t.symbol} @ ${px(t.entry)}${t.current_stop ?? t.stop ? ` (stop ${px(t.current_stop ?? t.stop)})` : ""}`).join(", ")}</> : null}
            </p>
            <div className="mt-2"><GoLink href="/dashboard/robinhood">Open the long-term book →</GoLink></div>
          </Fold>
        )}

        <Fold title="Theses" count={theses.length}>
          <div className="space-y-3">
            {master ? <ThesisCard t={master} title="Master thesis" /> : <Card title="Master thesis"><Empty>No master thesis published today.</Empty></Card>}
            <div className="grid gap-3 lg:grid-cols-2">
              {btc ? <ThesisCard t={btc} title="BTC thesis" live={liveFor("BTC")} kind="crypto" /> : <Card title="BTC thesis"><Empty>No active BTC thesis.</Empty></Card>}
              {eth ? <ThesisCard t={eth} title="ETH thesis" live={liveFor("ETH")} kind="crypto" /> : <Card title="ETH thesis"><Empty>No active ETH thesis.</Empty></Card>}
            </div>
            {others.length ? (
              <div className="grid gap-3 lg:grid-cols-2">{others.map((t) => <ThesisCard key={t.thesis_id} t={t} live={liveFor(t.asset)} kind={kindFor(t.asset, cryptoSet)} />)}</div>
            ) : (
              <Empty>No active equity theses.</Empty>
            )}
          </div>
        </Fold>

        <Fold title={`Yesterday's review · ${data?.yesterday.date ?? "—"}`} count={data?.yesterday.theses.length ?? 0}>
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
        </Fold>

        <Fold title="Latest Moonbag Daily report" right={data?.report ? <Mono>{data.report.report_date} · saved {whenShort(data.report.created_at)}</Mono> : undefined}>
          {data?.report ? (
            <DocText open summary={<span className="font-medium text-white/85">{data.report.title ?? "Read the full report"}</span>} text={data.report.markdown} />
          ) : (
            <Empty>No daily report saved yet.</Empty>
          )}
        </Fold>
      </Quiet>
    </div>
  );
}
