import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { getYesterdayReview, listUngradedTheses } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** Step 1 of every daily cycle: what did Moonbag believe yesterday, and what still needs a grade? */
export const GET = withAgent(["claude"], async (req) => {
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  const [review, ungraded] = await Promise.all([getYesterdayReview(date), listUngradedTheses()]);
  return json({ ok: true, ...review, all_ungraded: ungraded });
});
