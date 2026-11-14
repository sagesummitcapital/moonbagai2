import Link from "next/link";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, PageHeader, Stamps, Updated, whenShort } from "../_components/ui";
import { clean, getSystemPage } from "@/lib/moonbag/site";

export const dynamic = "force-dynamic";

/**
 * SYSTEM (CR-78, Stavros 2026-11-13): how the tool runs and how it gets better.
 * Flow: he analyses → tells Grok → Grok writes the journal → Claude works off the journal (features, change requests) → he reviews → push.
 * Improvement loop: a weekly coach scores every agent, fixes instructions within his rules, and lists what it changed here.
 */
const ARCHIVE: { href: string; label: string }[] = [
  { href: "/dashboard/agents", label: "Agent map (detail)" },
  { href: "/dashboard/lab", label: "Strategy lab" },
  { href: "/dashboard/command", label: "Old home" },
  { href: "/dashboard/leverage", label: "Old leverage desk" },
  { href: "/dashboard/positions", label: "Positions" },
  { href: "/dashboard/opportunities", label: "Opportunities" },
  { href: "/dashboard/audit", label: "Monthly audit" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/intelligence", label: "Intelligence" },
  { href: "/dashboard/gauge", label: "Retail gauge" },
  { href: "/dashboard/entropy", label: "Macro map" },
  { href: "/dashboard/mentors", label: "Research notes" },
];

const STEPS = [
  { t: "You", d: "Analyse charts and markets" },
  { t: "Grok", d: "Takes your view, levels and trades" },
  { t: "Journal", d: "One shared record" },
  { t: "Claude", d: "Builds features and change requests" },
  { t: "You", d: "Review, then push" },
];

const short = (s: string) => clean(s).replace(/^(PROPOSED|APPROVED — TO BUILD|BUILT[^:]*):\s*/i, "");

export default async function SystemPage() {
  const { data, error } = await load(getSystemPage);
  const agents = data?.agents ?? [];
  const proposed = data?.proposed ?? [];
  const shipped = data?.shipped ?? [];
  const errors = agents.filter((a) => a.errors_7d > 0).length;
  return (
    <div className="space-y-6">
      <PageHeader title="System" sub="How Moonbag runs, what is waiting on you, and how it is getting better." />
      <Stamps><Updated at={data?.as_of} label="system" verb="as of" cadenceH={1} /></Stamps>
      <DataNotice error={error} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <div className="font-mono text-[10.5px] text-white/30">{i + 1}</div>
            <div className="text-[13.5px] font-semibold text-white">{s.t}</div>
            <div className="text-[12px] leading-snug text-white/50">{s.d}</div>
          </div>
        ))}
      </div>

      <Card title="Waiting on you" tone={proposed.length ? "warn" : undefined} sub="Change requests that need your yes before they are built. Tell Claude in Cowork.">
        {proposed.length === 0 ? <Empty>Nothing is waiting on you.</Empty> : (
          <div className="space-y-2">
            {proposed.map((c) => (
              <div key={c.change_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] leading-snug text-white/80">
                <span className="mr-2 font-mono text-white/35">{whenShort(c.created_at)}</span>{short(c.change)}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Improvement loop" sub="Every Sunday a coach scores each agent on its record (was it right, was it used, did it waste your attention), fixes its instructions within your rules, and lists the change here. It never touches a risk number.">
        {(data?.coach ?? []).length === 0 ? <Empty>The coach has not run yet. Its first report lands Sunday.</Empty> : (
          <div className="space-y-2">
            {data!.coach!.map((r, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] leading-snug text-white/80">
                <span className="mr-2 font-mono text-white/35">{whenShort(r.started_at)}</span>{clean(r.summary)}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Agents" right={<span>{agents.length} agents · {errors} with errors this week</span>}>
        {agents.length === 0 ? <Empty>No agents on file.</Empty> : (
          <div className="space-y-1.5">
            {agents.map((a) => {
              const mode = a.last_run?.mode;
              const rv = a.review;
              return (
                <details key={a.agent_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${mode === "error" || a.errors_7d > 0 ? "bg-rose-400" : a.last_run ? "bg-accent-green" : "bg-white/25"}`} aria-hidden />
                      <span className="truncate text-[13.5px] font-medium text-white">{clean(a.name)}</span>
                      <span className="hidden truncate text-[12px] text-white/40 sm:inline">{clean(a.cadence)}</span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[11.5px] text-white/50">
                      {rv?.score != null && <Badge tone={rv.score >= 70 ? "green" : rv.score >= 40 ? "amber" : "red"}>{rv.score}/100 · {rv.verdict}</Badge>}
                      <span>{a.runs_7d} runs / 7d</span>
                      <span>{a.last_run ? whenShort(a.last_run.at) : "never ran"}</span>
                    </span>
                  </summary>
                  <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-2 text-[12.5px] leading-snug text-white/70">
                    <p><span className="text-white/40">Job: </span>{clean(a.role)}</p>
                    {a.last_run?.summary && <p><span className="text-white/40">Last run: </span>{clean(a.last_run.summary)}</p>}
                    {rv?.evidence && <p><span className="text-white/40">Coach: </span>{clean(rv.evidence)}{rv.change_made ? ` Changed: ${clean(rv.change_made)}` : ""}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
        {(data?.other_runs ?? []).length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12.5px] text-white/55 hover:text-white">Scheduled jobs ({data!.other_runs!.length})</summary>
            <div className="mt-2 space-y-1">
              {data!.other_runs!.map((o) => (
                <div key={o.agent_id} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.05] py-1.5 text-[12.5px]">
                  <span className="text-white/80">{clean(o.agent_id.replace(/_/g, " "))} <span className="text-white/40">— {clean(o.summary)}</span></span>
                  <span className={`font-mono text-[11.5px] ${o.errors_7d > 0 ? "text-rose-300" : "text-white/45"}`}>{o.runs_7d} runs{o.errors_7d > 0 ? ` · ${o.errors_7d} errors` : ""} · {whenShort(o.last_at)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recently shipped">
          {shipped.length === 0 ? <Empty>Nothing shipped yet.</Empty> : (
            <div className="space-y-1.5">
              {shipped.map((c) => (
                <div key={c.change_id} className="border-t border-white/[0.05] pt-1.5 text-[12.5px] leading-snug text-white/75 first:border-t-0 first:pt-0">
                  <span className="mr-2 font-mono text-white/35">{whenShort(c.created_at)}</span>{short(c.change).slice(0, 200)}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Journal · latest" right={<Link href="/dashboard/journal" className="text-white/70 hover:text-white">Open journal →</Link>}>
          {(data?.journal ?? []).length === 0 ? <Empty>Journal is empty.</Empty> : (
            <div className="space-y-1.5">
              {data!.journal!.map((j) => (
                <div key={j.id} className="border-t border-white/[0.05] pt-1.5 text-[12.5px] leading-snug text-white/75 first:border-t-0 first:pt-0">
                  <span className="mr-2 font-mono text-white/35">#{j.id} {j.author}</span>{clean(j.body).slice(0, 200)}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Archive" sub="Older pages, kept while the new layout settles. Tell Claude which ones you still use and the rest get retired.">
        <div className="flex flex-wrap gap-2">
          {ARCHIVE.map((a) => (
            <Link key={a.href} href={a.href} className="inline-flex min-h-[40px] items-center rounded-full border border-white/10 px-3 text-[12.5px] text-white/70 hover:border-white/25 hover:text-white">{a.label}</Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
