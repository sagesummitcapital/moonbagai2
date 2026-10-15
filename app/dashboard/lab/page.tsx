import { getLab } from "@/lib/moonbag/lab";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Fold, PageHeader, Quiet, Table, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

const verdictTone = (v: string) => (/^adopted/i.test(v) ? "green" : /proposed|watch|re-test|too few/i.test(v) ? "amber" : /already/i.test(v) ? "cyan" : "red");
const statusTone = (s: string) => (s === "adopted" ? "green" : s === "proposed" ? "amber" : s === "rejected" ? "red" : "gray");
const r = (v?: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}R`);

export default async function LabPage() {
  const { data, error } = await load(getLab);
  if (!data) return <DataNotice error={error} />;
  const { ideas, changes, league } = data;
  const proposed = changes.filter((c) => c.status === "proposed");
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Strategy lab"
        kicker="Ideas → backtest → layer in or reject"
        sub="Every idea you send is tested against what we run live. Nothing changes live without evidence; the change log below records every change and why."
        right={<><Badge tone="gray">{ideas.length} ideas</Badge><Badge tone={proposed.length ? "amber" : "gray"} dot>{proposed.length} waiting for your OK</Badge></>}
      />

      {proposed.length > 0 && (
        <Card tone="warn" title="Waiting for your OK" sub="Ideas that can't be backtested but look sensible. Nothing happens until you say yes.">
          <ul className="space-y-1.5 text-[13.5px] text-white/85">
            {proposed.map((c) => <li key={c.change_id}>• {c.change.replace(/^PROPOSED:\s*/, "")} <span className="text-white/45">— {c.reason}{c.evidence ? ` · ${c.evidence}` : ""}</span></li>)}
          </ul>
        </Card>
      )}

      {ideas.some((i) => i.status === "received") && (
        <Card tone="info" title="In the queue" sub="Ideas you gave Grok (or me) that haven't been tested yet.">
          <ul className="space-y-1 text-[13.5px] text-white/85">
            {ideas.filter((i) => i.status === "received").map((i) => <li key={i.idea_id}>• <strong>{i.title}</strong> <span className="text-white/45">— {i.source ?? "—"} · {whenShort(i.received_at)} · {i.idea_id}</span></li>)}
          </ul>
        </Card>
      )}

      <Card title="Ideas tested" sub="Newest first. Each part of an idea gets its own verdict.">
        <div className="space-y-3">
          {ideas.filter((i) => i.status !== "received").map((i) => (
            <details key={i.idea_id} className="group rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2" open={i === ideas[0]}>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="mr-1.5 inline-block text-white/40 transition group-open:rotate-90">›</span>
                <span className="text-[14px] font-semibold text-white">{i.title}</span>{" "}
                <Badge tone={i.status === "partly_adopted" || i.status === "adopted" ? "green" : i.status === "rejected" ? "red" : "gray"}>{i.status.replace("_", " ")}</Badge>
                <span className="ml-2 text-[12px] text-white/45">{whenShort(i.received_at)} · {i.source}</span>
              </summary>
              {i.verdict && <p className="mt-2 text-[13.5px] text-white/85"><strong>Verdict:</strong> {i.verdict}</p>}
              <Table
                head={["Part of the idea", "Trades", "Avg R", "Verdict"]}
                align={["l", "r", "r", "l"]}
                minWidth={640}
                rows={i.elements.map((e, k) => [
                  <span key={`e${k}`} className="text-white/85">{e.element}{e.note ? <span className="block text-[12px] text-white/45">{e.note}</span> : null}{e.result ? <span className="block text-[12px] text-white/45">{e.result}</span> : null}</span>,
                  <span key={`n${k}`} className="font-mono tabular-nums text-white/70">{e.n ?? "—"}</span>,
                  <span key={`r${k}`} className={`font-mono tabular-nums ${Number(e.avg_r) > 0 ? "text-accent-green" : Number(e.avg_r) < 0 ? "text-rose-300" : "text-white/50"}`}>{r(e.avg_r)}</span>,
                  <Badge key={`v${k}`} tone={verdictTone(e.verdict)}>{e.verdict}</Badge>,
                ])}
                empty="—"
              />
              {i.next_test && <p className="mt-1 text-[12.5px] text-amber-200">Still testing: {i.next_test}</p>}
            </details>
          ))}
        </div>
      </Card>

      <Quiet title="Records" sub="tap any row to open it">
      <Fold count={changes.length} title="Strategy change log" sub="Every change to how we trade — live, paper or process — with the reason and the evidence.">
        <Table
          head={["Date", "Change", "Why", "Evidence", "Where", "Status"]}
          align={["l", "l", "l", "l", "l", "l"]}
          minWidth={900}
          rows={changes.map((c) => [
            <span key="d" className="whitespace-nowrap text-white/60">{whenShort(c.created_at)}</span>,
            <span key="c" className="text-white/90">{c.change.replace(/^PROPOSED:\s*/, "")}</span>,
            <span key="w" className="text-white/65">{c.reason ?? "—"}</span>,
            <span key="e" className="text-white/55">{c.evidence ?? "—"}</span>,
            <Badge key="a" tone="gray">{c.applied_to}{c.strategy_doc_version ? ` · v${c.strategy_doc_version}` : ""}</Badge>,
            <Badge key="s" tone={statusTone(c.status)}>{c.status}</Badge>,
          ])}
          empty="No changes logged yet."
        />
      </Fold>

      {league.length > 0 && (
        <Fold count={league.length} title="Strategy league" sub="What is actually working, week by week. The Saturday review picks one winner from this.">
          <Table
            head={["Week", "Strategy", "Trades", "Avg R", "Total R", "Win %"]}
            align={["l", "l", "r", "r", "r", "r"]}
            minWidth={560}
            rows={league.map((l, k) => [
              <span key={`w${k}`} className="text-white/60">{l.week}</span>,
              <span key={`s${k}`} className="text-white/85">{l.strategy}</span>,
              <span key={`n${k}`} className="font-mono">{l.n}</span>,
              <span key={`a${k}`} className={`font-mono ${Number(l.avg_r) > 0 ? "text-accent-green" : "text-rose-300"}`}>{r(l.avg_r)}</span>,
              <span key={`t${k}`} className="font-mono">{r(l.total_r)}</span>,
              <span key={`p${k}`} className="font-mono">{l.win_pct ?? "—"}%</span>,
            ])}
            empty="—"
          />
        </Fold>
      )}
      </Quiet>
    </div>
  );
}
