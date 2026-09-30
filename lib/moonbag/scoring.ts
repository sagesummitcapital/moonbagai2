// Forecast grading + System Confidence + setup classification.
// Mirrors the SQL in supabase/migrations/*_moonbag_core.sql so the UI and the
// database always agree.

import type { SetupGrade } from "./types";

/** Spec §7 — initial forecast-grading weights. */
export const GRADING_WEIGHTS = {
  direction: 0.3,
  levels: 0.25,
  setup: 0.2,
  invalidation: 0.15,
  target: 0.1,
} as const;

export type ComponentScores = {
  direction?: number | null;
  levels?: number | null;
  setup?: number | null;
  invalidation?: number | null;
  target?: number | null;
};

/** Weighted total (0–100). Components left null are "not applicable" and the rest are re-weighted. */
export function totalForecastScore(s: ComponentScores): number | null {
  let num = 0;
  let den = 0;
  (Object.keys(GRADING_WEIGHTS) as (keyof typeof GRADING_WEIGHTS)[]).forEach((k) => {
    const v = s[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      num += v * GRADING_WEIGHTS[k];
      den += GRADING_WEIGHTS[k];
    }
  });
  return den === 0 ? null : Math.round((num / den) * 100) / 100;
}

/** Full weight only after this many graded forecasts in the window. */
export const CONFIDENCE_FULL_SAMPLE = 20;
export const CONFIDENCE_WINDOW_DAYS = 30;

/**
 * System Confidence (0–100) = average graded score over the last 30 days
 * × min(1, graded / 20). Starts at 0 with no verified history (spec §6).
 * It measures recent forecasting quality — NOT the probability the next trade wins.
 */
export function systemConfidence(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * Math.min(1, scores.length / CONFIDENCE_FULL_SAMPLE));
}

/** Spec §13 — setup classification from a 0–10 setup score. */
export function setupGrade(score: number | null | undefined): SetupGrade | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 9) return "A+";
  if (score >= 8) return "A";
  if (score >= 6.5) return "B";
  return "C";
}

export function gradeEligibility(grade: SetupGrade | null) {
  switch (grade) {
    case "A+":
      return { eligible: true, note: "Eligible if risk requirements are satisfied." };
    case "A":
      return {
        eligible: true,
        note: "Potentially eligible — needs stronger confirmation and/or more conservative sizing.",
      };
    default:
      return { eligible: false, note: "Observe only." };
  }
}
