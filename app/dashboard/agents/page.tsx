import { getAgentsBoard } from "@/lib/moonbag/agents";
import { load } from "../_components/data";
import { DivergingBars, Legend } from "../_components/charts";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, LongText, Id, Mono, Note, PageHeader, Stat, StatGrid, Table, Tile, ago, num, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const HEALTH = {
  live: { dot: "bg-accent-green", label: "active", tone: "green" },
  late: { dot: "bg-amber-300", label: "late", tone: "amber" },
  idle: { dot: "bg-white/30", label: "idle", tone: "gray" },
} as const;

const BOOK_TONE: Record<string, string> = { leverage: "cyan", robinhood: "green", coinbase: "amber", both: "gray" };
const MODE_TONE: Record<string, string> = { work: "green", quiet: "gray", error: "red" };

type Board = NonNullable<Awaited<ReturnType<typeof getAgentsBoard>>>;
type A = Board["agents"][number];

export default async function AgentsPage() {
  const { data, error } = await load(getAgentsBoard);
  if (!data) return <DataNotice error={error} />;

  const byId = new Map(data.agents.map((a) => [a.agent_id, a]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const heads = data.agents.filter((a) => !a.parent_id && a.agent_id !== "stavros");
  const kids = (id: string) => data.agents.filter((a) => a.parent_id === id);
  const you = byId.get("stavros");
  const work = data.agents.reduce((s, a) => s + a.runs_24h.work, 0);
  const quiet = data.agents.reduce((s, a) => s + a.runs_24h.quiet, 0);
  const errors = data.agents.reduce((s, a) => s + a.runs_24h.error, 0);
  const counts = { live: 0, late: 0, idle: 0 };
  for (const a of data.agents) counts[a.health]++;
  const rotation = data.universe.filter((u) => u.tier !== "core" && u.rs_1m_vs_btc != null);

  return (
    <div className="space-y-5">
      <DataNotice error={error} />

      <PageHeader
        title="Agents"
        sub="Heads route the work, agents each own a few tasks, and every run is logged. Quiet runs found nothing to do and stopped early, which saves tokens."
        right={data.strategy ? <Badge tone="cyan">Strategy file v{data.strategy.version}</Badge> : undefined}
      />

      <StatGrid cols={4}>
        <Card>
          <Stat label="Agents" value={data.agents.length} size="md" sub={<span className="inline-flex flex-wrap gap-x-2"><span className="text-accent-green">● {counts.live} active</span><span className="text-amber-200">● {counts.late} late</span><span className="text-white/45">● {counts.idle} idle</span></span>} />
        </Card>
        <Card><Stat label="Work runs · 24h" value={work} size="md" tone="green" sub="runs that did something" /></Card>
        <Card><Stat label="Quiet runs · 24h" value={quiet} size="md" sub="checked, nothing to do, stopped early" /></Card>
        <Card tone={errors ? "warn" : undefined}><Stat label="Errors · 24h" value={errors} size="md" tone={errors ? "red" : undefined} sub={errors ? "see the run log" : "none"} /></Card>
      </StatGrid>

      {/* Org chart: head → agents → tasks */}
      <div className={`grid gap-3 ${heads.length >= 3 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2"}`}>
        {heads.map((h) => (
          <section key={h.agent_id} className="min-w-0 rounded-2xl border border-amber-300/25 bg-amber-300/[0.03] p-4">
            <AgentHeader a={h} head />
            <TaskList a={h} />
            <div className="mt-4 space-y-2.5 border-l border-white/[0.08] pl-3">
              {kids(h.agent_id).map((k) => (
                <Tile key={k.agent_id} className="p-3">
                  <AgentHeader a={k} />
                  <TaskList a={k} />
                  <LastSeen a={k} />
                </Tile>
              ))}
              {!kids(h.agent_id).length && <p className="text-[12px] text-white/40">No agents report to this head.</p>}
            </div>
          </section>
        ))}
      </div>

      {you && (
        <section className="rounded-2xl border border-accent-cyan/25 bg-accent-cyan/[0.03] p-4">
          <AgentHeader a={you} />
          <TaskList a={you} />
          <LastSeen a={you} />
        </section>
      )}

      <Card title="How the work flows" right={<Legend items={[{ tone: "green", label: "active" }, { tone: "amber", label: "late" }, { tone: "gray", label: "idle" }]} />}>
        <div className="space-y-2">
          {data.pipelines.map((p) => (
            <div key={p.when} className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 md:grid-cols-[170px_minmax(0,1fr)]">
              <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-amber-200/90">{p.when}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.steps.map((id, i) => {
                    const h = HEALTH[byId.get(id)?.health ?? "idle"];
                    return (
                      <span key={`${p.when}-${id}`} className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[12.5px] text-white">
                          <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} />
                          {nameOf(id)}
                        </span>
                        {i < p.steps.length - 1 && <span className="text-white/30">→</span>}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-1.5 max-w-[80ch] text-[12.5px] leading-snug text-white/50">{p.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Coins the Scout watches" right={<Mono>BTC/ETH always · top 5 rotation · max 2 in play</Mono>}>
        {rotation.length > 0 && (
          <DivergingBars
            className="mb-4"
            labelWidth="minmax(90px, 26%)"
            format={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`}
            items={rotation.map((u) => ({ label: <>{u.asset}{u.in_play ? <span className="ml-1 text-accent-green">★</span> : null}</>, sub: u.rank != null ? `#${u.rank}` : u.tier, value: Number(u.rs_1m_vs_btc) }))}
          />
        )}
        {rotation.length > 0 && <Note className="mb-3 mt-0">1-month performance relative to BTC · ★ in play</Note>}
        <Table
          head={["Coin", "Tier", "Rank", "1M vs BTC", "3M vs BTC", "In play", "Max lev", "BloFin", "Updated"]}
          align={["l", "l", "r", "r", "r", "l", "r", "l", "l"]}
          dense
          rows={data.universe.map((u) => [
            <strong key="a" className="text-white">{u.asset}</strong>,
            <Badge key="t" tone={u.tier === "core" ? "cyan" : u.tier === "rotation" ? "green" : "gray"}>{u.tier}</Badge>,
            u.rank ?? "—",
            <span key="r1" className={Number(u.rs_1m_vs_btc) > 0 ? "text-accent-green" : Number(u.rs_1m_vs_btc) < 0 ? "text-rose-300" : "text-white/60"}>{u.rs_1m_vs_btc == null ? "—" : `${Number(u.rs_1m_vs_btc) > 0 ? "+" : ""}${num(u.rs_1m_vs_btc, 1)}%`}</span>,
            <span key="r3" className="text-white/70">{u.rs_3m_vs_btc == null ? "—" : `${Number(u.rs_3m_vs_btc) > 0 ? "+" : ""}${num(u.rs_3m_vs_btc, 1)}%`}</span>,
            u.tier === "core" ? <Badge key="p" tone="cyan">always</Badge> : u.in_play ? <Badge key="p" tone="green" dot>in play</Badge> : <span key="p" className="text-white/40">—</span>,
            `${num(u.max_leverage, 0)}x`,
            <Id key="b">{u.blofin_symbol}</Id>,
            <span key="u" className="whitespace-nowrap text-white/60">{when(u.updated_at)}</span>,
          ])}
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Run log" right={<Legend items={[{ tone: "green", label: "work" }, { tone: "gray", label: "quiet" }, { tone: "red", label: "error" }]} />}>
          {data.runs.length ? (
            <ul className="max-h-[640px] divide-y divide-white/[0.05] overflow-y-auto pr-1">
              {data.runs.map((r, i) => (
                <li key={`${r.agent_id}-${r.started_at}-${i}`} className="grid gap-x-3 gap-y-1 py-2 text-[12.5px] md:grid-cols-[92px_minmax(0,1fr)]">
                  <span className="whitespace-nowrap text-white/45">{when(r.started_at)}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={MODE_TONE[r.mode]} dot>{r.mode}</Badge>
                      <span className="font-medium text-white/85">{nameOf(r.agent_id)}</span>
                      {r.coins?.length ? <span className="text-white/45">{r.coins.join(", ")}</span> : null}
                      {r.handed_to?.length ? <span className="text-white/45">→ {r.handed_to.map(nameOf).join(", ")}</span> : null}
                    </span>
                    {r.summary && <LongText text={r.summary} max={120} className="mt-0.5 text-[12.5px] leading-snug text-white/65" />}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No runs logged yet. Each scheduled agent logs one line per run from now on.</Empty>
          )}
        </Card>

        <Card title="Latest activity" right={<Mono>last 7 days</Mono>}>
          {data.recent.length ? (
            <ul className="max-h-[640px] divide-y divide-white/[0.05] overflow-y-auto pr-1">
              {data.recent.map((e, i) => (
                <li key={`${e.agent_id}-${e.at}-${i}`} className="grid gap-x-3 gap-y-1 py-2 text-[12.5px] md:grid-cols-[92px_minmax(0,1fr)]">
                  <span className="whitespace-nowrap text-white/45">{when(e.at)}</span>
                  <span className="min-w-0">
                    <span className="font-medium text-white/85">{nameOf(e.agent_id)}{e.subject ? <span className="font-normal text-white/45"> · {e.subject}</span> : null}</span>
                    <LongText text={e.detail} max={120} className="mt-0.5 text-[12.5px] leading-snug text-white/65" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No activity in the last 7 days.</Empty>
          )}
        </Card>
      </div>

      {data.strategy && (
        <p className="text-[12px] text-white/40">
          Source of truth: MOONBAG_STRATEGY.md v{data.strategy.version} ({when(data.strategy.created_at)}). Also served to agents at /api/moonbag/strategy and /api/moonbag/agents.
        </p>
      )}
    </div>
  );
}

function AgentHeader({ a, head = false }: { a: A; head?: boolean }) {
  const h = HEALTH[a.health];
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${h.dot}`} title={h.label} />
          <h3 className={`${head ? "text-[16px]" : "text-[14px]"} font-semibold text-white`}>{a.name}</h3>
          {head && <Badge tone="amber">head</Badge>}
          <span className="sr-only">{h.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge tone={BOOK_TONE[a.book]}>{a.book}</Badge>
          {(a.runs_24h.work > 0 || a.runs_24h.quiet > 0 || a.runs_24h.error > 0) && (
            <Badge tone={a.runs_24h.error ? "red" : "gray"}>{a.runs_24h.work}w · {a.runs_24h.quiet}q{a.runs_24h.error ? ` · ${a.runs_24h.error} err` : ""}</Badge>
          )}
        </div>
      </div>
      <LongText text={a.role} max={120} className="mt-1.5 text-[12.5px] leading-snug text-white/65" />
      <p className="mt-1 text-[12px] text-white/40">{a.cadence}{a.scheduled_task ? ` · scheduled task "${a.scheduled_task}"` : ` · runs in ${a.runs_in}`}</p>
    </div>
  );
}

function TaskList({ a }: { a: A }) {
  if (!a.tasks?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {a.tasks.map((t, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-snug">
          <span className="text-white/30">•</span>
          <span className="min-w-0 flex-1 text-white/80">{t.task}</span>
          <span className="max-w-[42%] shrink-0 text-right text-white/35">{t.when}</span>
        </li>
      ))}
    </ul>
  );
}

function LastSeen({ a }: { a: A }) {
  const h = HEALTH[a.health];
  return (
    <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[12px]">
      <div className={`${a.health === "late" ? "text-amber-200" : "text-white/45"}`}>Last: {a.last_at ? ago(a.last_at) : "never"} · {h.label}</div>
      <LongText text={a.last_detail || "No activity recorded yet."} max={110} className="text-[12px] leading-snug text-white/70" />
    </div>
  );
}
