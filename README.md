# Moonbag.ai

Public landing page **plus** the private Moonbag trading desk (the canonical thesis → grading →
confidence → execution loop from *Moonbag Master Trading System v1.1*).

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Clerk (login) · Supabase (records) · Resend · Vercel

> **First-time setup:** follow [`SETUP.md`](./SETUP.md) (plain English, ~20 min).
> **Claude / Grok integration:** see [`docs/AGENT_API.md`](./docs/AGENT_API.md).

## Moonbag desk (private)

| Route | What |
| --- | --- |
| `/dashboard` | Today — System Confidence, regime, Master/BTC/ETH/equity theses, yesterday's review, daily report |
| `/dashboard/opportunities` | Setups by score, Grok handoffs, TradingView alerts |
| `/dashboard/positions` | Open/pending positions by venue (Robinhood, BloFin, other) |
| `/dashboard/performance` | P&L, win rate, R multiples, forecast vs execution accuracy |
| `/dashboard/intelligence` | 30-day confidence, component accuracy, accuracy by asset/regime/setup/direction, lessons |
| `/dashboard/history` | Every thesis & version, evaluation, trade, alert |
| `/sign-in` | Clerk login · `/setup` shows which settings are missing |
| `/api/moonbag/*` | Agent API for Claude and Grok (API-key auth) |

Code map: `middleware.ts` (login gate) · `lib/auth/owner.ts` (owner allowlist) ·
`lib/supabase/admin.ts` (server-only client) · `lib/moonbag/{types,db,scoring,risk,apiAuth}.ts` ·
`supabase/migrations/20260930000000_moonbag_core.sql` (schema, immutability triggers, RLS).

---

## Waitlist signups

The waitlist form posts to `/api/waitlist`, which uses **Resend** to:

1. **Notify you** at `WAITLIST_NOTIFY_EMAIL` with the address, source, timestamp and IP — `Reply-To` is set to the signup, so hitting reply emails them directly.
2. **Confirm to the subscriber** with the branded "You're in" email.

Waitlist signups are not stored in the database. Every signup is also written to the platform log as
`[waitlist] signup: user@domain.com · source=hero · ip=...`, so signups stay
recoverable from **Vercel → Your Project → Logs** even if an email bounces.

The form has a hidden honeypot field and a best-effort per-IP rate limit
(10 requests/minute) to keep bots out of your inbox.

---

## Setup

### 1. Resend

1. Sign up at [resend.com](https://resend.com).
2. Verify your sending domain (e.g. `moonbag.ai`) — required for both emails to deliver.
3. Create an API key → `RESEND_API_KEY`.

### 2. Environment variables

**Vercel dashboard → Settings → Environment Variables** (all three, every environment):

| Variable | Example | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_xxxxxxxx` | From Resend → API Keys. |
| `RESEND_FROM_EMAIL` | `Moonbag.ai <hello@moonbag.ai>` | Must be on a domain verified in Resend. |
| `WAITLIST_NOTIFY_EMAIL` | `you@yourdomain.com` | Where signup alerts land. Comma-separate for several. |

Redeploy after adding them. Until they're set the form returns a 503 and the
signup is only written to the logs.

Locally: `cp .env.example .env.local` and fill the same three in.

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
└── email.ts                   # Resend notification + confirmation (lazy-init so missing key is safe)
public/logos/                  # 4 brand files (from your brand kit)
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
