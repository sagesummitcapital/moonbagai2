import { json, withAgent } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { liveOn, runBridge, tradeKeyConfigured } from "@/lib/moonbag/exec";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * BLOFIN EXECUTION BRIDGE (CR-101). See lib/moonbag/exec.ts.
 * POST — called by the Moonbag database (mb_exec_kick, inside the 15-minute engine) with a Vault-held token. Processes v_exec_queue.
 * GET  — status for Claude/Grok: live switch, trade key present, last 20 orders.
 */
export async function POST(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);
  const ok = await supabaseAdmin().rpc("mb_exec_token_ok", { p_token: token });
  if (ok.error || ok.data !== true) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    return json({ ok: true, ...(await runBridge()) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "bridge failed" }, 500);
  }
}

export const GET = withAgent(["claude", "grok"], async () => {
  const r = await supabaseAdmin().from("exec_orders").select("signal_id, mode, status, coin, side, entry, stop, tp, risk_usd, contracts, leverage, blofin_order_id, reason, created_at").order("created_at", { ascending: false }).limit(20);
  const live = liveOn();
  return json({
    ok: true, live, trade_key: tradeKeyConfigured(), orders: r.data ?? [],
    text: `BloFin bridge: ${live ? "LIVE — orders are placed on BloFin" : tradeKeyConfigured() ? "PAPER — trade key set, live switch off" : "PAPER — no trade key in Vercel yet"}. Last orders: ${(r.data ?? []).slice(0, 5).map((o: { coin: string; side: string; status: string; reason: string | null }) => `${o.coin} ${o.side} ${o.status}${o.reason ? ` (${o.reason})` : ""}`).join(" · ") || "none"}`,
  });
});
