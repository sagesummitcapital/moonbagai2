import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPropData, propText, GROK_PROP_PLAYBOOK } from "@/lib/moonbag/prop";

export const dynamic = "force-dynamic";

/**
 * PROP FIRM ACCOUNTS (CR-56, approved by Stavros 11/4). A separate book from BloFin.
 * GET  ?account_id=BRK-PRO-10K-1 (optional)  → status text (incl. what his BloFin record says) + `playbook` (Grok's fixed handling rules)
 *      + accounts, daily log, trades with firm flags, prop journal notes, edge
 * POST {action:"snapshot", account_id, balance, equity?, note?}  → record the balance/equity Stavros reads off the firm dashboard
 * POST {action:"stage", account_id, stage, note?}  (Claude only, after Stavros confirms in chat) → evaluation | passed | funded | breached | closed
 * Trades go through POST /trades with venue "breakout" and prop_account_id.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const id = new URL(req.url).searchParams.get("account_id")?.trim() || undefined;
  const d = await getPropData(id);
  const text = d.accounts.length ? d.accounts.map((a) => propText(a, d.trades, d.edge)).join("\n\n") : "No prop accounts on file.";
  return json({ ok: true, text, playbook: GROK_PROP_PLAYBOOK, ...d });
});

const STAGES = ["evaluation", "passed", "funded", "breached", "closed"];

export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["action", "account_id"]);
  const db = supabaseAdmin();
  const account_id = String(body.account_id);
  const acct = await db.from("prop_accounts").select("account_id, stage").eq("account_id", account_id).maybeSingle();
  if (acct.error) throw new BadRequest(acct.error.message);
  if (!acct.data) throw new BadRequest(`Unknown prop account ${account_id}.`);

  if (body.action === "snapshot") {
    requireFields(body, ["balance"]);
    const balance = Number(body.balance);
    const equity = body.equity == null ? balance : Number(body.equity);
    if (!(balance > 0) || !(equity > 0)) throw new BadRequest("balance and equity must be positive numbers.");
    const r = await db.from("prop_snapshots")
      .insert({ account_id, balance, equity, source: agent, note: body.note ? String(body.note).slice(0, 500) : null })
      .select().single();
    if (r.error) throw new BadRequest(r.error.message);
    const d = await getPropData(account_id);
    return json({ ok: true, snapshot: r.data, text: d.accounts[0] ? propText(d.accounts[0], d.trades) : "" }, 201);
  }

  if (body.action === "stage") {
    if (agent !== "claude") throw new BadRequest("Stage changes are Claude-only, after Stavros confirms in chat.");
    const stage = String(body.stage ?? "");
    if (!STAGES.includes(stage)) throw new BadRequest(`stage must be one of ${STAGES.join(", ")}.`);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { stage };
    if (stage === "funded") patch.funded_at = now;
    if (stage === "breached" || stage === "closed") patch.closed_at = now;
    const r = await db.from("prop_accounts").update(patch).eq("account_id", account_id).select().single();
    if (r.error) throw new BadRequest(r.error.message);
    return json({ ok: true, account: r.data });
  }

  throw new BadRequest('action must be "snapshot" or "stage".');
});
