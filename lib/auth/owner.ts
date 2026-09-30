// Only the emails listed in MOONBAG_OWNER_EMAILS (comma-separated) may open the
// Moonbag app, even if someone else manages to create a Clerk account.
import { currentUser } from "@clerk/nextjs/server";

export function ownerEmails(): string[] {
  return (process.env.MOONBAG_OWNER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function getOwnerAccess() {
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
  const allow = ownerEmails();
  const allowlistSet = allow.length > 0;
  const allowed = Boolean(user) && (!allowlistSet || emails.some((e) => allow.includes(e)));
  return { user, emails, allowed, allowlistSet };
}
