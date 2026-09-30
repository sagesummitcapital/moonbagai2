import type { DailyThesis } from "@/lib/moonbag/types";
import { Badge, Card, Mono, biasTone, list, num, statusTone } from "./ui";

const DECISION_LABEL: Record<string, string> = { trade: "TRADE", no_trade: "NO TRADE", watch: "WATCH" };

export function ThesisCard({ t, title }: { t: DailyThesis; title?: string }) {
  const plan = t.trade_plan ?? {};
  const lv = t.levels ?? { support: [], resistance: [], breakout: null, invalidation: null };
  return (
    <Card
      title={title ?? t.asset}
      right={
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={biasTone(t.bias)}>{t.bias}</Badge>
          <Badge tone={statusTone(t.decision)}>{DECISION_LABEL[t.decision] ?? t.decision}</Badge>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Mini label="Setup" value={t.setup_score == null ? "—" : `${num(t.setup_score, 1)}/10`} sub={t.setup_grade ?? undefined} />
        <Mini label="Thesis conf." value={t.thesis_confidence == null ? "—" : `${num(t.thesis_confidence, 0)}`} />
        <Mini label="Regime" value={t.market_regime ?? "—"} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        <Row k="Support" v={list(lv.support)} />
        <Row k="Resistance" v={list(lv.resistance)} />
        <Row k="Breakout" v={num(lv.breakout)} />
        <Row k="Invalidation" v={num(lv.invalidation)} />
        {plan.direction && <Row k="Plan" v={`${plan.direction} · entry ${list(plan.entry_zone)}`} />}
        {plan.direction && <Row k="Stop / TPs" v={`${num(plan.stop)} / ${[plan.tp1, plan.tp2, plan.tp3].map((x) => num(x)).join(" · ")}`} />}
      </dl>

      {t.primary_scenario && <P label="Primary">{t.primary_scenario}</P>}
      {t.alternative_scenario && <P label="Alternative">{t.alternative_scenario}</P>}
      {t.what_changes_our_mind && <P label="What changes our mind">{t.what_changes_our_mind}</P>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Mono>{t.thesis_id}</Mono>
        {t.supersedes && <Mono>· supersedes {t.supersedes}</Mono>}
      </div>
    </Card>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] text-white">
        {value} {sub && <span className="text-[11px] text-accent-green">{sub}</span>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.04] pb-1.5">
      <dt className="text-white/45">{k}</dt>
      <dd className="text-right font-mono text-white/80">{v}</dd>
    </div>
  );
}

function P({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
      <span className="text-white/45">{label}: </span>
      {children}
    </p>
  );
}
