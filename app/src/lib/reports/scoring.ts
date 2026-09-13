import type { ReportVerdict } from "./contracts";

/** The single numeric interpretation of report verdicts used by every UI. */
export const REPORT_VERDICT_SCORES: Record<ReportVerdict, number | null> = {
  best: 100,
  good: 80,
  inaccuracy: 55,
  mistake: 30,
  blunder: 5,
  // An answered question with no usable evidence is still an attempted answer;
  // count it as zero so nonsense cannot disappear from the session average.
  insufficient_evidence: 0,
};

/**
 * Computes the report score. Skips and answers without usable evidence are
 * zeroes, so weak attempts cannot disappear from the denominator.
 */
export function reportScoreFromVerdicts(
  verdicts: readonly string[],
  skippedCount = 0,
): number | null {
  const scores = verdicts
    .map((verdict) => REPORT_VERDICT_SCORES[verdict as ReportVerdict])
    .filter((score): score is number => typeof score === "number");
  const skipped = Math.max(0, Math.floor(skippedCount));
  const denominator = scores.length + skipped;
  if (denominator === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / denominator);
}
