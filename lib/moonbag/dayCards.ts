import { supabaseAdmin } from "@/lib/supabase/admin";
import { BadRequest } from "./apiAuth";

/**
 * CR-58 (Stavros 11/5, approved in Cowork): his lean morning card, trade intakes and the daily market analysis live in the database,
 * so Grok and Claude analyse from the same rows. Order follows his plan: account rules → prep → setup → entry → risk → exit → management → review.
 * Value bar (Stavros 11/5): only what makes money or protects capital; plain English; one fixed card per day, no shifting level walls.
 */
export const DAY_CARD_FIELDS = [
  "bias", "bias_conf_pct", "invalidation", "key_levels", "account_rules", "events", "psych", "plan", "sections",
  "graded", "day_r", "followed_plan", "lesson",
] as const;
export const ANALYSIS_FIELDS = ["regime", "btc_bias", "conf_pct", "drivers", "levels", "formulas", "summary"] as const;
export const INTAKE_FIELDS = [
  "day", "venue", "prop_account_id", "symbol", "side", "bias", "invalidation", "trigger_tag", "setup_tag", "origin",
  "entry", "stop", "stop_structure", "tp1", "tp2", "exit_plan", "risk_pct", "risk_usd", "leverage", "feeling", "checks", "notes",
] as const;

export const phxToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

export function validDay(v: unknown) {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequest("day must be YYYY-MM-DD (Phoenix date).");
  return s;
}

export async function listByDay(table: "day_cards" | "market_analysis", day: string | null, days: number) {
  const db = supabaseAdmin();
  let q = db.from(table).select("*").order("day", { ascending: false });
  if (day) q = q.eq("day", day);
  else {
    const since = new Date(Date.now() - days * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
    q = q.gte("day", since);
  }
  const r = await q.limit(120);
  if (r.error) throw new BadRequest(r.error.message);
  return r.data ?? [];
}

export async function upsertDay(table: "day_cards" | "market_analysis", day: string, fields: Record<string, unknown>, agent: string) {
  const r = await supabaseAdmin().from(table)
    .upsert({ day, ...fields, written_by: agent, updated_at: new Date().toISOString() }, { onConflict: "day" })
    .select().single();
  if (r.error) throw new BadRequest(r.error.message);
  return r.data;
}

/** One fixed card as plain text, in his plan order. */
export function dayCardText(c: Record<string, any>) {
  if (!c) return "No day card yet.";
  const j = (o: unknown) => (o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ") : "");
  const s = (c.sections ?? {}) as Record<string, string>;
  const L = [
    `DAY CARD ${c.day}`,
    `Account rules: ${j(c.account_rules) || "—"}`,
    `Prep: bias ${c.bias ?? "—"}${c.bias_conf_pct != null ? ` ${c.bias_conf_pct}%` : ""} · wrong if ${c.invalidation ?? "—"}${c.events ? ` · events: ${c.events}` : ""}${c.psych ? ` · state: ${c.psych}` : ""}`,
    `Levels: ${j(c.key_levels) || "—"}`,
    `Plan: ${c.plan ?? "—"}`,
    ...["setup", "entry", "risk", "exit", "management"].filter((k) => s[k]).map((k) => `${k[0].toUpperCase() + k.slice(1)}: ${s[k]}`),
  ];
  if (c.graded) L.push(`Review: ${c.graded}${c.day_r != null ? ` · ${c.day_r}R` : ""}${c.followed_plan != null ? ` · followed plan ${c.followed_plan ? "yes" : "no"}` : ""}${c.lesson ? ` · lesson: ${c.lesson}` : ""}`);
  return L.join("\n");
}
