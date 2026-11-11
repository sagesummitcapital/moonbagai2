import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * LEVELS BOARD (CR-72, Stavros 2026-11-11): "a super simple display ... my range levels at a glance and highlights changes.
 * Monthly open, prior month open and close, Monday range, prior day range" layered with level play (sweep + close back, RSI)
 * and patience (market not confirmed until BTC is).
 * One source: mb_levels (recomputed from BloFin 4h bars at every 4h close; range levels change at the daily close, 5 PM Phoenix)
 * read through v_levels_board. The page, GET /levels/board, Grok and the TradingView lines all use these numbers.
 * Context only: only Moonbag A/A+ setups are trades. Nothing here blocks anything.
 */
export type Level = { key: string; label: string; px: number; dist_pct: number; src: "range" | "moonbag" };
export type BoardRow = {
  day: string;
  asset: string;
  section: string;
  sec: number;
  pos: number;
  tv_symbol: string | null;
  price: number | null;
  price_at: string | null;
  atr_4h: number | null;
  rsi_4h: number | null;
  levels: Record<string, number | string>;
  monday: { week?: string; high?: number; low?: number; dev_high?: string; dev_low?: string; formed?: boolean } | null;
  changes: string[];
  computed_at: string;
  ladder: Level[] | null;
  above: Level[] | null;
  below: Level[] | null;
  at_level: string | null;
  trigger: { side: "long" | "short"; level: string; px: number; bar: string } | null;
  market_ok: boolean;
  market_text: string;
  setup: string | null;
  status: "A+ SETUP" | "TRIGGERED" | "AT LEVEL" | "WAIT";
};

export const LEVEL_NAME: Record<string, string> = {
  mo: "monthly open", pmo: "prior month open", pmc: "prior month close", mon_h: "Monday high", mon_l: "Monday low",
  pdh: "prior day high", pdl: "prior day low", sup: "range low", res: "range high", flip: "bias flip",
};

const n = (v: unknown) => (v == null || v === "" ? null : Number(v));

export async function getLevelsBoard(): Promise<BoardRow[]> {
  const r = await supabaseAdmin().from("v_levels_board").select("*").order("sec").order("pos");
  if (r.error) throw new Error(r.error.message);
  return ((r.data ?? []) as Record<string, unknown>[]).map((x) => ({
    ...(x as unknown as BoardRow),
    price: n(x.price),
    atr_4h: n(x.atr_4h),
    rsi_4h: n(x.rsi_4h),
    changes: (x.changes as string[] | null) ?? [],
  }));
}

export function fmtPx(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  const d = a >= 1000 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : 8;
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export const statusWord = (s: BoardRow["status"]) =>
  s === "A+ SETUP" ? "A+ setup live" : s === "TRIGGERED" ? "Swept a level and closed back" : s === "AT LEVEL" ? "At a level — watch for the trigger" : "Wait — mid-range";

/** Plain text for Grok to relay word for word. */
export function boardText(rows: BoardRow[]) {
  if (!rows.length) return "Levels board: no data yet.";
  const L: string[] = [];
  L.push(`LEVELS — ${rows[0].day} (range levels reset at the daily close, 5 PM Phoenix)`);
  L.push(rows[0].market_text.replace(/ — alts.*$/, ""));
  let sec = "";
  for (const r of rows) {
    if (r.section !== sec) { sec = r.section; L.push(`\n${sec.toUpperCase()}`); }
    const up = (r.above ?? []).map((l) => `${l.label} ${fmtPx(l.px)} (+${l.dist_pct}%)`).join(", ");
    const dn = (r.below ?? []).map((l) => `${l.label} ${fmtPx(l.px)} (${l.dist_pct}%)`).join(", ");
    L.push(`${r.asset} ${fmtPx(r.price)} — ${r.status}${r.at_level ? ` at ${r.at_level}` : ""}${r.trigger && r.status === "TRIGGERED" ? ` (${r.trigger.side} after sweeping the ${LEVEL_NAME[r.trigger.level] ?? r.trigger.level})` : ""}${r.setup ? ` · ${r.setup}` : ""}`);
    L.push(`  above: ${up || "none on file"} · below: ${dn || "none on file"}${r.rsi_4h != null ? ` · 4h RSI ${r.rsi_4h}` : ""}`);
    if (r.changes.length) L.push(`  changed: ${r.changes.join("; ")}`);
  }
  L.push("\nContext only — only Moonbag A/A+ setups are trades.");
  return L.join("\n");
}
