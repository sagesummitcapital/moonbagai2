# Moonbag.ai — Landing Page

Premium, AI-native landing page for Moonbag.ai, an AI market intelligence & execution layer for traders.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Supabase (optional) · Resend (optional) · Vercel

---

## Deploy now, wire credentials later

The site is built to **deploy immediately with zero env vars**. Signups still work — they're logged to the platform console. When you're ready, add Supabase + Resend credentials and the same form automatically starts storing to your database and sending confirmation emails.

### Zero-config deploy (takes 2 minutes)

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "initial"
git remote add origin <your-repo>
git push -u origin main

# 2. Import the repo on Vercel → click Deploy
# That's it. The site is live.
```

Signups hit `/api/waitlist` and appear in **Vercel → Your Project → Logs** as:
```
[waitlist] (no storage configured) signup: user@domain.com · source=hero
```

You can scrape those lines later if you want to recover pre-launch signups.

---

## Add credentials (when ready)

### 1. Supabase (waitlist storage)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste `supabase/schema.sql` → Run.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_`. It's only read inside `app/api/waitlist/route.ts`.

### 2. Resend (confirmation emails)

1. Sign up at [resend.com](https://resend.com).
2. Verify your sending domain (e.g. `moonbag.ai`).
3. Create an API key → `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL="Moonbag.ai <hello@moonbag.ai>"`.

### 3. Push env vars to Vercel

**Vercel dashboard → Settings → Environment Variables**. Add all four. Redeploy.

No code changes needed. The waitlist route automatically detects the vars and switches on storage + email.

---

## Local development

```bash
npm install
cp .env.example .env.local   # optional — fill in only the creds you have
npm run dev                   # http://localhost:3000
```

---

## Pages & routes

| Route            | What it is                                              |
| ---------------- | ------------------------------------------------------- |
| `/`              | Landing page (12 sections from spec + Stats counters)   |
| `/privacy`       | Privacy policy                                          |
| `/terms`         | Terms of service with risk disclosure                   |
| `/contact`       | Contact channels                                        |
| `/thanks`        | Post-signup landing                                     |
| `/api/waitlist`  | POST endpoint — validates, stores (if configured), emails (if configured) |
| `/sitemap.xml`   | Auto-generated sitemap                                  |
| `/robots.txt`    | Robots file                                             |
| `/*` (anything else) | Branded 404 page                                    |

Every internal link in the navbar and footer routes somewhere real.

---

## Project structure

```
app/
├── api/waitlist/route.ts      # credential-optional POST endpoint
├── components/
│   ├── BackgroundFX.tsx       # global aurora + grid (rendered once in layout)
│   ├── Navbar.tsx             # sticky, blur-on-scroll, mobile menu
│   ├── Logo.tsx
│   ├── Hero.tsx               # rotating verb + ticker strip + CTA
│   ├── OpportunityBoard.tsx   # mock product UI (live-ticking scores)
│   ├── SocialProof.tsx
│   ├── Problem.tsx
│   ├── Stats.tsx              # animated counter section
│   ├── Features.tsx           # 6-card bento grid
│   ├── HowItWorks.tsx         # 3 steps with animated gradient connector
│   ├── LiveRatings.tsx        # filterable live board (tabs animate with layoutId)
│   ├── Differentiator.tsx
│   ├── Beta.tsx               # early-access incentives + form
│   ├── FAQ.tsx
│   ├── FinalCTA.tsx
│   ├── Footer.tsx             # real links, oversized wordmark
│   ├── WaitlistForm.tsx       # reusable email capture
│   └── PageShell.tsx          # wrapper for /privacy, /terms, /contact, /thanks, /404
├── privacy/page.tsx
├── terms/page.tsx
├── contact/page.tsx
├── thanks/page.tsx
├── not-found.tsx              # branded 404
├── sitemap.ts                 # /sitemap.xml
├── robots.ts                  # /robots.txt
├── globals.css                # brand tokens, aurora, glass, grid, shimmer, keyframes
├── layout.tsx                 # fonts + BackgroundFX + metadata
└── page.tsx                   # landing page composition
lib/
└── email.ts                   # Resend confirmation (lazy-init so missing key is safe)
public/logos/                  # 4 brand files (from your brand kit)
supabase/schema.sql            # one-shot schema for the waitlist table
tailwind.config.js
tsconfig.json
next.config.js
postcss.config.js
.env.example
```

---

## Brand system

All tokens live in `tailwind.config.js` + `app/globals.css`:

- **Colors** — `ink-0` through `ink-500` (refined blacks), `accent-green` (#3EF3A2), `accent-cyan` (#36D1DC), `accent-emerald` (deeper variant)
- **Gradient** — `bg-accent-gradient` (`#3EF3A2 → #36D1DC`)
- **Typography** — Inter (body/display) + JetBrains Mono (numbers, micro-labels)
- **Background atmosphere** — `.aurora` (animated keyframe glows), `.aurora-mid`, `.bg-grid-fine`, `.mask-radial-soft`, `.noise`
- **Text effects** — `.text-gradient`, `.text-gradient-animated`, `.shimmer`, `.accent-underline`
- **Surfaces** — `.glass`, `.glass-strong`, `.conic-border` (animated border glow)
- **Motion** — respects `prefers-reduced-motion` globally

---

## Customizing copy

| Where | What to edit |
| ----- | ------------ |
| Rotating verbs | `VERBS` array in `app/components/Hero.tsx` |
| Ticker symbols | `TICKER` array in `app/components/Hero.tsx` |
| Board rows | `baseRows` in `app/components/OpportunityBoard.tsx` |
| Live ratings assets | `ASSETS` in `app/components/LiveRatings.tsx` |
| Stats numbers | `STATS` in `app/components/Stats.tsx` |
| Feature cards | `features` array in `app/components/Features.tsx` |
| FAQ | `faqs` array in `app/components/FAQ.tsx` |
| Confirmation email | `lib/email.ts` |
| Legal copy | `app/privacy/page.tsx`, `app/terms/page.tsx` |

---

## Scripts

```bash
npm run dev     # local dev
npm run build   # prod build
npm run start   # serve prod build
npm run lint    # next lint
```

---

Built for traders who want speed, clarity, and execution.
