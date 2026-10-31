import { withAgent, json, BadRequest } from "@/lib/moonbag/apiAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * ALERT RECORDS (CR-31, Stavros 2026-10-31: "if I get an alert you should be able to give me it too"; approved in Cowork 10/31).
 * Every MB SETUP / MB NEAR TradingView alert, muted ones included, leaves a record: grade, entry, SL, TPs, R, source, the paper
 * limit it came from, muted reason, Woods/Eliz warning (context only, CR-32), expiry and the TradingView alert id.
 * GET ?id=<#hex | hex | tv_alert_id | full alert name>  → the matching record(s), newest first
 * GET ?hours=48 (default 24, max 168)                     → every record in that window
 * Each record has a fixed `text` line to relay word for word.
 */
export const GET = withAgent(["claude", "grok"], async (req) => {
  const q = new URL(req.url).searchParams;
  const id = (q.get("id") ?? "").trim().replace(/^#/, "");
  const hours = Math.min(168, Math.max(1, Number(q.get("hours") ?? 24)));
  const db = supabaseAdmin();
  let s = db.from("v_mb_alert_records").select("*").order("alert_created_at", { ascending: false }).limit(100);
  if (id) {
    if (/^[0-9a-f]{6}$/i.test(id)) s = s.eq("hex_id", id.toLowerCase());
    else if (/^\d{6,}$/.test(id)) s = s.eq("tv_alert_id", Number(id));
    else s = s.ilike("alert_name", `%${id}%`);
  } else {
    s = s.gte("alert_created_at", new Date(Date.now() - hours * 3600_000).toISOString());
  }
  const r = await s;
  if (r.error) throw new BadRequest(r.error.message);
  const rows = (r.data ?? []) as { text: string }[];
  const text = rows.length
    ? rows.map((x) => x.text).join("\n")
    : id
      ? `No MB alert record matches "${id}". Records start 10/24; Woods/Eliz-sourced alerts stopped on 10/31 (CR-32).`
      : `No MB SETUP / MB NEAR alerts in the last ${hours}h.`;
  return json({ ok: true, text, records: rows });
});
