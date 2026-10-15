// The Entropy Trap tab (Stavros, 2026-10-15: "i want a tab called entropy trap tab ... these are pictures from the book - i
// want to map this out and updated weekly based on market ... From a macro perspective i think its real and lines up with
// my thesis"). Book: The Entropy Trap — What Physics Knows that Markets Don't, Mickey M. Maini (foreword: James Rickards).
// The author's "Solstice Dashboard" withholds its inputs, weights and thresholds; every number here is Moonbag's own
// public-data approximation, computed weekly by the Entropy task into entropy_readings. Paraphrased — no book text copied.
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EntropyReading = {
  week: string;
  created_at: string;
  updated_at: string;
  ssi: number | null;
  ssi_zone: "green" | "orange" | "red" | null;
  ssi_v: number | null;
  ssi_a: number | null;
  ssi_j: number | null;
  components: Record<string, { score: number; detail?: string }>;
  pti_state: "equilibrium" | "disequilibrium" | "phase_transition" | null;
  pti_weeks_up: number | null;
  bowl: "deep" | "shallow" | "flat" | null;
  sri: "inflationary" | "inflationary_flip_risk" | "deflationary" | null;
  sei_stage: number | null;
  sam_active: string | null;
  sam: Record<string, { accel: number; detail?: string }>;
  rqi: "trap" | "real" | "no_rally" | null;
  state: "waiting" | "trapdoor" | "deployment" | null;
  signs: { id: number; name: string; met: boolean; detail?: string }[];
  falsifiers: { id: number; name: string; met: boolean; detail?: string }[];
  monitors: Record<string, number | string | null>;
  inputs: Record<string, unknown>;
  notes: Record<string, string>;
  verdict: string | null;
  moonbag: string | null;
  changed: string | null;
};

export async function getEntropy() {
  const { data, error } = await supabaseAdmin().from("entropy_readings").select("*").order("week", { ascending: false }).limit(26);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EntropyReading[];
  return { latest: rows[0] ?? null, history: rows };
}

/** The book's own readings (Chapter 7 table, 2026 edition) — shown next to ours. */
export const BOOK = {
  title: "The Entropy Trap — What Physics Knows that Markets Don't",
  author: "Mickey M. Maini (Solstice Labs); foreword by James Rickards",
  thesis: [
    "Trust is the energy that holds the monetary order together, and it is leaking. Stress builds in debt, monetary credibility, geopolitics and institutions at once, and each domain feeds the others.",
    "This is a phase transition, not a cycle: interventions push the stress level down for a while but never reverse its direction. Since 2008 stress velocity has not turned negative.",
    "Read the motion, not the level: velocity (getting worse?), acceleration and jerk (is the move organic or forced?). Levels can be managed; velocity is hard to fake.",
    "No single gauge is the signal — the combination is. Read together, the readings say: critically stressed, masked by intervention, intervention running out.",
    "Fiat-cycle clock: 2026 is year 55 since 1971, which the author pairs with 1927 in the Long Depression (1873–1944) — close to the 1929–30 analogue.",
    "Resolution comes through a crisis, not around it. Preservation is the entry fee; buying real assets in the crisis is the prize.",
  ],
  extra: [
    "Interview (Institutional Risk Analyst): the risk is migrating from banks to nonbanks — private credit, BDCs, nonbank mortgages, structured credit — and that migration is 'the signal'. The trigger is unknowable; getting the regime wrong is worse than getting the timing wrong.",
    "Cross-asset correlations are elevated (bonds stop hedging stocks in a transition) and each policy rescue buys less time — both are measurable.",
    "Central banks buying gold at a record pace for several years is read as trust in the reserve system leaking.",
  ],
};

export const GAUGES = [
  { key: "ssi", n: "01", name: "Solstice Stress Index (SSI)", q: "How unhealthy is the system?", book: "Deep red — highest sustained reading since the Long Depression; velocity positive for 18 straight years", how: "Composite of debt, monetary credibility, credit, volatility/correlation, geopolitics and trust → 0–100, plus its velocity, acceleration and jerk over 13-week steps. Green < 40 · Orange 40–65 · Red ≥ 65." },
  { key: "pti", n: "02", name: "Phase Transition Indicator (PTI)", q: "Correction or transition?", book: "Phase transition — stress velocity hasn't turned negative since 2008", how: "Does stress keep rising (velocity sign persistence) and how much restoring force is left (the 'bowl': policy-rate room + fiscal room). Equilibrium = velocity negative ≥ 12 months." },
  { key: "sri", n: "03", name: "Stress Regime Indicator (SRI)", q: "Inflation or deflation?", book: "Inflationary — can flip", how: "Saw-tooth (stress rises, dips on intervention, rises again) = inflationary. Cliff (interventions fail, credit breaks) = deflationary — the 'trapdoor'." },
  { key: "sei", n: "04", name: "Systemic Exhaustion Index (SEI)", q: "How far along?", book: "Late Stage 3 — the easy tools are spent", how: "Five stages of response: 1 monetary · 2 fiscal · 3 regulatory (export controls, industrial policy, investment screening) · 4 political · 5 coercion/military." },
  { key: "sam", n: "05", name: "Stress Allocation Map (SAM)", q: "Where is the biggest opportunity?", book: "Debt × Tech active — credit priced for calm while the old economy carries record debt", how: "Which intersection's stress is accelerating fastest: Debt × Tech (credit vs the AI split), Physical bottleneck (uranium, copper, power), Conflict (oil, defence, gold)." },
  { key: "rqi", n: "06", name: "The trader's signal (RQI)", q: "Real rally or trap?", book: "Trap — every big rally since 2008 had positive jerk", how: "Weeks to months. During a rally, if stress is still being forced up (positive jerk) the rally is a trap (1930); if stress is falling and the fall is accelerating, with breadth widening, it may be real (2009)." },
] as const;

export const STATES = [
  { key: "waiting", name: "1 · Waiting", when: "SRI inflationary, interventions still working", play: "Hold the core (gold, silver, energy). Build the cash reserve now — it can't be built after the trapdoor opens." },
  { key: "trapdoor", name: "2 · Trapdoor", when: "SRI flips: credit spreads spike, repo/interbank stress, bank lending freezes", play: "Cash is king. Liquidity over bravery. Strategic holdings take a temporary hit; the core holds." },
  { key: "deployment", name: "3 · Deployment", when: "RQI turns real: stress falling on its own, breadth expanding, credit healing without central-bank help", play: "Deploy the reserve into distressed real assets — the buying moment." },
] as const;

export const LAYERS = [
  { name: "Layer 1 · Trust portfolio (the core — never moves)", items: "Gold (centre), silver (gold with leverage — watch the gold/silver ratio compress), the energy basket (uranium, natural gas, oil, lithium). Bitcoin: conditional — 'the bridge, not the destination'.", moonbag: "Holdings sleeve: GLD, SLV + energy names; Coinbase BTC/ETH holds" },
  { name: "Layer 2 · Strategic (what governments will pay any price for)", items: "Zone A physical squeeze (energy, metals, critical minerals, infrastructure) · Zone B distressed credit/fintech · Zone C sovereign survival (semiconductors, defence tech, AI infrastructure, energy systems).", moonbag: "Holdings core names (NVDA, SPCX, TSLA, INTC) and the sovereign-industrial / AI-infrastructure themes" },
  { name: "Layer 3 · Liquidity reserve ('the loaded gun')", items: "Cash and short T-bills. Dead weight in Waiting, survival in Trapdoor, offensive capital in Deployment. Deploy on instrument confirmation, not a feeling.", moonbag: "Uninvested cash in Coinbase / Robinhood + the BloFin buffer" },
  { name: "Optionality sleeve", items: "Small asymmetric bets: AI infrastructure, defence tech, energy systems, Bitcoin, parallel financial rails. Most fail; a few transform.", moonbag: "Leverage desk + rotation picks — strict R:R" },
] as const;

export const SIGNS = [
  "Storm passing — spreads normal ≥ 12 months, volatility low without central-bank help, debt/GDP falling",
  "Trapdoor opening — credit spreads spike, bank lending freezes, repo/interbank stress",
  "System healing — real rates positive and staying positive, debt falling for real, balance sheets shrinking without stress",
  "Rally is real — breadth-led (not 7 stocks), small caps and cyclicals leading, credit improving, no emergency central-bank action in 6 months",
] as const;

export const FALSIFIERS = [
  "Stress velocity negative for 12+ months (the master signal)",
  "Leverage falling voluntarily — debt/GDP down through discipline, not inflation",
  "Governments retreating from markets — fewer export controls, less industrial policy, balance sheets shrinking calmly",
  "A real, verified US–China accommodation",
] as const;

export const FIAT_YEAR = (d = new Date()) => d.getUTCFullYear() - 1971;
