// Leveraged position sizing — spec §9–§11.
// Order of operations: THESIS → INVALIDATION → STOP → STOP DISTANCE →
// MAX DOLLAR LOSS → POSITION SIZE → MARGIN → LEVERAGE.  Leverage comes last.

import type { Direction } from "./types";
import { gradeEligibility, setupGrade } from "./scoring";

export const RISK_DEFAULTS = {
  accountEquity: 240, // initial BloFin account
  riskPercent: 5, // grade-4 risk while the account is under $1,000 (grade 5 = 10%)
  riskCeilingPercent: 10, // ceiling while under $1,000 (Stavros, 2026-10-04) — never raised automatically
  maxMargin: 120, // max margin per position = half the account
  maxLeverage: 20, // sanity cap — tighter stops needing more leverage are NO TRADE
  feeRatePerSide: 0.0006, // taker fee estimate; adjust to your BloFin tier
} as const;

export interface SizingInput {
  asset: string;
  direction: Direction;
  entry: number;
  stop: number;
  invalidation?: string | null;
  tp1?: number | null;
  tp2?: number | null;
  tp3?: number | null;
  accountEquity?: number;
  riskPercent?: number;
  maxMargin?: number;
  feeRatePerSide?: number;
  setupScore?: number | null;
}

export type SizingResult =
  | { decision: "NO_TRADE"; reasons: string[] }
  | {
      decision: "TRADE_PLAN";
      asset: string;
      direction: Direction;
      accountEquity: number;
      entry: number;
      stop: number;
      stopDistance: number;
      stopDistancePct: number;
      maxLoss: number;
      riskPercent: number;
      positionSize: number; // units of the asset
      positionNotional: number;
      leverage: number;
      margin: number;
      estimatedCosts: number;
      approxLiquidationDistancePct: number;
      targets: { label: string; price: number; rMultiple: number }[];
      setupGrade: string | null;
      notes: string[];
    };

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function sizePosition(input: SizingInput): SizingResult {
  const reasons: string[] = [];
  const equity = input.accountEquity ?? RISK_DEFAULTS.accountEquity;
  const riskPct = input.riskPercent ?? RISK_DEFAULTS.riskPercent;
  const maxMargin = input.maxMargin ?? RISK_DEFAULTS.maxMargin;
  const feeRate = input.feeRatePerSide ?? RISK_DEFAULTS.feeRatePerSide;
  const { entry, stop, direction } = input;

  if (!(entry > 0)) reasons.push("Missing/invalid entry.");
  if (!(stop > 0)) reasons.push("Missing/invalid stop.");
  if (!input.invalidation) reasons.push("Missing invalidation.");
  if (!(equity > 0)) reasons.push("Missing account value.");
  if (riskPct > RISK_DEFAULTS.riskCeilingPercent)
    reasons.push(`Risk ${riskPct}% exceeds the ${RISK_DEFAULTS.riskCeilingPercent}% ceiling.`);
  if (direction === "long" && stop >= entry) reasons.push("Long stop must be below entry.");
  if (direction === "short" && stop <= entry) reasons.push("Short stop must be above entry.");

  const grade = setupGrade(input.setupScore ?? null);
  const elig = gradeEligibility(grade);
  if (input.setupScore == null) reasons.push("Missing setup score.");
  else if (!elig.eligible) reasons.push(`Setup grade ${grade}: ${elig.note}`);

  if (reasons.length) return { decision: "NO_TRADE", reasons };

  const stopDistance = Math.abs(entry - stop);
  const stopDistancePct = stopDistance / entry;
  const maxLoss = (equity * riskPct) / 100;
  const positionSize = maxLoss / stopDistance;
  const positionNotional = positionSize * entry;
  // Leverage LAST: the smallest whole leverage that keeps margin within the cap.
  const leverage = Math.max(1, Math.ceil(positionNotional / maxMargin));
  const margin = positionNotional / leverage;
  const estimatedCosts = positionNotional * feeRate * 2;
  const approxLiq = 1 / leverage; // ignores maintenance margin — conservative check below

  if (leverage > RISK_DEFAULTS.maxLeverage) {
    return {
      decision: "NO_TRADE",
      reasons: [`Needs ${leverage}x leverage to fit $${maxMargin} margin — above the ${RISK_DEFAULTS.maxLeverage}x cap. Stop is too tight for this account.`],
    };
  }
  if (stopDistancePct >= approxLiq * 0.8) {
    return {
      decision: "NO_TRADE",
      reasons: ["Stop is too close to estimated liquidation at the required leverage."],
    };
  }

  const r = (p: number) =>
    round(direction === "long" ? (p - entry) / stopDistance : (entry - p) / stopDistance);
  const targets = (
    [
      ["TP1", input.tp1],
      ["TP2", input.tp2],
      ["TP3", input.tp3],
    ] as const
  )
    .filter(([, p]) => typeof p === "number" && p > 0)
    .map(([label, p]) => ({ label, price: p as number, rMultiple: r(p as number) }));

  const notes: string[] = [];
  if (grade === "A") notes.push(elig.note);
  if (estimatedCosts > maxLoss * 0.2)
    notes.push("Fees are more than 20% of planned risk — consider a wider stop / smaller size.");

  return {
    decision: "TRADE_PLAN",
    asset: input.asset,
    direction,
    accountEquity: equity,
    entry,
    stop,
    stopDistance: round(stopDistance, 4),
    stopDistancePct: round(stopDistancePct * 100, 3),
    maxLoss: round(maxLoss),
    riskPercent: riskPct,
    positionSize: round(positionSize, 6),
    positionNotional: round(positionNotional),
    leverage,
    margin: round(margin),
    estimatedCosts: round(estimatedCosts),
    approxLiquidationDistancePct: round(approxLiq * 100, 2),
    targets,
    setupGrade: grade,
    notes,
  };
}
