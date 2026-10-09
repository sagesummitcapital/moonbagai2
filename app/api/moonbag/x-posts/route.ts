import { withAgent, json } from "@/lib/moonbag/apiAuth";
import { ensureMorningBriefPost, listPosts } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/**
 * X posts for Grok to publish, oldest first. Filled from fixed templates (R and % only, no $).
 * The morning brief post is created on the first call after 6:00 AM Phoenix; trade posts are
 * created automatically when a BloFin trade is recorded (opened) or closed.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  await ensureMorningBriefPost();
  const posts = await listPosts(status === "all" ? undefined : status);
  return json({ ok: true, posts });
});
