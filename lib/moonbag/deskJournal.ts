// DESK JOURNAL (Stavros, 2026-10-18: "I need you and grok to lock in and work together to improve our execution and communication ...
// like my daily journal, but instead all three of us contribute and work off it. I like to send potential trades to get inputs back, but
// then I also want to bounce off what moonbag is looking at and see where we are off, i may like moonbag limits or trade better").
// He writes through Grok. Every trade idea opens a thread; Moonbag answers instantly, side by side, with WHERE WE'RE OFF; the weekly
// review scores each version (his, Grok's, Moonbag live, Moonbag limit) in R. Analysis only — Stavros places every order.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { quickInputs, quickLive } from "./quick";
import { getLiquidity, liquidityNotes } from "./liquidity";

export type JournalRow = {
  id: number; created_at: string; thread_id: number | null; author: string; recorded_by: string | null; kind: string;
  coin: string | null; side: "long" | "short" | null; entry: number | null; stop: number | null; tp1: number | null; tp2: number | null;
  rr1: number | null; at_market: boolean | null; price_at: number | null; body: string | null; refs: Record<string, unknown> | null;
  trade_id: string | null; scored_at: string | null; score: Record<string, { result: string; r?: number }> | null;
};

type Plan = { entry: number; stop: number; tp1: number; tp2: number | null; rr1: number; label: string; grade: string | null };

const fp = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: v >= 1 ? 2 : 4, maximumFractionDigits: v >= 1 ? 2 : 4 });
const pct = (a: number, b: number) => `${(((a - b) / b) * 100).toFixed(2)}%`;
const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const phx = (t: number | string) => new Date(t).toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" });

/** Moonbag's resting setup for this coin/side: a working limit first, else the Woods machine plan. */
async function moonbagLimit(coin: string, side: "long" | "short"): Promise<Plan | null> {
  const db = supabaseAdmin();
  const lo = await db.from("limit_orders").select("limit_id, limit_price, stop, tp1, tp2, plan_r, grade, setup_id")
    .eq("symbol", coin).eq("direction", side).in("status", ["working", "touched"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const l = lo.data as { limit_id: string; limit_price: number; stop: number; tp1: number; tp2: number | null; plan_r: number | null; grade: string | null; setup_id: string | null } | null;
  if (l && l.limit_price && l.stop && l.tp1) {
    const e = Number(l.limit_price), s = Number(l.stop), t = Number(l.tp1);
    return { entry: e, stop: s, tp1: t, tp2: num(l.tp2), rr1: Math.abs(t - e) / Math.abs(e - s), grade: l.grade, label: `working limit ${l.limit_id}${l.setup_id ? ` (${l.setup_id})` : ""}` };
  }
  const wm = await db.from("woods_machine").select("grade, confidence, limit_plan, blocked").eq("coin", coin).eq("side", side).maybeSingle();
  const w = wm.data as { grade: string | null; confidence: number | null; blocked: string | null; limit_plan: { entry: number; stop: number; tp1: number; tp2: number; rr1: number } | null } | null;
  if (w?.limit_plan) {
    const p = w.limit_plan;
    return { entry: Number(p.entry), stop: Number(p.stop), tp1: Number(p.tp1), tp2: num(p.tp2), rr1: Number(p.rr1), grade: w.grade,
      label: `Woods machine plan (confidence ${w.confidence ?? "—"}${w.blocked ? ` · blocked: ${w.blocked}` : ""})` };
  }
  return null;
}

/** What does Moonbag lean on this coin right now? (grades of both sides on the Woods machine) */
async function lean(coin: string) {
  const r = await supabaseAdmin().from("woods_machine").select("side, grade, confidence, trigger, blocked").eq("coin", coin);
  const rows = (r.data ?? []) as { side: string; grade: string | null; confidence: number | null; trigger: boolean; blocked: string | null }[];
  return rows;
}

/**
 * Moonbag's instant answer to a trade idea: the live card, Moonbag's targets on HIS numbers (if he gave entry + stop), Moonbag's resting
 * limit, Moonbag's lean, and WHERE WE'RE OFF — line by line, so he can pick his version, Moonbag's limit, or skip.
 */
export async function moonbagView(coin: string, side: "long" | "short", his: { entry?: number | null; stop?: number | null; tp1?: number | null; risk?: number | null }) {
  const c = coin.toUpperCase().replace(/USDT.*$/, "");
  const [live, limit, lw, liq] = await Promise.all([
    quickLive(c, side, "cross", null, his.risk ?? null).catch(() => null),
    moonbagLimit(c, side).catch(() => null),
    lean(c).catch(() => []),
    getLiquidity(c).catch(() => null),
  ]);
  const hasHis = his.entry != null && his.stop != null;
  const mine = hasHis ? await quickInputs({ coin: c, side, entry: his.entry!, stop: his.stop!, risk: his.risk ?? null }).catch(() => null) : null;

  const L: string[] = [];
  const liveOk = live && live.ok && "entry" in live;
  const px = liveOk ? (live as { entry: number }).entry : null;
  const liveAt = liveOk ? (live as { live: { at: number; source: string } }).live : null;
  L.push(`MOONBAG VIEW — ${c} ${side.toUpperCase()}${px != null ? ` · live ${fp(px)} (${liveAt?.source}, ${phx(liveAt!.at)} Phoenix)` : " · NO live price"}`);

  // Lean
  const me = lw.find((x) => x.side === side), other = lw.find((x) => x.side !== side);
  if (me || other) {
    const g = (x?: { grade: string | null; confidence: number | null; trigger: boolean; blocked: string | null }) => (x ? `${x.grade ?? "—"} (${x.confidence ?? "—"})${x.trigger ? " TRIGGERED" : ""}${x.blocked ? " · blocked" : ""}` : "—");
    const rank = (x?: { grade: string | null }) => ({ "A+": 4, A: 3, B: 2, C: 1 } as Record<string, number>)[x?.grade ?? ""] ?? 0;
    L.push(`Lean: ${side} ${g(me)} · ${other?.side ?? (side === "long" ? "short" : "long")} ${g(other)}${rank(other) > rank(me) ? ` — Moonbag leans the OTHER way (${other!.side}).` : rank(me) > rank(other) ? " — Moonbag agrees with the direction." : " — no edge either way."}`);
  }

  // The versions
  const versions: { who: string; p: Plan | null }[] = [];
  if (hasHis) {
    const tp1 = his.tp1 ?? (mine && mine.ok ? mine.tp1 : null);
    versions.push({ who: "YOURS", p: tp1 != null ? { entry: his.entry!, stop: his.stop!, tp1, tp2: mine && mine.ok ? mine.tp2 : null, rr1: Math.abs(tp1 - his.entry!) / Math.abs(his.entry! - his.stop!), label: his.tp1 != null ? "your numbers" : "your entry/stop, Moonbag's TP1", grade: null } : null });
  }
  if (liveOk) {
    const lv = live as { entry: number; stop: number; tp1: number; tp2: number; rr1: number };
    versions.push({ who: "MOONBAG NOW (market)", p: { entry: lv.entry, stop: lv.stop, tp1: lv.tp1, tp2: lv.tp2, rr1: lv.rr1, label: "live card", grade: null } });
  }
  versions.push({ who: "MOONBAG LIMIT", p: limit });
  for (const v of versions) {
    if (!v.p) { L.push(`${v.who}: none on the board for ${c} ${side}.`); continue; }
    const p = v.p;
    L.push(`${v.who}: entry ${fp(p.entry)} · SL ${fp(p.stop)} (${(Math.abs(p.entry - p.stop) / p.entry * 100).toFixed(2)}%) · TP1 ${fp(p.tp1)} (${p.rr1.toFixed(1)}R)${p.tp2 ? ` · TP2 ${fp(p.tp2)}` : ""}${p.grade ? ` · grade ${p.grade}` : ""} — ${p.label}`);
  }

  // WHERE WE'RE OFF
  const off: string[] = [];
  const y = versions.find((v) => v.who === "YOURS")?.p;
  const lv = versions.find((v) => v.who.startsWith("MOONBAG NOW"))?.p;
  if (y && px != null) {
    const away = (side === "long" ? 1 : -1) * (y.entry - px);
    if (Math.abs(y.entry - px) / px > 0.0015) off.push(`Entry: yours is ${pct(y.entry, px)} from live — ${away > 0 ? "you'd be chasing above the market (a stop-entry, not a limit)" : "that's a resting limit, not a market entry"}.`);
  }
  if (y && lv) {
    const ys = Math.abs(y.entry - y.stop) / y.entry, ms = Math.abs(lv.entry - lv.stop) / lv.entry;
    if (ys < ms * 0.8) off.push(`Stop: yours is ${(ys * 100).toFixed(2)}% vs Moonbag's ${(ms * 100).toFixed(2)}% (past structure + ½ ATR) — tighter than the structure; a wick can take it.`);
    else if (ys > ms * 1.5) off.push(`Stop: yours is ${(ys * 100).toFixed(2)}% vs Moonbag's ${(ms * 100).toFixed(2)}% — wider than needed; same $ risk means smaller size.`);
  }
  if (y && mine && mine.ok && his.tp1 != null && Math.abs(his.tp1 - mine.tp1!) / mine.tp1! > 0.002) off.push(`TP1: yours ${fp(his.tp1)} vs Moonbag ${fp(mine.tp1!)} on your entry/stop (secure 2R / first level).`);
  if (limit && y) {
    const d = Math.abs(limit.entry - y.entry) / y.entry;
    if (d > 0.002) off.push(`Moonbag's limit waits ${pct(limit.entry, y.entry)} from your entry for ${limit.rr1.toFixed(1)}R vs your ${y.rr1.toFixed(1)}R.`);
    else off.push(`Your entry is right on Moonbag's limit — we agree on the level.`);
  }
  const rated = versions.filter((v) => v.p).sort((a, b) => b.p!.rr1 - a.p!.rr1);
  if (rated.length > 1) off.push(`Best R:R: ${rated[0].who.toLowerCase()} at ${rated[0].p!.rr1.toFixed(1)}R${rated[0].p!.rr1 < 2 ? " — still under the 2:1 aim" : ""}.`);
  if (liq) {
    L.push(liq.text);
    if (y) for (const t of liquidityNotes(liq, side, y.entry, y.stop, y.tp1)) off.push(`Yours — ${t}`);
    if (limit) for (const t of liquidityNotes(liq, side, limit.entry, limit.stop, limit.tp1)) off.push(`Moonbag limit — ${t}`);
  }
  L.push(off.length ? `WHERE WE'RE OFF:\n- ${off.join("\n- ")}` : "WHERE WE'RE OFF: nothing material — we see it the same way.");
  L.push("Your call: reply \"mine\", \"moonbag limit\", \"moonbag now\" or \"skip\" and Grok logs it.");

  const plan = (p: Plan | null | undefined) => (p ? { entry: p.entry, stop: p.stop, tp1: p.tp1, tp2: p.tp2, rr1: Number(p.rr1.toFixed(2)), label: p.label, grade: p.grade } : null);
  return {
    text: L.join("\n"),
    price: px,
    refs: { liq: liq ? { as_of: liq.asOf, above: liq.above, below: liq.below } : null, live: plan(lv), limit: plan(limit), mine: mine && mine.ok ? { tp1: mine.tp1, tp2: mine.tp2, rr1: mine.rr1 } : null, lean: lw, live_source: liveAt?.source ?? null },
    liveCard: liveOk ? (live as { text: string }).text : null,
  };
}

export async function getDeskJournal(days = 14) {
  const r = await supabaseAdmin().from("desk_journal").select("*").gte("created_at", new Date(Date.now() - days * 86400_000).toISOString())
    .order("created_at", { ascending: false }).limit(300);
  if (r.error) throw new Error(r.error.message);
  const rows = (r.data ?? []) as JournalRow[];
  const roots = rows.filter((x) => x.thread_id == null);
  const threads = roots.map((root) => ({ root, replies: rows.filter((x) => x.thread_id === root.id).sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  // Scorecard (ideas already scored)
  const tally: Record<string, { n: number; r: number; wins: number }> = {};
  for (const t of roots) for (const [k, v] of Object.entries(t.score ?? {})) {
    if (v.r == null || v.result === "no_fill" || v.result === "no_data" || v.result === "incomplete") continue;
    const s = (tally[k] ??= { n: 0, r: 0, wins: 0 });
    s.n++; s.r += Number(v.r); if (Number(v.r) > 0) s.wins++;
  }
  return { threads, tally };
}
