import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { markPost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** Grok marks a post as posted (with its URL) or skipped. The text itself can't be changed here. */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const status = body.status;
  if (status !== "posted" && status !== "skipped") throw new BadRequest('status must be "posted" or "skipped".');
  const post = await markPost(params.id, status, typeof body.post_url === "string" ? body.post_url : null);
  return json({ ok: true, post });
});
