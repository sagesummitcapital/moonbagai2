import { getMentorLibrary, MENTORS, type Mentor } from "@/lib/moonbag/mentors";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Fold, Note, PageHeader, Quiet, px2, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

// The mentor library (Stavros, 2026-10-16: "i really like eliz on macro and woods on micro ... pretend this is their last
// cycle and lets get as much knowledge about how they think so we can keep it going when they are gone"). Display only.
const CAT_ORDER = ["macro", "structure", "levels", "entry", "confirmation", "invalidation", "management", "risk", "timing", "psychology"];
const callTone = (s: string) => (s === "right" ? "green" : s === "wrong" ? "red" : s === "void" ? "gray" : "amber");

export default async function MentorsPage() {
  const { data, error } = await load(getMentorLibrary);
  if (!data) return <DataNotice error={error} />;
  const { posts, principles, calls, record, levels, questions, profiles, tests, mbCalls, vs } = data;
  const SECTION: Record<string, string> = { looks_at: "What they look at", changes_view: "What changes their view", judges: "How they judge a trade" };
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Mentors"
        kicker="Eliz = macro · Woods = micro"
        sub="Every update they post is kept word for word, then distilled into how they think (principles), where they look (levels) and what they expect (calls, graded against price every night). If they stop posting, Moonbag keeps trading their way from this library."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {(["eliz", "woods"] as Mentor[]).map((m) => {
          const rec = record.find((r) => r.mentor === m);
          const lv = levels.filter((l) => l.source === m);
          const pr = principles.filter((p) => p.mentor === m).sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
          const days = rec?.last_post ? Math.round((Date.now() - Date.parse(rec.last_post)) / 86400_000) : null;
          return (
            <Card
              key={m}
              title={`${MENTORS[m].name} · ${MENTORS[m].role}`}
              tone={m === "eliz" ? "info" : "accent"}
              right={
                <>
                  <Badge tone={days == null ? "gray" : days <= 7 ? "green" : days <= 14 ? "amber" : "red"} dot>{days == null ? "no posts yet" : `last post ${days}d ago`}</Badge>
                  <Badge tone="gray">{rec?.graded ? `${rec.right_n}/${rec.graded} calls right` : `${rec?.open_n ?? 0} calls open`}</Badge>
                </>
              }
              sub={MENTORS[m].layer}
            >
              {lv.length > 0 && (
                <div className="mb-3 grid gap-1.5">
                  {lv.map((l) => (
                    <div key={l.level_id} className="rounded-lg bg-black/20 px-3 py-2 text-[13px]">
                      <span className="font-mono font-semibold tabular-nums text-white">{l.low != null && l.high != null && l.low !== l.high ? `${px2(l.low)}–${px2(l.high)}` : px2(l.low ?? l.high)}</span>
                      <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-white/45">{l.coin} · {l.kind.replace(/_/g, " ")} · {l.timeframe ?? "—"}</span>
                      {l.note && <div className="mt-0.5 text-[12.5px] leading-snug text-white/65">{l.note}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {pr.map((p) => (
                  <div key={p.principle_id} className="text-[13.5px] leading-snug">
                    <span className="mr-1.5 text-[10.5px] uppercase tracking-[0.12em] text-white/40">{p.category}</span>
                    <span className="text-white/90">{p.statement}</span>
                    {p.quote && <div className="mt-0.5 border-l-2 border-white/10 pl-2 text-[12.5px] italic text-white/50">“{p.quote}”</div>}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="How they think" sub="Moonbag's model of each mentor, rebuilt as their posts come in (CR-10). Every week the model predicts their call from what they saw, and the match rate shows whether it really thinks like them.">
        <div className="grid gap-4 md:grid-cols-2">
          {(["eliz", "woods"] as Mentor[]).map((m) => {
            const t = tests.filter((x) => x.mentor === m && x.match);
            const hit = t.length ? Math.round((100 * t.filter((x) => x.match === "match").length + 50 * t.filter((x) => x.match === "partial").length) / t.length) : null;
            return (
              <div key={m} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-white">{MENTORS[m].name}</span>
                  <span className="text-[12px] text-white/50">{hit != null ? `model matches their call ${hit}% (${t.length} tests)` : "no weekly tests yet"}</span>
                </div>
                {(["looks_at", "changes_view", "judges"] as const).map((sec) => {
                  const p = profiles.find((x) => x.mentor === m && x.section === sec);
                  return (
                    <div key={sec} className="mb-2">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-white/45">{SECTION[sec]}{p ? ` · v${p.version} · ${whenShort(p.updated_at)}` : ""}</div>
                      {p ? <p className="whitespace-pre-wrap text-[13px] leading-snug text-white/80">{p.profile}</p> : <p className="text-[13px] text-white/45">Not built yet.</p>}
                      {p?.what_changed && <p className="text-[11.5px] text-white/40">{p.what_changed}</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Moonbag vs the mentors" sub="Moonbag logs its own call each morning BEFORE reading theirs (CR-11). Only calls Moonbag made first count. Both are graded the same way: direction, level hit before the invalidation, and R. No claim of beating them before 30+ fair pairs each.">
        {vs.length ? (
          <div className="space-y-1 text-[13px] text-white/80">
            {vs.map((r) => (
              <p key={`${r.week}-${r.mentor}`}><span className="text-white/45">week of {r.week}</span> · {MENTORS[r.mentor]?.name ?? r.mentor}: {r.fair_pairs} fair pairs{r.unfair_pairs_excluded ? ` (${r.unfair_pairs_excluded} excluded — Moonbag called after them)` : ""} · Moonbag {r.moonbag_hit_pct ?? "—"}% direction · {r.moonbag_level_hit_pct ?? "—"}% levels{r.moonbag_avg_r != null ? ` · ${r.moonbag_avg_r}R` : ""} vs {MENTORS[r.mentor]?.name ?? r.mentor} {r.mentor_hit_pct ?? "—"}%</p>
            ))}
          </div>
        ) : <p className="text-[13px] text-white/55">No pairs yet — Moonbag starts logging its calls each morning from 10/25.</p>}
        {mbCalls.length > 0 && (
          <div className="mt-3 space-y-1 text-[12.5px] text-white/65">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/45">Moonbag&apos;s latest calls</div>
            {mbCalls.slice(0, 6).map((c) => (
              <p key={c.id}>{c.window_start} {c.call_window} · {c.asset} <strong className="text-white/85">{c.bias}</strong>{c.trigger ? ` · ${c.trigger}` : ""}{c.target != null ? ` · target ${px2(c.target)}` : ""} · wrong below/above {px2(c.invalidation)} · <Badge tone={c.status === "graded" ? (c.direction_hit ? "green" : "red") : "amber"}>{c.status === "graded" ? (c.direction_hit ? "right" : "wrong") : "open"}</Badge></p>
            ))}
          </div>
        )}
      </Card>

      <Card title="How Moonbag combines them">
        <ol className="list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-white/80">
          <li><strong className="text-white">Eliz sets the battlefield (weekly):</strong> the range, the buy zone, the level that changes the structure, the macro resistance. Mid-range = don&apos;t chase.</li>
          <li><strong className="text-white">Woods picks the moment (4H/1H):</strong> BTC anchor, then sweep → close back → 4H divergence → 1H trigger at an edge. That is Eliz&apos;s &quot;wait for a reaction, a recovery or a valid trigger&quot;.</li>
          <li><strong className="text-white">They agree → full score.</strong> A Woods long inside Eliz&apos;s buy zone scores highest; a long chasing her range top scores lowest. The Woods machine shows her line on every scan.</li>
          <li><strong className="text-white">Risk stays yours:</strong> 1–2% by grade, the 4% daily stop, ≤ 15% open risk. Neither mentor&apos;s view changes those.</li>
        </ol>
      </Card>

      <Card title="Ask them while you can" tone="warn" sub="The gaps in each playbook — the things we can't rebuild from their posts alone. Ask one or two; send Grok their answer and it becomes a principle.">
        <div className="grid gap-3 md:grid-cols-2">
          {(["eliz", "woods"] as Mentor[]).map((m) => (
            <div key={m}>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-white/45">{MENTORS[m].name}</div>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-snug text-white/85">
                {questions.filter((q) => q.mentor === m).map((q) => (
                  <li key={q.q_id}>{q.question}{q.why ? <span className="block text-[12px] text-white/45">{q.why}</span> : null}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Their calls, graded against price" sub="Each concrete statement is turned into a test and graded every night on daily/4H candles. Right, wrong or void (never tested) — so we know whose read to weight, and when.">
        <div className="space-y-1.5">
          {calls.map((c) => (
            <div key={c.call_id} className="flex flex-wrap items-start gap-2 text-[13px]">
              <Badge tone={callTone(c.status)}>{c.status}</Badge>
              <span className="text-white/45">{MENTORS[c.mentor].name} · {whenShort(c.made_at)}</span>
              <span className="min-w-0 flex-1 text-white/85">{c.call}{c.grade_note ? <span className="block text-[12px] text-white/50">{c.grade_note}</span> : null}</span>
            </div>
          ))}
        </div>
      </Card>

      <Quiet title="Their words, verbatim" sub="every post we have, newest first">
        <div className="space-y-2">
          {posts.map((p) => (
            <Fold key={p.post_id} title={`${MENTORS[p.mentor].name} · ${p.title ?? p.kind}`} right={<span className="font-mono text-[11.5px] text-white/45">{whenShort(p.posted_at ?? p.received_at)}</span>}>
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/75">{p.raw_text}</pre>
              {p.source && <Note className="mt-2">Source: {p.source}</Note>}
            </Fold>
          ))}
        </div>
      </Quiet>
    </div>
  );
}
