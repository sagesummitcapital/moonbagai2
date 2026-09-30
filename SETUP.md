# Moonbag setup — plain-English checklist

About 20 minutes, no coding. Do the steps in order. At any point you can open
**moonbag.ai/setup** to see which settings are still missing (it shows ✓ / missing, never the secret values).

Where secrets go: **Vercel → your moonbag project → Settings → Environment Variables**.
For each one: paste the **Name** exactly as written, paste the **Value**, leave all environments ticked, click **Save**.
Never put these values in a file in the moonbagai2 folder.

---

## Step 1 — Publish the new code (GitHub Desktop)

1. Open **GitHub Desktop**. Top-left "Current repository" should say **moonbagai2**.
2. You'll see a list of changed files on the left. In the **Summary** box (bottom-left) type:
   `Add Clerk login + Supabase trading system`
3. Click **Commit to main**, then click **Push origin** (top bar).
4. Vercel rebuilds the site automatically (2–3 minutes). The public landing page keeps working
   even before the next steps are done — the private desk just stays locked.

## Step 2 — Database (Supabase)

1. Go to **supabase.com** → sign in → **New project**.
   Name: `moonbag` · pick a strong database password (save it in your password manager) · Region: *West US* · **Create**.
2. Wait ~2 minutes until the project is ready.
3. Left menu → **SQL Editor** → **New query**.
4. On your computer open `moonbagai2/supabase/migrations/20260930000000_moonbag_core.sql`
   (right-click → Open with → Notepad), **Select All**, **Copy**, paste it into Supabase, click **Run**.
   You should see a result row at the bottom. (Safe to run again — it never deletes data.)
5. Left menu → **Project Settings** (gear) → **API Keys** / **Data API**. Copy two things into Vercel:

| Vercel Name | Where to find the value in Supabase |
| --- | --- |
| `SUPABASE_URL` | "Project URL" — looks like `https://abcd1234.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The **secret** key (`sb_secret_…`) or legacy **service_role** key. Click "Reveal". |

> The secret key is like a master password to your data. It only lives in Vercel.

## Step 3 — Login (Clerk)

1. Go to **clerk.com** → **Sign up** (free) → **Create application**.
   Name: `Moonbag` · sign-in options: leave **Email** on (add **Google** if you like) → **Create application**.
2. Clerk shows a "Next.js" quick-start with two keys. Copy them into Vercel:

| Vercel Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | starts with `pk_test_…` |
| `CLERK_SECRET_KEY` | starts with `sk_test_…` |
| `MOONBAG_OWNER_EMAILS` | your email, e.g. `stavros@vantagerockfinancial.com` |

## Step 4 — Agent keys (Claude + Grok)

Add two more variables in Vercel. Claude gave you the two values in chat
(or make up any 40+ character random strings):

| Vercel Name | Value |
| --- | --- |
| `MOONBAG_CLAUDE_API_KEY` | the Claude key |
| `MOONBAG_GROK_API_KEY` | the Grok key |

## Step 5 — Redeploy and log in

1. Vercel → **Deployments** → on the newest one click **⋯ → Redeploy** (new variables only apply after a redeploy).
2. Open **moonbag.ai/setup** — everything should show ✓.
3. Open **moonbag.ai/sign-in** → **Sign up** with the same email you put in `MOONBAG_OWNER_EMAILS` → you land on the desk.
4. Lock the door: Clerk dashboard → **Configure → Restrictions → Sign-up mode → Restricted** → Save.
   Now nobody else can create an account (and even if they did, the owner-email check blocks them).

Done. The desk lives at **moonbag.ai/dashboard** (there's also a "Log in" link in the site's top bar).

---

### Later (optional)

- **Remove the "Development mode" badge on the login box:** in Clerk, create a *Production* instance for
  `moonbag.ai`, add the DNS records Clerk lists in your domain provider, then swap the two Clerk keys in
  Vercel for the `pk_live_` / `sk_live_` ones and redeploy.
- **If a Vercel build ever fails** mentioning `package-lock.json`, tell Claude — it's a one-line fix.

### What's protected, what's public

| Area | Who can see it |
| --- | --- |
| Landing page, waitlist, privacy/terms | Everyone |
| `/dashboard` (Today, Opportunities, Positions, Performance, Intelligence, History) | Only you, after Clerk login |
| `/api/moonbag/*` | Only Claude/Grok with their API keys |
| Supabase database | Only the server (RLS on, no public access) |
| `/Journal/index.html` (old static page) | Still public — ask Claude to move it behind login if it has anything private |
