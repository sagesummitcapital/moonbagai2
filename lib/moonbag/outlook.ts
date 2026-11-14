import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * MY OUTLOOK (CR-77, Stavros 2026-11-13): "what i will be giving is thesis, or bias both macro and micro htf and ltf".
 * One row per coin (or MARKET), replaced when he gives a new view, flagged after 7 days.
 * It feeds the levels page (his view on top, his levels and flip line in the ladder), the TradingView MB LVL FLIP line,
 * the weekly bias (MARKET/BTC higher timeframe) and Claude's daily theses. The database does the work (mb_outlook_post).
 */
export type Bias = "bullish" | "bearish" | "neutral";
export type Outlook = {
  outlook_id: number;
  scope: string;
  given_at: string;
  htf_bias: Bias | null;
  htf_note: string | null;
  ltf_bias: Bias | null;
  ltf_note: string | null;
  macro_note: string | null;
  flip: number | null;
  invalidation: number | null;
  levels: { px: number; label: string }[];
  long_plan: string | null;
  short_plan: string | null;
  indicators: string | null;
  chart_note: string | null;
  his_words: string | null;
  source: string;
  age_days: number;
  stale: boolean;
};

/** The fields Grok fills from what he says. Everything is optional except a bias or his words. */
export const OUTLOOK_FIELDS = [
  "scope", "htf_bias", "htf_note", "ltf_bias", "ltf_note", "macro_note", "flip", "invalidation",
  "levels", "long_plan", "short_plan", "indicators", "chart_note", "his_words",
] as const;

export async function getOutlooks(): Promise<Outlook[]> {
  const r = await supabaseAdmin().from("v_outlook_active").select("*").order("scope");
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as Outlook[];
}

export async function postOutlook(body: Record<string, unknown>, by: string): Promise<Outlook> {
  const r = await supabaseAdmin().rpc("mb_outlook_post", { p: body, p_by: by });
  if (r.error) throw new Error(r.error.message);
  return r.data as Outlook;
}

export const biasWord = (b: Bias | null | undefined) => (b ? b[0].toUpperCase() + b.slice(1) : "—");

const num = (v: number | null | undefined) => (v == null ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 8 }));

/** One block Grok relays word for word. */
export function outlookText(o: Outlook) {
  const L: string[] = [];
  L.push(`YOUR VIEW — ${o.scope === "MARKET" ? "MARKET" : o.scope}${o.stale ? ` (OUT OF DATE: ${o.age_days} days old — give a fresh one)` : ""}`);
  L.push(`Higher timeframe: ${biasWord(o.htf_bias)}${o.htf_note ? ` — ${o.htf_note}` : ""}`);
  L.push(`Lower timeframe: ${biasWord(o.ltf_bias)}${o.ltf_note ? ` — ${o.ltf_note}` : ""}`);
  if (o.macro_note) L.push(`Macro: ${o.macro_note}`);
  if (o.flip != null) L.push(`Flip line: ${num(o.flip)} (above = bullish, below = bearish)`);
  if (o.invalidation != null) L.push(`Wrong if: ${num(o.invalidation)}`);
  if (o.levels?.length) L.push(`Your levels: ${o.levels.slice().sort((a, b) => b.px - a.px).map((l) => `${l.label} ${num(l.px)}`).join(" · ")}`);
  if (o.long_plan) L.push(`Long if: ${o.long_plan}`);
  if (o.short_plan) L.push(`Short if: ${o.short_plan}`);
  if (o.indicators) L.push(`Watching: ${o.indicators}`);
  return L.join("\n");
}
