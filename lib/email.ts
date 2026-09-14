// Resend client — instantiated lazily so a missing API key doesn't crash
// the module at import time.

import { Resend } from "resend";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function getFrom() {
  return process.env.RESEND_FROM_EMAIL ?? "Moonbag.ai <hello@moonbag.ai>";
}

/** Who gets notified when someone joins the waitlist. Supports a comma-separated list. */
function getNotifyRecipients(): string[] {
  const raw = process.env.WAITLIST_NOTIFY_EMAIL ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY) && getNotifyRecipients().length > 0;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notifies the Moonbag.ai team that someone signed up.
 * This is the email that must succeed — there is no database behind the form,
 * so a failure here means a lost signup.
 */
export async function sendWaitlistNotification(opts: {
  email: string;
  source?: string;
  userAgent?: string;
  ip?: string;
}) {
  const resend = getClient();
  const to = getNotifyRecipients();
  if (to.length === 0) throw new Error("WAITLIST_NOTIFY_EMAIL not set");

  const { email, source = "landing", userAgent = "", ip = "" } = opts;
  const when = new Date().toISOString();

  const rows: Array<[string, string]> = [
    ["Email", email],
    ["Source", source],
    ["Time (UTC)", when],
  ];
  if (ip) rows.push(["IP", ip]);
  if (userAgent) rows.push(["User agent", userAgent]);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f8;font-family:Inter,Arial,sans-serif;color:#111;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e8eb;border-radius:12px;padding:28px;">
            <tr>
              <td>
                <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#6b7280;font-weight:600;">
                  moonbag.ai
                </div>
                <h1 style="margin:10px 0 20px 0;font-size:20px;line-height:1.3;font-weight:700;color:#111;">
                  New waitlist signup
                </h1>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  ${rows
                    .map(
                      ([k, v]) => `<tr>
                    <td style="padding:6px 0;color:#6b7280;width:120px;vertical-align:top;">${escapeHtml(
                      k
                    )}</td>
                    <td style="padding:6px 0;color:#111;word-break:break-all;">${escapeHtml(
                      v
                    )}</td>
                  </tr>`
                    )
                    .join("")}
                </table>
                <div style="height:1px;background:#e6e8eb;margin:22px 0 16px 0;"></div>
                <a href="mailto:${escapeHtml(email)}" style="font-size:13px;color:#0b7;text-decoration:none;">
                  Reply to ${escapeHtml(email)} →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const { data, error } = await resend.emails.send({
    from: getFrom(),
    to,
    replyTo: email,
    subject: `New Moonbag.ai waitlist signup: ${email}`,
    html,
    text,
  });

  if (error) throw new Error(error.message ?? "Resend notification failed");
  return data;
}

/** Confirmation sent to the person who signed up. Best-effort. */
export async function sendWaitlistConfirmation(email: string) {
  const resend = getClient();
  const from = getFrom();

  const subject = "You're on the Moonbag.ai waitlist";

  const plain = `You're in.

Moonbag.ai is building an AI market intelligence and execution layer for traders who want speed, clarity, and an edge.

You'll be first to know when early access opens.

— Moonbag.ai`;

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#000000;font-family:Inter,Arial,sans-serif;color:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:48px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f10;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:40px 40px 8px 40px;">
                <div style="font-size:14px;letter-spacing:0.18em;text-transform:uppercase;background:linear-gradient(90deg,#3EF3A2,#36D1DC);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600;">
                  moonbag.ai
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 8px 40px;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;letter-spacing:-0.02em;font-weight:700;color:#ffffff;">
                  You're in.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 0 40px;">
                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);">
                  Moonbag.ai is building an AI market intelligence and execution layer for traders who want speed, clarity, and an edge.
                </p>
                <p style="margin:0 0 28px 0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);">
                  You'll be first to know when early access opens.
                </p>
                <div style="height:1px;background:rgba(255,255,255,0.08);margin:8px 0 24px 0;"></div>
                <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.45);">
                  — Moonbag.ai
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 40px 40px;">
                <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.3);">
                  Speed · Clarity · Execution
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject,
    html,
    text: plain,
  });

  if (error) throw new Error(error.message ?? "Resend confirmation failed");
  return data;
}
