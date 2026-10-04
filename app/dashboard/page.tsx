import { getActiveTheses, getSystemState, getYesterdayReview, latestReport } from "@/lib/moonbag/db";
import { buildBriefing } from "@/lib/moonbag/briefing";
import { getLeverageDesk, getRobinhoodBook } from "@/lib/moonbag/desk";
import Link from "next/link";
import { load } from "./_components/data";
import { DataNotice } from "./_components/Notice";
import { ThesisCard } from "./_components/ThesisCard";
import { Badge, Card, Empty, Mono, Stat, biasTone, money, num, when } from "./_components/ui";

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
  const [{ data: lev }, { data: rh }, { data: briefing }] = await Promise.all([load(getLeverageDesk), load(getRobinhoodBook), load(buildBriefing)]);
  const liveSignals = (lev?.signals ?? []).filter((s) => ["armed", "triggered"].includes(s.status) && !s.outcome && Number(s.confidence_grade) >= 4);

  const state = data?.state;
  const theses = data?.theses ?? [];
  const master = theses.find((t) => t.asset === "MASTER");
  const btc = theses.find((t) => t.asset === "BTC");
  const eth = theses.find((t) => t.asset === "ETH");
  const others = theses.filter((t) => !["MASTER", "BTC", "ETH"].includes(t.asset));

  return (
    <div className="space-y-6">
      <DataNotice error={error} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <Stat
            label="Moonbag System Confidence"
            value={<>{num(state?.system_confidence ?? 0, 0)}<span className="text-[16px] text-white/40"> / 100</span></>}
            sub={`Rolling ${state?.rolling_window_days ?? 30} days · ${state?.forecasts_graded ?? 0} forecasts graded — measured forecasting quality, not a win probability.`}
          />
        </Card>
        <Card><Stat label="Market regime" value={<span className="text-[20px]">{state?.current_regime ?? master?.market_regime ?? "—"}</span>} /></Card>
        <Card><Stat label="Risk environment" value={<span className="text-[20px]">{state?.risk_environment ?? master?.risk_environment ?? "—"}</span>} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Book 1 · Long-term (Robinhood)" right={<Link href="/dashboard/robinhood" className="text-[12.5px] text-accent-cyan hover:underline">Open →</Link>}>
          {rh ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-[24px] font-semibold text-white">{rh.snapshot ? money(rh.snapshot.equity) : "—"}</span>
                <span className="text-[13px] text-white/55">loss box {money(rh.box.used)} of {money(rh.box.limit)} · fills {rh.fillsThisWeek}/{num(rh.risk?.max_fills_per_week, 0)} this week</span>
              </div>
              <p className="mt-2 text-[13.5px] text-white/75">
                {rh.open.length
                  ? rh.open.map((t) => `${t.symbol} @ ${num(t.entry)} (stop ${num(t.current_stop ?? t.stop)})`).join(" · ")
                  : "In cash — no A-grade setup has met the standard."}
              </p>
              <p className="mt-1.5 text-[13px] text-white/50">
                {rh.equityThesis ? <>Equities: <Badge tone={biasTone(rh.equityThesis.bias)}>{rh.equityThesis.bias}</Badge> </> : null}
                {rh.themes.filter((t) => t.status === "active").length} active themes · {rh.paper.filter((p) => p.status === "open").length} paper trades open
              </p>
            </>
          ) : (
            <Empty>Long-term book not loaded.</Empty>
          )}
        </Card>
        <Card title="Book 2 · Leverage desk (BloFin)" right={<Link href="/dashboard/leverage" className="text-[12.5px] text-accent-cyan hover:underline">Open →</Link>}>
          {lev ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-[24px] font-semibold text-white">{money(lev.equity)}</span>
                <span className="text-[13px] text-white/55">
                  {lev.milestone ? `next milestone ${money(lev.milestone)}` : "milestones reached"} · strategy v{lev.strategy?.version ?? "—"} · last check {lev.hourly[0] ? when(lev.hourly[0].ts) : "pending"}
                </span>
              </div>
              <p className="mt-2 text-[13.5px] text-white/75">
                {["BTC", "ETH"].map((a) => {
                  const h = lev.latest[a];
                  return h ? `${a} ${num(h.price)} (${h.bias ?? "—"})` : `${a} —`;
                }).join(" · ")}
              </p>
              <p className="mt-1.5 text-[13px] text-white/50">
                {lev.openTrades.length
                  ? `In a trade: ${lev.openTrades.map((t) => `${t.symbol} ${t.direction} @ ${num(t.entry)}`).join(" · ")}`
                  : liveSignals.length
                    ? liveSignals.map((s) => `${s.asset} ${s.direction} ${s.status} — grade ${s.confidence_grade} (${num(s.confidence_score, 0)}/100)`).join(" · ")
                    : "No grade 4–5 setup right now — waiting for levels."}
              </p>
            </>
          ) : (
            <Empty>Leverage desk not loaded.</Empty>
          )}
        </Card>
      </div>

      <Card title="Today's briefing" right={<Mono>same answer Grokbot gives</Mono>}>
        {briefing ? (
          <pre className="overflow-auto whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-white/80">{briefing.text}</pre>
        ) : (
          <Empty>Briefing not available.</Empty>
        )}
      </Card>

      {master ? <ThesisCard t={master} title="Master thesis" /> : <Card title="Master thesis"><Empty>No master thesis published today.</Empty></Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        {btc ? <ThesisCard t={btc} title="BTC thesis" /> : <Card title="BTC thesis"><Empty>No active BTC thesis.</Empty></Card>}
        {eth ? <ThesisCard t={eth} title="ETH thesis" /> : <Card title="ETH thesis"><Empty>No active ETH thesis.</Empty></Card>}
      </div>

      <Card title="Equity & other theses">
        {others.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{others.map((t) => <ThesisCard key={t.thesis_id} t={t} />)}</div>
        ) : (
          <Empty>No active equity theses.</Empty>
        )}
      </Card>

      <Card title={`Yesterday's review (${data?.yesterday.date ?? "—"})`}>
        {data?.yesterday.theses.length ? (
          <ul className="space-y-2 text-[14px]">
            {data.yesterday.theses.map((t) => {
              const ev = data.yesterday.evaluations.find((e) => e.thesis_id === t.thesis_id);
              return (
                <li key={t.thesis_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
                  <span><strong className="text-white">{t.asset}</strong> <span className="text-white/50">— {t.bias}</span> <Mono>{t.thesis_id}</Mono></span>
                  {ev ? (
                    <span className="flex items-center gap-2"><Badge tone="cyan">{num(ev.total_score, 0)}/100</Badge><span className="text-white/60">{ev.lesson}</span></span>
                  ) : (
                    <Badge tone="amber">needs grading</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No theses were recorded yesterday.</Empty>
        )}
      </Card>

      <Card title="Latest Moonbag Daily report">
        {data?.report ? (
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-white/75">{data.report.markdown}</pre>
        ) : (
          <Empty>No daily report saved yet.</Empty>
        )}
      </Card>
    </div>
  );
}
