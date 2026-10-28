import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getLossJournal } from "@/lib/moonbag/lossJournal";

export const dynamic = "force-dynamic";

/**
 * MISTAKES SUMMARY (CR-20, Stavros 2026-10-27: "Have Claude make that part of trade journal. Still should have detail but also
 * summary"). The running summary of every closed BloFin trade — top 3 rules, what keeps repeating (count + R cost, this week vs
 * before), and the Woods/Eliz filters followed vs ignored — plus the loss-journal detail below it. Same source as the leverage page.
 */
export const GET = withAgent(["grok", "claude"], async () => {
  const j = await getLossJournal(15);
  return json({ ok: true, text: j.text, summary: j.mistakes, filters: j.filters });
});
