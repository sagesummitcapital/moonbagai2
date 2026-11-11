import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { boardText, getLevelsBoard } from "@/lib/moonbag/levelsBoard";

export const dynamic = "force-dynamic";

/**
 * LEVELS BOARD (CR-72). Core coins, top 5 rotation and coins he traded in 60 days, with his range levels
 * (monthly open, prior month open/close, Monday high/low + sweeps, prior day high/low) and Moonbag's range and flip line.
 * Same numbers as moonbag.ai/dashboard/levels and the TradingView lines. Relay `text` word for word.
 * ?coin=BTC returns one coin.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const coin = new URL(req.url).searchParams.get("coin")?.trim().toUpperCase();
  let rows = await getLevelsBoard();
  if (coin) rows = rows.filter((r) => r.asset === coin || r.asset === `1000${coin}` || r.asset.replace(/^1000/, "") === coin);
  return json({ ok: true, text: boardText(rows), coins: rows });
});
