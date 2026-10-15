import { BOOK, FALSIFIERS, FIAT_YEAR, GAUGES, LAYERS, SIGNS, STATES, getEntropy, type EntropyReading } from "@/lib/moonbag/entropy";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Fold, PageHeader, Quiet, Section, Table, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

const zoneTone = (z?: string | null) => (z === "red" ? "red" : z === "orange" ? "amber" : z === "green" ? "green" : "gray");
const arrow = (v?: number | null) => (v == null ? "—" : v > 0.5 ? "▲" : v < -0.5 ? "▼" : "◆");
const sgn = (v?: number | null, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Number(v)).toFixed(d)}`);
const label: Record<string, string> = {
  equilibrium: "Equilibrium", disequilibrium: "Disequilibrium", phase_transition: "Phase transition",
  inflationary: "Inflationary", inflationary_flip_risk: "Inflationary — flip risk", deflationary: "Deflationary (trapdoor)",
  trap: "Trap", real: "May be real", no_rally: "No rally to judge",
  waiting: "Waiting", trapdoor: "Trapdoor", deployment: "Deployment",
};
const seiName = (s?: number | null) => {
  if (s == null) return "—";
  const st = Math.floor(s); const part = s - st;
  const names = ["", "Monetary", "Fiscal", "Regulatory", "Political", "Coercion"];
  return `${part >= 0.6 ? "Late " : part <= 0.25 ? "Early " : ""}Stage ${st} · ${names[st] ?? ""}`;
};

function ours(r: EntropyReading | null, key: string): { value: string; tone: string; sub?: string } {
  if (!r) return { value: "first reading pending", tone: "gray" };
  switch (key) {
    case "ssi": return { value: `${r.ssi == null ? "—" : Number(r.ssi).toFixed(0)} / 100 · ${r.ssi_zone ?? "—"}`, tone: zoneTone(r.ssi_zone), sub: `velocity ${sgn(r.ssi_v)} · accel ${sgn(r.ssi_a)} · jerk ${sgn(r.ssi_j)}` };
    case "pti": return { value: label[r.pti_state ?? ""] ?? "—", tone: r.pti_state === "phase_transition" ? "red" : r.pti_state === "disequilibrium" ? "amber" : "green", sub: `bowl ${r.bowl ?? "—"} · stress rising ${r.pti_weeks_up ?? 0} weeks in a row (our record)` };
    case "sri": return { value: label[r.sri ?? ""] ?? "—", tone: r.sri === "deflationary" ? "red" : r.sri === "inflationary_flip_risk" ? "amber" : "cyan", sub: r.notes?.sri };
    case "sei": return { value: seiName(r.sei_stage), tone: (r.sei_stage ?? 0) >= 4 ? "red" : (r.sei_stage ?? 0) >= 3 ? "amber" : "cyan", sub: r.notes?.sei };
    case "sam": return { value: r.sam_active ?? "—", tone: "cyan", sub: Object.entries(r.sam ?? {}).map(([k, v]) => `${k} ${sgn(v.accel)}`).join(" · ") };
    case "rqi": return { value: label[r.rqi ?? ""] ?? "—", tone: r.rqi === "trap" ? "red" : r.rqi === "real" ? "green" : "gray", sub: r.notes?.rqi };
    default: return { value: "—", tone: "gray" };
  }
}

export default async function EntropyPage() {
  const { data, error } = await load(getEntropy);
  const latest = data?.latest ?? null;
  const history = data?.history ?? [];
  const state = latest?.state ?? null;
  const yr = FIAT_YEAR();
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Entropy Trap"
        kicker="Macro map · updated every Sunday"
        sub={`${BOOK.title} — ${BOOK.author}. The author keeps his formulas private, so every reading here is Moonbag's own approximation from public market data, shown next to the book's.`}
        right={
          <>
            <Badge tone={state === "trapdoor" ? "red" : state === "deployment" ? "green" : "amber"} dot>State: {state ? label[state] : "pending"}</Badge>
            <Badge tone="gray">Fiat clock: year {yr} since 1971 ≈ {1873 + yr} in the Long Depression</Badge>
          </>
        }
      />

      {/* ---------------------------------------------------- verdict */}
      <Card tone={latest?.ssi_zone === "red" ? "warn" : "info"} title={latest ? `This week · ${latest.week}` : "First reading"} sub={latest ? `Updated ${whenShort(latest.updated_at)}` : "The Entropy task writes the first reading on its first run."}>
        {latest?.verdict && <p className="text-[14px] leading-relaxed text-white/90">{latest.verdict}</p>}
        {latest?.changed && <p className="mt-1 text-[12.5px] text-white/55">Since last week: {latest.changed}</p>}
        {latest?.moonbag && (
          <div className="mt-3 rounded-xl border border-accent-cyan/30 bg-accent-cyan/[0.05] p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-accent-cyan">What it means for Moonbag</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-white/85">{latest.moonbag}</p>
          </div>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {STATES.map((s) => (
            <div key={s.key} className={`rounded-xl border p-3 ${state === s.key ? "border-amber-300/50 bg-amber-300/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-white">{s.name} {state === s.key && <Badge tone="amber" dot>now</Badge>}</div>
              <div className="mt-1 text-[12px] text-white/55">{s.when}</div>
              <div className="mt-1 text-[12.5px] text-white/80">{s.play}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------------- six gauges */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GAUGES.map((g) => {
          const o = ours(latest, g.key);
          return (
            <Card key={g.key}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-white/35">{g.n}</span>
                <span className="text-[14px] font-semibold text-white">{g.name}</span>
              </div>
              <div className="text-[12.5px] text-white/55">{g.q}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={o.tone}>Moonbag: {o.value}</Badge>
                {g.key === "ssi" && latest?.ssi_v != null && <span className="font-mono text-[13px] text-white/70">{arrow(latest.ssi_v)}</span>}
              </div>
              {o.sub && <div className="mt-1 text-[12px] text-white/60">{o.sub}</div>}
              <div className="mt-2 text-[12px] text-white/45"><span className="text-white/60">Book:</span> {g.book}</div>
              <div className="mt-1 text-[11.5px] leading-snug text-white/40">{g.how}</div>
            </Card>
          );
        })}
      </div>

      <Quiet title="Behind the reading" sub="tap any row to open it">
      {/* ---------------------------------------------------- SSI components */}
      {latest && Object.keys(latest.components ?? {}).length > 0 && (
        <Fold title="What's driving the stress index" sub="Each domain scored 0–100 from public data. The book weights are secret; ours are equal.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(latest.components).map(([k, c]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between text-[12.5px]"><span className="capitalize text-white/85">{k}</span><span className="font-mono text-white">{Number(c.score).toFixed(0)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${c.score >= 65 ? "bg-rose-400" : c.score >= 40 ? "bg-amber-300" : "bg-accent-green"}`} style={{ width: `${Math.max(2, Math.min(100, c.score))}%` }} /></div>
                {c.detail && <div className="mt-1 text-[11.5px] text-white/50">{c.detail}</div>}
              </div>
            ))}
          </div>
        </Fold>
      )}

      {/* ---------------------------------------------------- signs + falsifiers */}
      <div className="space-y-2">
        <Fold title="Signs to watch" sub="The book's four public-data signs. If all four shift together, the transition is completing.">
          <ul className="space-y-1.5 text-[13px]">
            {SIGNS.map((s, i) => {
              const m = latest?.signs?.find((x) => x.id === i + 1);
              return <li key={s} className="flex gap-2"><Badge tone={m?.met ? (i === 1 ? "red" : "green") : "gray"}>{m ? (m.met ? "yes" : "no") : "—"}</Badge><span className="text-white/80">{s}{m?.detail ? <span className="text-white/45"> — {m.detail}</span> : null}</span></li>;
            })}
          </ul>
        </Fold>
        <Fold title="What would prove the thesis wrong" sub="The author's own falsifiers. If these start turning yes, we reduce the defensive tilt.">
          <ul className="space-y-1.5 text-[13px]">
            {FALSIFIERS.map((s, i) => {
              const m = latest?.falsifiers?.find((x) => x.id === i + 1);
              return <li key={s} className="flex gap-2"><Badge tone={m?.met ? "green" : "gray"}>{m ? (m.met ? "yes" : "no") : "—"}</Badge><span className="text-white/80">{s}{m?.detail ? <span className="text-white/45"> — {m.detail}</span> : null}</span></li>;
            })}
          </ul>
        </Fold>
      </div>

      {/* ---------------------------------------------------- monitors */}
      {latest && Object.keys(latest.monitors ?? {}).length > 0 && (
        <Fold title="Core monitors" sub="The numbers behind the map, this week.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(latest.monitors).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                <div className="text-[11px] uppercase tracking-[0.1em] text-white/45">{k}</div>
                <div className="font-mono text-[14px] tabular-nums text-white">{v == null ? "—" : String(v)}</div>
              </div>
            ))}
          </div>
        </Fold>
      )}

      {/* ---------------------------------------------------- portfolio architecture */}
      <Fold title="The portfolio architecture" sub="Build from the centre out: the core never moves, the strategy adjusts, the reserve deploys. Right column: where it lives in Moonbag.">
        <div className="space-y-2">
          {LAYERS.map((l) => (
            <div key={l.name} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-[1.2fr_2fr_1.3fr]">
              <div className="text-[13px] font-semibold text-white">{l.name}</div>
              <div className="text-[12.5px] text-white/75">{l.items}</div>
              <div className="text-[12.5px] text-accent-cyan/90">{l.moonbag}</div>
            </div>
          ))}
        </div>
      </Fold>

      {/* ---------------------------------------------------- history */}
      {history.length > 1 && (
        <Fold count={history.length} title="Weekly history">
          <Table
            head={["Week", "SSI", "Zone", "Velocity", "PTI", "SRI", "SEI", "SAM", "RQI", "State"]}
            align={["l", "r", "l", "r", "l", "l", "l", "l", "l", "l"]}
            minWidth={820}
            rows={history.map((h) => [
              h.week, h.ssi == null ? "—" : Number(h.ssi).toFixed(0), <Badge key="z" tone={zoneTone(h.ssi_zone)}>{h.ssi_zone ?? "—"}</Badge>, sgn(h.ssi_v),
              label[h.pti_state ?? ""] ?? "—", label[h.sri ?? ""] ?? "—", h.sei_stage == null ? "—" : Number(h.sei_stage).toFixed(1), h.sam_active ?? "—", label[h.rqi ?? ""] ?? "—", label[h.state ?? ""] ?? "—",
            ])}
          />
        </Fold>
      )}

      {/* ---------------------------------------------------- the book */}
      <Fold title="The thesis in brief" sub="Paraphrased from your photos of Chapters 7, 9, 10 and 11, plus the author's interviews.">
        <Section title="Core ideas">
          <ul className="space-y-1.5 text-[13px] text-white/80">{BOOK.thesis.map((t) => <li key={t}>• {t}</li>)}</ul>
        </Section>
        <Section title="Useful additions from outside the book">
          <ul className="space-y-1.5 text-[13px] text-white/80">{BOOK.extra.map((t) => <li key={t}>• {t}</li>)}</ul>
        </Section>
        <p className="mt-2 text-[12px] text-white/45">Honest caveats: the author doesn't publish inputs, weights or thresholds; his 150-year backtest results (Chapter 8) aren't in the photos; and the book is inconsistent on whether the 2020 rally was real. Treat the gauges as a structured way to read the macro, not as a timing tool. Analysis only — not financial advice.</p>
      </Fold>
      </Quiet>
    </div>
  );
}
