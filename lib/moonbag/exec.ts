import { createHmac, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * BLOFIN EXECUTION BRIDGE (CR-101, Stavros 2026-11-26 in Cowork: "Build and go live").
 * Takes trades from Moonbag's LIVE, gate-passed prop-engine strategies (v_exec_queue) and places them on his PERSONAL BloFin account:
 * a limit order at the signal's entry with the stop-loss and 2R take-profit attached to the order.
 *
 * Safety:
 *  - Only BloFin. There is no code path to Breakout / prop accounts, and his own plans (my_plans) are never auto-traded.
 *  - LIVE needs BOTH: a trade-enabled key in Vercel (BLOFIN_TRADE_API_* or, as Stavros set up 11/26, the existing BLOFIN_API_* key with Trade added —
 *    never a key with withdraw permission) AND BLOFIN_LIVE=true. Anything missing → the order is recorded as PAPER, nothing is sent.
 *  - His BloFin rules are checked before every order: 1% risk (BLOFIN_RISK_PCT, capped at 2%), stop for the day after −2% or two losses,
 *    one trade per coin, combined open risk ≤ 15%, leverage capped so liquidation sits well beyond the stop.
 *  - Each signal is handled once (exec_orders.signal_id is the primary key).
 * Fills, partials and closes come back through the existing read-only BloFin sync (blofin_* tables, v_blofin_reconcile).
 */
const BASE = "https://openapi.blofin.com";
const env = (n: string) => (process.env[n] ?? "").trim().replace(/^["']|["']$/g, "").trim();
/** Trade key: BLOFIN_TRADE_* if set, otherwise the existing BLOFIN_API_* key (Stavros 11/26: "i added trade permission to existing blofin api"). */
const key = (part: "KEY" | "SECRET" | "PASSPHRASE") => env(`BLOFIN_TRADE_API_${part}`) || env(`BLOFIN_API_${part === "KEY" ? "KEY" : part}`);

export function tradeKeyConfigured() {
  return Boolean(key("KEY") && key("SECRET") && key("PASSPHRASE"));
}
export function liveOn() {
  return env("BLOFIN_LIVE").toLowerCase() === "true" && tradeKeyConfigured();
}

function sign(prehash: string, secret: string) {
  const hex = createHmac("sha256", secret).update(prehash).digest("hex");
  return Buffer.from(hex, "utf8").toString("base64");
}

async function call(method: "GET" | "POST", path: string, body?: Record<string, unknown>, auth = true) {
  const payload = body ? JSON.stringify(body) : "";
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "moonbag.ai exec bridge" };
  if (auth) {
    const ts = String(Date.now());
    const nonce = randomUUID();
    headers["ACCESS-KEY"] = key("KEY");
    headers["ACCESS-PASSPHRASE"] = key("PASSPHRASE");
    headers["ACCESS-TIMESTAMP"] = ts;
    headers["ACCESS-NONCE"] = nonce;
    headers["ACCESS-SIGN"] = sign(path + method + ts + nonce + payload, key("SECRET"));
  }
  const res = await fetch(BASE + path, { method, headers, body: payload || undefined, cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { code?: string; msg?: string; data?: unknown } | null;
  if (!res.ok || !json || String(json.code) !== "0") throw new Error(`BloFin ${path}: ${res.status} ${json?.msg ?? "no body"}`);
  return json.data;
}

type Inst = { instId: string; contractValue: string; lotSize: string; minSize: string; tickSize: string; maxLeverage: string };
async function instrument(instId: string): Promise<Inst | null> {
  const d = (await call("GET", `/api/v1/market/instruments?instId=${encodeURIComponent(instId)}`, undefined, false)) as Inst[];
  return Array.isArray(d) && d[0] ? d[0] : null;
}

const decimals = (step: string) => (step.includes(".") ? step.split(".")[1].replace(/0+$/, "").length : 0);
const floorTo = (x: number, step: number) => Math.floor(x / step + 1e-9) * step;
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

type Q = { signal_id: string; strategy_key: string; coin: string; side: "long" | "short"; entry: number; stop: number; tp: number; strategy_name: string };
type Ctx = { equity: number | null; equity_at: string | null; day_pnl: number; day_losses: number; open_coins: string[]; open_risk_usd: number; pending_live_coins: string[] };

export async function runBridge() {
  const db = supabaseAdmin();
  const live = liveOn();
  const { data: queue, error } = await db.from("v_exec_queue").select("*");
  if (error) throw new Error(error.message);
  const ctxRes = await db.rpc("mb_exec_context");
  if (ctxRes.error) throw new Error(ctxRes.error.message);
  const ctx = ctxRes.data as Ctx;
  const riskPct = Math.min(2, Math.max(0.25, Number(env("BLOFIN_RISK_PCT") || 1)));
  const out: Record<string, unknown>[] = [];
  const busy = new Set<string>([...(ctx.open_coins ?? []), ...(ctx.pending_live_coins ?? [])]);
  let openRisk = Number(ctx.open_risk_usd ?? 0);

  for (const q of (queue ?? []) as Q[]) {
    const entry = Number(q.entry), stop = Number(q.stop), tp = Number(q.tp);
    const instId = `${q.coin}-USDT`;
    const equity = Number(ctx.equity ?? 0);
    const base = { signal_id: q.signal_id, coin: q.coin, side: q.side, inst_id: instId, entry, stop, tp, equity, risk_pct: riskPct, mode: live ? "live" : "paper" };
    // claim the signal first so it is never sent twice
    const claim = await db.from("exec_orders").insert({ ...base, status: "sending" });
    if (claim.error) continue; // already handled by another run
    const done = async (patch: Record<string, unknown>) => {
      await db.from("exec_orders").update({ ...patch, updated_at: new Date().toISOString() }).eq("signal_id", q.signal_id);
      out.push({ signal_id: q.signal_id, ...patch });
    };
    try {
      // his rules
      const skip =
        !equity ? "no BloFin balance on file" :
        ctx.day_pnl <= -0.02 * equity ? "daily stop: down 2% today" :
        ctx.day_losses >= 2 ? "two losses today — done for the day" :
        busy.has(q.coin) ? `already a trade on ${q.coin}` : null;
      if (skip) { await done({ status: "skipped", reason: skip }); continue; }
      const riskUsd = (equity * riskPct) / 100;
      if (openRisk + riskUsd > 0.15 * equity) { await done({ status: "skipped", reason: "combined open risk would pass 15%" }); continue; }

      const inst = await instrument(instId);
      if (!inst) { await done({ status: "skipped", reason: `${instId} not listed on BloFin` }); continue; }
      const cv = Number(inst.contractValue), lot = Number(inst.lotSize), min = Number(inst.minSize), tick = Number(inst.tickSize);
      const unit = Math.abs(entry - stop);
      const contracts = floorTo(riskUsd / unit / cv, lot);
      if (!(contracts >= min)) {
        await done({ status: "skipped", reason: `size ${(riskUsd / unit).toPrecision(3)} ${q.coin} at ${riskPct}% risk ($${riskUsd.toFixed(2)}) is below BloFin's minimum ${min} contracts — account too small for this stop` });
        continue;
      }
      const notional = contracts * cv * entry;
      const stopPct = unit / entry;
      const safetyCap = Math.floor(1 / (1.25 * stopPct + 0.005));
      const needed = Math.ceil(notional / (equity * 0.5)); // keep margin ≤ 50% of the account
      const leverage = Math.max(1, Math.min(needed, safetyCap, Number(inst.maxLeverage) || 20, 20));
      if (needed > leverage) { await done({ status: "skipped", reason: `needs ${needed}x but the safe cap is ${leverage}x for a ${(stopPct * 100).toFixed(2)}% stop` }); continue; }
      const px = (x: number) => roundTo(x, tick).toFixed(decimals(inst.tickSize));
      const order = {
        instId, marginMode: "isolated", positionSide: "net", side: q.side === "long" ? "buy" : "sell", orderType: "limit",
        price: px(entry), size: contracts.toFixed(decimals(inst.lotSize)),
        tpTriggerPrice: px(tp), tpOrderPrice: "-1", slTriggerPrice: px(stop), slOrderPrice: "-1",
        clientOrderId: q.signal_id.replace(/[^A-Za-z0-9]/g, "").slice(-32),
      };
      const sizing = { risk_usd: Number(riskUsd.toFixed(2)), contracts, leverage };
      if (!live) { await done({ status: "paper", ...sizing, reason: "paper: live switch off", response: { order } }); busy.add(q.coin); openRisk += riskUsd; continue; }
      await call("POST", "/api/v1/account/set-leverage", { instId, leverage: String(leverage), marginMode: "isolated" });
      const res = (await call("POST", "/api/v1/trade/order", order)) as { orderId?: string }[] | { orderId?: string };
      const orderId = Array.isArray(res) ? res[0]?.orderId : res?.orderId;
      await done({ status: "placed", ...sizing, blofin_order_id: orderId ?? null, reason: `${q.strategy_name}`, response: { order, res } });
      busy.add(q.coin); openRisk += riskUsd;
    } catch (e) {
      await done({ status: "error", reason: e instanceof Error ? e.message.slice(0, 300) : "unknown error" });
    }
  }
  return { live, trade_key: tradeKeyConfigured(), risk_pct: riskPct, handled: out };
}
