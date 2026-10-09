import { getAgentsBoard } from "@/lib/moonbag/agents";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Mono, Table, num, when } from "../_components/ui";

export const dynamic = "force-dynamic";

const HEALTH = {
  live: { dot: "bg-accent-green", label: "active", tone: "green" },
  late: { dot: "bg-amber-300", label: "late", tone: "amber" },
  idle: { dot: "bg-white/30", label: "idle", tone: "gray" },
} as const;

const BOOK_TONE: Record<string, string> = { leverage: "cyan", robinhood: "green", both: "gray" };
const MODE_TONE: Record<string, string> = { work: "green", quiet: "gray", error: "red" };

const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

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

  return (
    <div className="space-y-6">
      <DataNotice error={error} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-white">Agents</h1>
          <p className="mt-1 text-[13.5px] text-white/55">
            Heads route the work, agents each own a few tasks, and every run is logged. Quiet runs found nothing to do and stopped early, which saves tokens.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">{work} work runs · 24h</Badge>
          <Badge tone="gray">{quiet} quiet runs · 24h</Badge>
          {data.strategy && <Badge tone="cyan">Strategy file v{data.strategy.version}</Badge>}
        </div>
      </div>

      {/* Org chart: head → agents → tasks */}
      <div className="grid gap-4 xl:grid-cols-3">
        {heads.map((h) => (
          <section key={h.agent_id} className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.03] p-4">
            <AgentHeader a={h} head />
            <TaskList a={h} />
            <div className="mt-4 space-y-3 border-l border-white/[0.08] pl-3">
              {kids(h.agent_id).map((k) => (
                <div key={k.agent_id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                  <AgentHeader a={k} />
                  <TaskList a={k} />
                  <LastSeen a={k} />
                </div>
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

      <Card title="How the work flows">
        <div className="space-y-3">
          {data.pipelines.map((p) => (
            <div key={p.when} className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 md:grid-cols-[150px_1fr]">
              <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-amber-200/90">{p.when}</div>
              <div>
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
                <div className="mt-1.5 text-[12px] text-white/45">{p.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Coins the Scout watches" right={<Mono>BTC/ETH always · top 5 rotation · max 2 in play</Mono>}>
        <Table
          head={["Coin", "Tier", "Rank", "1M vs BTC", "3M vs BTC", "In play", "Max lev", "BloFin", "Updated"]}
          rows={data.universe.map((u) => [
            <strong key="a" className="text-white">{u.asset}</strong>,
            <Badge key="t" tone={u.tier === "core" ? "cyan" : u.tier === "rotation" ? "green" : "gray"}>{u.tier}</Badge>,
            u.rank ?? "—",
            <span key="r1" className={`font-mono ${Number(u.rs_1m_vs_btc) > 0 ? "text-accent-green" : Number(u.rs_1m_vs_btc) < 0 ? "text-rose-300" : "text-white/60"}`}>{u.rs_1m_vs_btc == null ? "—" : `${Number(u.rs_1m_vs_btc) > 0 ? "+" : ""}${num(u.rs_1m_vs_btc, 1)}%`}</span>,
            <span key="r3" className="font-mono text-white/70">{u.rs_3m_vs_btc == null ? "—" : `${Number(u.rs_3m_vs_btc) > 0 ? "+" : ""}${num(u.rs_3m_vs_btc, 1)}%`}</span>,
            u.tier === "core" ? <Badge key="p" tone="cyan">always</Badge> : u.in_play ? <Badge key="p" tone="green">in play</Badge> : <span key="p" className="text-white/40">—</span>,
            <span key="l" className="font-mono">{num(u.max_leverage, 0)}x</span>,
            <Mono key="b">{u.blofin_symbol}</Mono>,
            when(u.updated_at),
          ])}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Run log" right={<Mono>work vs quiet</Mono>}>
          {data.runs.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {data.runs.map((r, i) => (
                <li key={`${r.agent_id}-${r.started_at}-${i}`} className="grid grid-cols-[96px_110px_1fr] items-start gap-2 py-2 text-[12.5px]">
                  <span className="text-white/45">{when(r.started_at)}</span>
                  <span className="flex items-center gap-1.5">
                    <Badge tone={MODE_TONE[r.mode]}>{r.mode}</Badge>
                    <span className="text-white/80">{nameOf(r.agent_id)}</span>
                  </span>
                  <span className="text-white/65">
                    {r.coins?.length ? <span className="text-white/45">{r.coins.join(", ")} · </span> : null}
                    {r.summary ?? ""}
                    {r.handed_to?.length ? <span className="text-white/45"> → {r.handed_to.map(nameOf).join(", ")}</span> : null}
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
            <ul className="divide-y divide-white/[0.05]">
              {data.recent.map((e, i) => (
                <li key={`${e.agent_id}-${e.at}-${i}`} className="grid grid-cols-[96px_110px_1fr] gap-2 py-2 text-[12.5px]">
                  <span className="text-white/45">{when(e.at)}</span>
                  <span className="font-semibold text-white/85">{nameOf(e.agent_id)}{e.subject ? <span className="font-normal text-white/45"> · {e.subject}</span> : null}</span>
                  <span className="truncate text-white/65">{e.detail}</span>
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
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${h.dot}`} />
          <h3 className={`${head ? "text-[16px]" : "text-[14px]"} font-semibold text-white`}>{a.name}</h3>
          {head && <Badge tone="amber">head</Badge>}
        </div>
        <div className="flex gap-1">
          <Badge tone={BOOK_TONE[a.book]}>{a.book}</Badge>
          {(a.runs_24h.work > 0 || a.runs_24h.quiet > 0) && (
            <Badge tone="gray">{a.runs_24h.work}w · {a.runs_24h.quiet}q</Badge>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-white/65">{a.role}</p>
      <p className="mt-1 text-[11.5px] text-white/40">{a.cadence}{a.scheduled_task ? ` · scheduled task "${a.scheduled_task}"` : ` · runs in ${a.runs_in}`}</p>
    </div>
  );
}

function TaskList({ a }: { a: A }) {
  if (!a.tasks?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {a.tasks.map((t, i) => (
        <li key={i} className="flex gap-2 text-[12.5px]">
          <span className="text-white/30">•</span>
          <span className="text-white/80">{t.task}</span>
          <span className="ml-auto whitespace-nowrap text-white/35">{t.when}</span>
        </li>
      ))}
    </ul>
  );
}

function LastSeen({ a }: { a: A }) {
  return (
    <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5 text-[12px]">
      <span className="text-white/45">Last: {ago(a.last_at)} · </span>
      <span className="text-white/70">{a.last_detail || "No activity recorded yet."}</span>
    </div>
  );
}
