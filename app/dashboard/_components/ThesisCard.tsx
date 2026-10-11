import type { DailyThesis } from "@/lib/moonbag/types";
import type { LivePrice as LP, PriceKind } from "@/lib/moonbag/prices";
import { LevelLadder, ScoreBar } from "./charts";
import { LivePrice } from "./LivePrice";
import { Badge, Card, KV, LongText, Id, Updated, biasGlyph, biasTone, list, num, statusTone } from "./ui";

const DECISION_LABEL: Record<string, string> = { trade: "TRADE", no_trade: "NO TRADE", watch: "WATCH" };

export function ThesisCard({ t, title, live, kind = "crypto" }: {
  t: DailyThesis; title?: string;
  /** Live price for the thesis asset (omit for MASTER / EQUITY). Marks the ladder and checks the invalidation. */
  live?: LP | null; kind?: PriceKind;
}) {
  const plan = t.trade_plan ?? {};
  const lv = t.levels ?? { support: [], resistance: [], breakout: null, invalidation: null };
  const anchor = (lv as unknown as { anchor?: string }).anchor;
  const sup = (lv.support ?? []).map(Number).filter(Number.isFinite);
  const res = (lv.resistance ?? []).map(Number).filter(Number.isFinite);
  const regimeShort = !!t.market_regime && t.market_regime.length <= 24;
  const gradeTone = t.setup_grade === "A+" || t.setup_grade === "A" ? "green" : t.setup_grade === "B" ? "cyan" : "gray";
  const livePx = live?.ok && live.price != null ? live.price : null;
  const inv = lv.invalidation != null ? Number(lv.invalidation) : null;
  const dir = String(plan.direction ?? (t.bias === "bearish" ? "short" : t.bias === "bullish" ? "long" : "")).toLowerCase();
  // A short is dead once price is above its invalidation; a long once it is below. Only judged on a LIVE price.
  const broken = livePx != null && inv != null && ((dir === "short" && livePx > inv) || (dir === "long" && livePx < inv));
  return (
    <Card
      title={title ?? t.asset}
      tone={broken ? "warn" : undefined}
      right={
        <>
          <Badge tone={biasTone(t.bias)}>{biasGlyph(t.bias)} {t.bias}</Badge>
          <Badge tone={statusTone(t.decision)}>{DECISION_LABEL[t.decision] ?? t.decision}</Badge>
          {broken && <Badge tone="red">price past invalidation</Badge>}
        </>
      }
      sub={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Updated label={`thesis ${t.thesis_date}`} at={t.created_at} cadenceH={26} verb="written" />
          {live && <LivePrice symbol={t.asset} kind={kind} initial={live} size="inline" showChange />}
        </span>
      }
    >
      {/* the three numbers */}
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Setup">
          <span className="font-mono text-[17px] font-semibold tabular-nums text-white">{t.setup_score == null ? "—" : num(t.setup_score, 1)}<span className="text-[12px] font-normal text-white/40">/10</span></span>
          {t.setup_grade && <Badge tone={gradeTone} className="ml-1.5 align-middle">{t.setup_grade}</Badge>}
        </Mini>
        <Mini label="Thesis conf.">
          <ScoreBar value={t.thesis_confidence} tone="cyan" />
        </Mini>
        <Mini label="Regime">
          {regimeShort ? <span className="font-mono text-[15px] text-white">{t.market_regime}</span> : <span className="text-[12.5px] text-white/60">{t.market_regime ? "see below ↓" : "—"}</span>}
        </Mini>
      </div>
      {!regimeShort && t.market_regime && <LongText text={t.market_regime} label="Regime:" max={120} className="mt-2 text-[12.5px] leading-snug text-white/65" />}

      {/* levels as a picture, then the exact numbers */}
      {(sup.length || res.length) && (sup.length + res.length) >= 2 ? (
        <LevelLadder
          className="mt-3"
          price={livePx}
          below={sup.slice().sort((a, b) => b - a).slice(0, 3)}
          above={res.slice().sort((a, b) => a - b).slice(0, 3)}
          live={live ? { symbol: t.asset, kind, initial: live } : undefined}
        />
      ) : null}

      <KV
        className="mt-3"
        cols={2}
        rows={[
          ["Support", list(lv.support)],
          ["Resistance", list(lv.resistance)],
          ["Breakout", num(lv.breakout)],
          ["Invalidation", broken ? <span key="inv" className="text-rose-300">{num(lv.invalidation)} ✕ broken</span> : num(lv.invalidation)],
          ...(plan.direction
            ? ([
                ["Plan", <span key="p"><Badge tone={biasTone(plan.direction)}>{plan.direction}</Badge> entry {list(plan.entry_zone)}</span>],
                ["Stop / TPs", `${num(plan.stop)} / ${[plan.tp1, plan.tp2, plan.tp3].map((x) => num(x)).join(" · ")}`],
              ] as [string, React.ReactNode][])
            : []),
        ]}
      />
      {anchor && <div className="mt-2 text-[12px] text-white/45">Levels shown are {anchor} key levels.</div>}

      {/* the reasoning, first sentence each */}
      <div className="mt-3 space-y-2">
        <LongText text={t.primary_scenario} label="Primary:" max={170} />
        <LongText text={t.alternative_scenario} label="Alternative:" max={150} />
        <LongText text={t.what_changes_our_mind} label="What changes our mind:" max={150} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Id>{t.thesis_id}</Id>
        {t.supersedes && <Id>· supersedes {t.supersedes}</Id>}
      </div>
    </Card>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-3 py-2">
      <div className="text-[11.5px] uppercase tracking-[0.12em] text-white/40">{label}</div>
      <div className="mt-1 min-w-0 leading-tight">{children}</div>
    </div>
  );
}
