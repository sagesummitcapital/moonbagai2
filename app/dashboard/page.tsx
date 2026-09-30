import { getActiveTheses, getSystemState, getYesterdayReview, latestReport } from "@/lib/moonbag/db";
import { load } from "./_components/data";
import { DataNotice } from "./_components/Notice";
import { ThesisCard } from "./_components/ThesisCard";
import { Badge, Card, Empty, Mono, Stat, num } from "./_components/ui";

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
