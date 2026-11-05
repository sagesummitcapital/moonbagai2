import { withAgent, json, readJson, pick } from "@/lib/moonbag/apiAuth";
import { DAY_CARD_FIELDS, dayCardText, listByDay, phxToday, upsertDay, validDay } from "@/lib/moonbag/dayCards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * DAY CARDS (CR-58). One fixed plan card per Phoenix day.
 * GET  ?day=YYYY-MM-DD | ?days=14 (default today)  → cards + `text` (today's card, plain words) + `review` (v_day_card_review) + `bias_score`
 * POST {day?, bias, bias_conf_pct, invalidation, key_levels{}, account_rules{}, events, psych, plan, sections{prep,setup,entry,risk,exit,management}}
 *      upserts on day; send the review later on the same day row: {day, graded: hit|miss|partial|no_trade, day_r, followed_plan, lesson}
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(q.get("days") ?? 0) || 0));
  const day = q.get("day") ? validDay(q.get("day")) : days ? null : phxToday();
  const cards = await listByDay("day_cards", day, days || 1);
  const db = supabaseAdmin();
  const [review, score] = await Promise.all([
    db.from("v_day_card_review").select("*").order("day", { ascending: false }).limit(30),
    db.from("v_day_card_bias_score").select("*"),
  ]);
  return json({ ok: true, text: cards.length ? dayCardText(cards[0] as Record<string, unknown>) : `No day card for ${day ?? "that range"}.`, cards, review: review.data ?? [], bias_score: score.data ?? [] });
});

export const POST = withAgent(["claude", "grok"], async (req, agent) => {
  const body = await readJson(req);
  const day = body.day ? validDay(body.day) : phxToday();
  const card = await upsertDay("day_cards", day, pick(body, DAY_CARD_FIELDS), agent);
  return json({ ok: true, card, text: dayCardText(card as Record<string, unknown>) }, 201);
});
