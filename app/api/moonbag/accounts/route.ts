import { withAgent, json, readJson, requireFields, BadRequest } from "@/lib/moonbag/apiAuth";
import { createAccountSnapshot, latestAccountSnapshot } from "@/lib/moonbag/db";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Latest account snapshot per venue. */
export const GET = withAgent(["claude", "grok"], async () => {
  const [robinhood, blofin, coinbase] = await Promise.all([
    latestAccountSnapshot("robinhood"),
    latestAccountSnapshot("blofin"),
    latestAccountSnapshot("coinbase"),
  ]);
  return json({ ok: true, robinhood, blofin, coinbase });
});

/** Grok posts the Robinhood or Coinbase account state (and BloFin balances Stavros reports) (equity, cash, positions) — required before new positions are sized. */
export const POST = withAgent(["grok", "claude"], async (req, agent) => {
  const body = await readJson(req);
  requireFields(body, ["venue", "equity"]);
  if (body.venue !== "robinhood" && body.venue !== "blofin" && body.venue !== "coinbase") {
    throw new BadRequest('venue must be "robinhood", "blofin" or "coinbase"');
  }
  const snapshot = await createAccountSnapshot({
    venue: body.venue,
    equity: Number(body.equity),
    cash: body.cash == null ? null : Number(body.cash),
    buying_power: body.buying_power == null ? null : Number(body.buying_power),
    positions: Array.isArray(body.positions) ? body.positions : [],
    reported_by: agent,
  });
  // Deposits / withdrawals (Stavros, 2026-10-15: "im going to put another 1k into blofin") — so the goal bar and the
  // trading P&L don't count new money as profit. Positive = deposit, negative = withdrawal.
  let flow = null;
  if (body.deposit != null && Number(body.deposit) !== 0) {
    // The balance posted in the same call already INCLUDES this deposit, so the flow is dated just before the snapshot —
    // otherwise moonbag_calc_equity() adds it on top a second time (the 2026-10-16 $997.93 double count).
    const snapAt = (snapshot as { reported_at?: string } | null)?.reported_at;
    const flowAt = snapAt ? new Date(Date.parse(snapAt) - 1000).toISOString() : undefined;
    const ins = await supabaseAdmin().from("account_flows").insert({ venue: body.venue, amount: Number(body.deposit), note: body.note == null ? null : String(body.note), reported_by: agent, ...(flowAt ? { flow_at: flowAt } : {}) }).select("*").single();
    if (ins.error) throw new BadRequest(ins.error.message);
    flow = ins.data;
  }
  return json({ ok: true, snapshot, flow }, 201);
});
