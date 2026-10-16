import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { getWoodsLevels, woodsText, WOODS_KINDS } from "@/lib/moonbag/woods";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The current Woods map. `text` is relayed word for word. */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const coin = new URL(req.url).searchParams.get("coin") ?? undefined;
  const levels = await getWoodsLevels(coin);
  // The Woods machine (every 15 min on BloFin bars): checklist + the limit tickets with confidence, stamped with data time.
  let q = supabaseAdmin().from("woods_machine").select("coin, side, data_as_of, price, checklist, trigger, limit_plan, confidence, grade, blocked").order("confidence", { ascending: false });
  if (coin) q = q.eq("coin", coin.toUpperCase());
  const { data: machine } = await q;
  const ph = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" }) : "—");
  const rows = (machine ?? []) as { coin: string; side: string; data_as_of: string | null; trigger: boolean; limit_plan: Record<string, number | string> | null; confidence: number | null; grade: string | null; blocked: string | null }[];
  const tickets = rows.map((r) => {
    const lp = r.limit_plan;
    return `${r.trigger ? "TRIGGER · " : ""}${r.coin} ${r.side.toUpperCase()} ${r.grade ?? "?"} ${r.confidence ?? "?"}/100${lp ? ` · limit ${lp.entry} · SL ${lp.stop} · TP1 ${lp.tp1} (${lp.rr1}R, 70%) · TP2 ${lp.tp2} (${lp.rr2}R)` : ""}${r.blocked ? ` · NOT NOW: ${r.blocked}` : ""} · data ${ph(r.data_as_of)} Phoenix`;
  });
  return json({ ok: true, text: [woodsText(levels), "", "WOODS MACHINE (every 15 min, BloFin bars):", ...tickets].join("\n"), levels, machine: rows });
});

/**
 * Record levels Stavros relays from Woods: {"levels":[{"coin","kind","low","high","timeframe","note"}], "replace": ["BTC"]}
 * kind: line_in_sand | flip | demand | supply | order_block | liquidity | range_high | range_low | target | note.
 * "replace" deactivates the current levels of those coins first (a new map replaces the old one).
 * Deactivate one: {"deactivate": <level_id>}.
 */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  const db = supabaseAdmin();
  if (body.deactivate != null) {
    const r = await db.from("woods_levels").update({ active: false, updated_at: new Date().toISOString() }).eq("level_id", Number(body.deactivate)).select("level_id");
    if (r.error) throw new BadRequest(r.error.message);
    return json({ ok: true, deactivated: r.data });
  }
  const list = Array.isArray(body.levels) ? (body.levels as Record<string, unknown>[]) : [];
  if (!list.length || list.length > 30) throw new BadRequest("Send 1-30 levels in \"levels\".");
  const rows = list.map((l) => {
    requireFields(l, ["coin", "kind"]);
    const kind = String(l.kind);
    if (!(WOODS_KINDS as readonly string[]).includes(kind)) throw new BadRequest(`kind must be one of ${WOODS_KINDS.join(", ")}`);
    const low = l.low == null ? null : Number(l.low), high = l.high == null ? low : Number(l.high);
    return { coin: String(l.coin).toUpperCase(), kind, low, high, timeframe: l.timeframe == null ? null : String(l.timeframe), note: l.note == null ? null : String(l.note), source: agent === "grok" ? "woods" : String(l.source ?? "woods") };
  });
  if (Array.isArray(body.replace) && body.replace.length) {
    const r = await db.from("woods_levels").update({ active: false, updated_at: new Date().toISOString() }).in("coin", (body.replace as string[]).map((c) => c.toUpperCase())).eq("active", true);
    if (r.error) throw new BadRequest(r.error.message);
  }
  const ins = await db.from("woods_levels").insert(rows).select("*");
  if (ins.error) throw new BadRequest(ins.error.message);
  return json({ ok: true, levels: ins.data, text: woodsText(await getWoodsLevels()) }, 201);
});
