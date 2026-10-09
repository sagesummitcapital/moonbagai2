// X (Twitter) posts for Grok to publish — filled from fixed templates, never free-written.
// Stavros, 2026-10-09: R and % only — no dollar amounts or account size.
// Kinds: morning_brief (once a day, after 6 AM Phoenix), trade_open and trade_close (every BloFin trade).

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildBriefing } from "./briefing";
import { tradeMetrics } from "./desk";
import type { Trade } from "./types";

const MAX = 280;
const DISCLAIMER = "Not financial advice.";

/** Price formatting by size: 83,330 · 2,509 · 167.09 · 1.059 · 0.2155 */
export function px(v: unknown) {
  const x = Number(v);
  if (v === null || v === undefined || !Number.isFinite(x)) return "—";
  const d = Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 100 ? 2 : Math.abs(x) >= 1 ? 3 : 4;
  return x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
const r1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : (Math.round(v * 10) / 10).toString());
const signed = (v: number | null | undefined, unit = "") => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${r1(Math.abs(v))}${unit}`);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(new Date());
const dayLabel = () => new Date().toLocaleDateString("en-US", { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric" });

/** Joins lines, dropping optional lines (from the end of the optional list) until it fits in 280 characters. */
function fit(required: string[], optional: string[], tail: string[]) {
  const opt = [...optional];
  let text = [...required, ...opt, ...tail].join("\n");
  while (text.length > MAX && opt.length) {
    opt.pop();
    text = [...required, ...opt, ...tail].join("\n");
  }
  return text.length > MAX ? text.slice(0, MAX - 1) + "…" : text;
}

// ---------------------------------------------------------------- templates
type BriefData = Awaited<ReturnType<typeof buildBriefing>>["brief"];

export function morningBriefPost(b: BriefData) {
  const bias = (b.market.bias ?? "—").toLowerCase();
  const coins = b.coins.map((c) => {
    const lo = c.rangeLow ?? c.below[0] ?? null;
    const hi = c.rangeHigh ?? c.above[0] ?? null;
    return `${c.asset} ${px(c.price)} · range ${px(lo)}–${px(hi)}`;
  });
  const rot = b.rotation.top.slice(0, 3).map((r) => r.asset);
  const plays = b.coins
    .filter((c) => c.playLine)
    .map((c) => `${c.asset}: ${c.playLine}`);
  return fit(
    [`Moonbag morning brief · ${dayLabel()}`, `Market: ${b.market.risk ?? "—"} · bias ${bias}`, ...coins],
    [rot.length ? `Rotation leaders vs BTC: ${rot.join(" · ")}` : "", ...plays].filter(Boolean),
    [DISCLAIMER]
  );
}

type SignalLite = { confidence_score: number | null; confidence_grade: number | null } | null;
const gradeName = (g?: number | null) => (g == null ? "" : g >= 5 ? "A+" : g >= 4 ? "A" : g >= 3 ? "B" : "C");

export function tradeOpenPost(t: Trade, sig: SignalLite) {
  const m = tradeMetrics(t);
  const stopR = Math.abs(Number(t.entry) - Number(t.stop));
  const tpR = (tp: unknown) => (tp == null || !stopR ? null : Math.abs(Number(tp) - Number(t.entry)) / stopR);
  const who = t.origin === "moonbag" && sig?.confidence_score != null
    ? `Moonbag ${gradeName(sig.confidence_grade)} (${Math.round(Number(sig.confidence_score))}/100)`
    : t.origin === "own" ? "own read" : "Moonbag desk";
  const tp1 = t.current_tp1 ?? t.tp1 ?? t.target;
  return fit(
    [
      `New trade: ${t.symbol} ${String(t.direction).toUpperCase()} · ${who}`,
      `Entry ${px(t.entry)} · Stop ${px(t.stop)}`,
      `TP1 ${px(tp1)} (${r1(tpR(tp1))}R)${t.tp2 ? ` · TP2 ${px(t.tp2)}` : ""}`,
      `Risk ${r1(m.riskPct != null ? Math.abs(m.riskPct) : t.risk_percent != null ? Number(t.risk_percent) : null)}% of account · R:R 1:${r1(m.rr)}${t.leverage ? ` · ${r1(Number(t.leverage))}x` : ""}`,
    ],
    [t.setup_type ? `Setup: ${t.setup_type.replace(/_/g, " ")}` : ""].filter(Boolean),
    [DISCLAIMER]
  );
}

export function tradeClosePost(t: Trade) {
  const m = tradeMetrics(t);
  const held = t.opened_at && t.closed_at ? Math.round((new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime()) / 3600_000) : null;
  const r = t.r_multiple != null ? Number(t.r_multiple) : null;
  return fit(
    [
      `Closed: ${t.symbol} ${String(t.direction).toUpperCase()} · ${signed(r, "R")} (${signed(m.resultPct ?? (r != null && t.risk_percent != null ? r * Number(t.risk_percent) : null), "%")} of account)`,
      `Entry ${px(t.entry)} → exit ${px(t.exit_price)}${held != null ? ` · held ${held}h` : ""}`,
    ],
    [t.exit_reason ? `Exit: ${t.exit_reason.replace(/_/g, " ")}` : "", t.origin ? (t.origin === "own" ? "Call: own read" : "Call: Moonbag desk") : ""].filter(Boolean),
    [DISCLAIMER]
  );
}

// ---------------------------------------------------------------- storage
async function upsertPost(kind: string, ref: string, text: string) {
  const db = supabaseAdmin();
  const post_id = `XP-${kind}-${ref}`;
  const { error } = await db.from("x_posts").insert({ post_id, kind, ref, text }).select("post_id").maybeSingle();
  // 23505 = already created for this trade/day — that's fine (one post per event).
  if (error && error.code !== "23505") throw new Error(error.message);
  return post_id;
}

/** Called when Grok records a BloFin trade. Never throws — a post failing must not block the trade record. */
export async function queueTradePost(t: Trade, kind: "trade_open" | "trade_close") {
  try {
    if (t.venue !== "blofin") return null;
    if (kind === "trade_close") return await upsertPost(kind, t.trade_id, tradeClosePost(t));
    const sigId = /MBS-\d{4}-\d{2}-\d{2}-[A-Z0-9]+-\d+/.exec(String(t.execution_notes ?? ""))?.[0];
    const db = supabaseAdmin();
    const { data } = sigId
      ? await db.from("lev_signals").select("confidence_score, confidence_grade").eq("signal_id", sigId).maybeSingle()
      : { data: null };
    return await upsertPost(kind, t.trade_id, tradeOpenPost(t, (data as SignalLite) ?? null));
  } catch (e) {
    console.error("[x_posts]", e);
    return null;
  }
}

/** The morning brief post is created on first request after 6:00 AM Phoenix (after the daily cycle). */
export async function ensureMorningBriefPost() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Phoenix", hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 6) return null;
  const db = supabaseAdmin();
  const ref = today();
  const { data } = await db.from("x_posts").select("post_id").eq("kind", "morning_brief").eq("ref", ref).maybeSingle();
  if (data) return data.post_id as string;
  const b = await buildBriefing();
  return upsertPost("morning_brief", ref, morningBriefPost(b.brief));
}

export async function listPosts(status?: string, limit = 20) {
  const db = supabaseAdmin();
  let q = db.from("x_posts").select("*").order("created_at", { ascending: true }).limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function markPost(postId: string, status: "posted" | "skipped", postUrl?: string | null) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("x_posts")
    .update({ status, post_url: postUrl ?? null, posted_at: status === "posted" ? new Date().toISOString() : null })
    .eq("post_id", postId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
