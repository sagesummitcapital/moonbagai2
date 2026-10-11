import { getActiveTheses, getSystemState, getYesterdayReview, latestReport } from "@/lib/moonbag/db";
import { buildBriefing } from "@/lib/moonbag/briefing";
import { getCoinbaseBook, getLeverageDesk, getRobinhoodBook, isDeskAlert } from "@/lib/moonbag/desk";
import Link from "next/link";
import { load } from "./_components/data";
import { Meter, ScoreBar } from "./_components/charts";
import { MorningBrief } from "./_components/MorningBrief";
import { DataNotice } from "./_components/Notice";
import { ThesisCard } from "./_components/ThesisCard";
import { Badge, Card, Chip, Chips, DocText, Empty, LongText, Id, Mono, Stat, TextValue, Unit, biasGlyph, biasTone, gradeTone, money, money0, num, when } from "./_components/ui";

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

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      {briefing ? <MorningBrief brief={briefing.brief} /> : null}

      {/* ------------------------------------------------ system state */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <Stat
            label="Moonbag System Confidence"
            value={<>{num(conf, 0)}<Unit>/ 100</Unit></>}
            tone={conf >= 70 ? "green" : conf >= 50 ? "cyan" : "amber"}
            meter={<Meter value={conf} max={100} tone={conf >= 70 ? "green" : conf >= 50 ? "cyan" : "amber"} height={6} labels={["0", "100"]} />}
            sub={`Rolling ${state?.rolling_window_days ?? 30} days · ${state?.forecasts_graded ?? 0} forecasts graded — measured forecasting quality, not a win probability.`}
          />
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Market regime</div>
          <div className="mt-1.5"><TextValue text={state?.current_regime ?? master?.market_regime ?? null} /></div>
        </Card>
        <Card>
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">Risk environment</div>
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
              />
              <div className="mt-4">
                {rh.open.length ? (
                  <Chips>
                    {rh.open.map((t) => (
                      <Chip key={t.trade_id} tone="green" label={t.symbol} value={`@ ${num(t.entry)} · stop ${num(t.current_stop ?? t.stop)}`} />
                    ))}
                  </Chips>
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
                meter={lev.milestone ? <Meter value={lev.equity} max={lev.milestone} tone="green" height={6} labels={[<>next milestone <b className="font-mono text-white/70">{money0(lev.milestone)}</b></>, <>last check {lev.hourly[0] ? when(lev.hourly[0].ts) : "pending"}</>]} /> : <p className="text-[12.5px] text-white/50">milestones reached · last check {lev.hourly[0] ? when(lev.hourly[0].ts) : "pending"}</p>}
              />
              <Chips className="mt-4">
                {["BTC", "ETH"].map((a) => {
                  const h = lev.latest[a];
                  return <Chip key={a} tone={biasTone(h?.bias)} label={a} value={h ? `${num(h.price)} · ${biasGlyph(h.bias)} ${h.bias ?? "—"}` : "—"} />;
                })}
              </Chips>
              <div className="mt-2.5 text-[13px] leading-snug text-white/75">
                {lev.openTrades.length ? (
                  <span><span className="text-white/45">In a trade: </span>{lev.openTrades.map((t) => `${t.symbol} ${t.direction} @ ${num(t.entry)}`).join(" · ")}</span>
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
                />
                <div className="text-[12.5px] text-white/50 md:text-right">
                  <span className="rounded-md bg-accent-green/15 px-1.5 py-0.5 font-mono text-accent-green">{cb.universe.filter((u) => u.regime === "bull").length} bull</span>
                  <span className="ml-1.5 rounded-md bg-rose-400/15 px-1.5 py-0.5 font-mono text-rose-300">{cb.universe.filter((u) => u.regime === "bear").length} bear</span>
                  <span className="ml-1.5">of {cb.universe.length} coins · {cb.open.length} held</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                {cb.universe.map((u) => {
                  const held = cb.open.find((t) => t.symbol === u.symbol);
                  return held ? (
                    <Chip key={u.symbol} tone="cyan" label={`${u.symbol} held`} value={`@ ${num(held.entry)} · stop ${num(held.current_stop ?? held.stop)}`} />
                  ) : (
                    <Chip key={u.symbol} tone={u.regime === "bull" ? "green" : u.regime === "bear" ? "red" : "gray"} label={u.symbol} value={`${u.regime ?? "—"} · buy > ${num(u.trigger_px)}`} />
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-white/40">"buy &gt;" is the 55-day high that triggers an entry; bear coins stay in cash.</p>
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
        {btc ? <ThesisCard t={btc} title="BTC thesis" /> : <Card title="BTC thesis"><Empty>No active BTC thesis.</Empty></Card>}
        {eth ? <ThesisCard t={eth} title="ETH thesis" /> : <Card title="ETH thesis"><Empty>No active ETH thesis.</Empty></Card>}
      </div>

      <Card title="Equity & other theses" right={<Badge tone="gray">{others.length} active</Badge>}>
        {others.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{others.map((t) => <ThesisCard key={t.thesis_id} t={t} />)}</div>
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

      <Card title="Latest Moonbag Daily report" right={data?.report ? <Mono>{data.report.report_date}</Mono> : undefined}>
        {data?.report ? (
          <DocText summary={<span className="font-medium text-white/85">{data.report.title ?? "Read the full report"}</span>} text={data.report.markdown} />
        ) : (
          <Empty>No daily report saved yet.</Empty>
        )}
      </Card>
    </div>
  );
}
