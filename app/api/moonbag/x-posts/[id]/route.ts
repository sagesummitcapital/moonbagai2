import { withAgent, json, readJson, BadRequest } from "@/lib/moonbag/apiAuth";
import { getPost, markPost } from "@/lib/moonbag/xposts";

export const dynamic = "force-dynamic";

/** One post by id (e.g. the x_post_id returned when a trade is recorded or closed). */
export const GET = withAgent(["claude", "grok"], async (_req, _a, { params }) => {
  const post = await getPost(params.id);
  if (!post) throw new BadRequest(`No post ${params.id}. List them with GET /x-posts?status=all.`);
  return json({ ok: true, post });
});

/** Grok marks a post as posted (with its URL) or skipped. The text itself can't be changed here. */
export const PATCH = withAgent(["claude", "grok"], async (req, _a, { params }) => {
  const body = await readJson(req);
  const status = body.status;
  if (status !== "posted" && status !== "skipped") throw new BadRequest('status must be "posted" or "skipped".');
  const post = await markPost(params.id, status, typeof body.post_url === "string" ? body.post_url : null);
  return json({ ok: true, post });
});
