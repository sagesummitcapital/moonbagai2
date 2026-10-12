import { withAgent, json, readJson, requireFields, pick, BadRequest } from "@/lib/moonbag/apiAuth";
import { getLossJournal, LOSS_FIELDS } from "@/lib/moonbag/lossJournal";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The loss journal: pre-trade checks (patterns) + recent entries. Read it before giving trade inputs. */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 30)));
  return json({ ok: true, ...(await getLossJournal(limit)) });
});

/**
 * Add a loss or near-miss. If trade_id + kind already exists, the entry is updated instead
 * (so a later, fuller review replaces the first note).
 */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["what_happened"]);
  const row = pick(body, LOSS_FIELDS) as Record<string, unknown>;
  row.kind = row.kind ?? "loss";
  if (row.kind !== "loss" && row.kind !== "near_miss") throw new BadRequest('kind must be "loss" or "near_miss"');
  if (row.mistake_tags != null && !Array.isArray(row.mistake_tags)) throw new BadRequest("mistake_tags must be an array of short snake_case tags");
  row.source = row.source ?? agent;
  const db = supabaseAdmin();
  if (row.trade_id) {
    const found = await db.from("loss_journal").select("entry_id").eq("trade_id", row.trade_id as string).eq("kind", row.kind as string).limit(1);
    if (found.error) throw new Error(found.error.message);
    if (found.data?.length) {
      const upd = await db
        .from("loss_journal")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("entry_id", found.data[0].entry_id)
        .select("*")
        .single();
      if (upd.error) throw new BadRequest(upd.error.message);
      return json({ ok: true, updated: true, entry: upd.data });
    }
  }
  const ins = await db.from("loss_journal").insert(row).select("*").single();
  if (ins.error) throw new BadRequest(ins.error.message);
  return json({ ok: true, entry: ins.data }, 201);
});
