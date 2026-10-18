import { getDeskJournal, type JournalRow } from "@/lib/moonbag/deskJournal";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, PageHeader, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

// Desk journal (Stavros, 2026-10-18): one shared journal — his trade ideas (through Grok), Grok's take, Moonbag's instant view and
// WHERE WE'RE OFF, his decision, the outcome, and a weekly scorecard of whose version was better. Display only.
const who: Record<string, { label: string; tone: string }> = {
  stavros: { label: "You", tone: "cyan" }, grok: { label: "Grok", tone: "amber" }, moonbag: { label: "Moonbag", tone: "green" }, claude: { label: "Claude", tone: "gray" },
};
const verName: Record<string, string> = { stavros: "Your version", grok: "Grok", moonbag_live: "Moonbag now", moonbag_limit: "Moonbag limit" };
const fmt = (v: number | null) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: Number(v) >= 1 ? 2 : 5 }));

function Entry({ r }: { r: JournalRow }) {
  const w = who[r.author] ?? who.claude;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-white/45">
        <Badge tone={w.tone}>{w.label}</Badge><span>{r.kind.replace("_", " ")}</span><span>· {whenShort(r.created_at)}</span>
        {r.price_at != null && <span>· price then {fmt(r.price_at)}</span>}
      </div>
      {r.entry != null && r.kind !== "moonbag_view" && (
        <p className="font-mono text-[13px] tabular-nums text-white/80">Entry {fmt(r.entry)}{r.at_market ? " (market)" : ""} · SL {fmt(r.stop)} · TP1 {fmt(r.tp1)}{r.tp2 ? ` · TP2 ${fmt(r.tp2)}` : ""}</p>
      )}
      {r.body && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{r.body}</p>}
    </div>
  );
}

export default async function JournalPage() {
  const { data, error } = await load(() => getDeskJournal(30));
  if (!data) return <DataNotice error={error} />;
  const { threads, tally } = data;
  const board = Object.entries(tally).sort((a, b) => b[1].r - a[1].r);
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Desk journal"
        kicker="You · Grok · Moonbag — one journal"
        sub="Send Grok a trade idea and it lands here with Moonbag's instant view and where we differ. After 72 hours every version is scored in R."
        right={<Badge tone="gray">{threads.length} threads · 30 days</Badge>}
      />

      <Card title="Scorecard" sub="Ideas at least 72h old, each version played out on 15m bars (TP1 = win at its R, stop = −1R, still open = marked at 72h; unfilled limits excluded).">
        {board.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {board.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="text-[12px] text-white/50">{verName[k] ?? k}</div>
                <div className={`font-mono text-[20px] tabular-nums ${v.r > 0 ? "text-accent-green" : v.r < 0 ? "text-rose-300" : "text-white/60"}`}>{v.r >= 0 ? "+" : ""}{v.r.toFixed(1)}R</div>
                <div className="text-[12px] text-white/45">{v.n} trades · {v.wins} wins</div>
              </div>
            ))}
          </div>
        ) : <p className="text-[13.5px] text-white/55">No scored ideas yet. The first ones are scored 72h after you send them.</p>}
      </Card>

      {threads.length === 0 && <Card title="No entries yet"><p className="text-[13.5px] text-white/60">Send Grok a trade idea, e.g. &quot;BTC long 80,150 sl 79,800, thoughts?&quot;, and it opens the first thread.</p></Card>}

      {threads.map(({ root, replies }) => {
        const dec = replies.filter((x) => x.kind === "decision").pop();
        return (
          <details key={root.id} className="group rounded-xl border border-white/[0.08] bg-white/[0.015] px-3 py-2.5" open={root === threads[0]?.root}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span className="inline-block text-white/40 transition group-open:rotate-90">›</span>
              <span className="text-[14.5px] font-semibold text-white">#{root.id} {root.coin ? `${root.coin} ${root.side ?? ""}` : root.kind}</span>
              {root.side && <Badge tone={root.side === "long" ? "green" : "red"}>{root.side}</Badge>}
              {dec && <Badge tone="cyan">{dec.body?.split(/[.—\n]/)[0]?.slice(0, 40)}</Badge>}
              <span className="text-[12px] text-white/45">{whenShort(root.created_at)}</span>
              {root.score && Object.entries(root.score).map(([k, v]) => (
                <span key={k} className="text-[12px] text-white/55">{verName[k] ?? k}: {v.result}{v.r != null ? ` ${Number(v.r) > 0 ? "+" : ""}${v.r}R` : ""}</span>
              ))}
            </summary>
            <div className="mt-2 space-y-2">
              <Entry r={root} />
              {replies.map((r) => <Entry key={r.id} r={r} />)}
            </div>
          </details>
        );
      })}
    </div>
  );
}
