// Machine-to-machine auth for Claude and Grok.
// Each agent gets its own secret key (set in Vercel env vars):
//   MOONBAG_CLAUDE_API_KEY → full read/write (strategy layer)
//   MOONBAG_GROK_API_KEY   → read theses/handoffs, respond to handoffs, write trades
// Send it as:  Authorization: Bearer <key>

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { MoonbagDbError } from "./db";

export type Agent = "claude" | "grok";

function same(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function identifyAgent(req: Request): Agent | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const claude = process.env.MOONBAG_CLAUDE_API_KEY ?? "";
  const grok = process.env.MOONBAG_GROK_API_KEY ?? "";
  if (claude.length >= 24 && same(token, claude)) return "claude";
  if (grok.length >= 24 && same(token, grok)) return "grok";
  return null;
}

/**
 * Wraps an API handler: checks the key + allowed agents, checks Supabase is
 * configured, and turns DB errors (e.g. immutability violations) into 400s.
 */
export function withAgent(
  allowed: Agent[],
  handler: (req: Request, agent: Agent, ctx: { params: Record<string, string> }) => Promise<Response>
) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    const agent = identifyAgent(req);
    if (!agent) return json({ ok: false, error: "Unauthorized" }, 401);
    if (!allowed.includes(agent)) return json({ ok: false, error: `Forbidden for ${agent}` }, 403);
    if (!isSupabaseConfigured()) return json({ ok: false, error: "Supabase is not configured" }, 503);
    try {
      return await handler(req, agent, ctx ?? { params: {} });
    } catch (e) {
      if (e instanceof MoonbagDbError || e instanceof BadRequest) {
        return json({ ok: false, error: e.message }, 400);
      }
      console.error("[moonbag api]", e);
      return json({ ok: false, error: "Unexpected error" }, 500);
    }
  };
}

export class BadRequest extends Error {}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequest("Body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

export function requireFields(body: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length) throw new BadRequest(`Missing required field(s): ${missing.join(", ")}`);
}

/** Keep only the listed keys (prevents writing IDs/timestamps the DB owns). */
export function pick<T extends Record<string, unknown>>(body: T, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}
