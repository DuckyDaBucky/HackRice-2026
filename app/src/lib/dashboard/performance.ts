/**
 * Preview scoring (placeholder). Rubric-based evaluation (docs/04) isn't wired up yet —
 * these are deterministic stand-in numbers derived from each session id, so
 * they're stable across reloads instead of a live rubric score. Every caller
 * must label these as "preview" in the UI. Swap this module out once scored
 * transcripts exist; nothing else should need to change since callers only
 * see the shape below.
 */

export const SKILL_CATEGORIES = ["Technical", "Communication", "Confidence", "Structure"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export type SkillScores = Record<SkillCategory, number>;

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable 70-92 score for a given session id. */
export function sessionScore(seed: string): number {
  return 70 + (hash(seed) % 23);
}

/**
 * Skip penalty: every skipped question scores 0 and drags the average down
 * proportionally — i.e. each question is worth an equal share. Skipping 1 of 4
 * with an 80 base yields 60. Floor at 5 so a session never reads as literally
 * unscored when something was answered.
 */
export const SKIPPED_QUESTION_SCORE = 0;
export const MIN_ADJUSTED_SCORE = 5;

export function skippedCountFor(answered: number, total: number): number {
  if (!Number.isFinite(answered) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(total, total - Math.max(0, answered)));
}

/** Proportionally penalizes a 0-100 base score by unanswered share. */
export function applySkipPenalty(base: number, answered: number, total: number): number {
  if (!Number.isFinite(base) || total <= 0) return Math.round(base);
  const clampedAnswered = Math.max(0, Math.min(total, answered));
  if (clampedAnswered >= total) return Math.round(base);
  if (clampedAnswered <= 0) return MIN_ADJUSTED_SCORE;
  return Math.max(MIN_ADJUSTED_SCORE, Math.round((base * clampedAnswered) / total));
}

/** Skip-aware session score: base preview score penalized per skipped question. */
export function sessionScoreWithSkips(seed: string, answered: number, total: number): number {
  return applySkipPenalty(sessionScore(seed), answered, total);
}

const OFFSETS: Record<SkillCategory, number> = {
  Technical: 4,
  Communication: -4,
  Confidence: -1,
  Structure: 2,
};

export function skillBreakdown(seed: string): SkillScores {
  const base = sessionScore(seed);
  return Object.fromEntries(
    SKILL_CATEGORIES.map((label) => {
      const wobble = (hash(seed + label) % 7) - 3;
      const value = Math.max(60, Math.min(97, base + OFFSETS[label] + wobble));
      return [label, value];
    }),
  ) as SkillScores;
}

/** Skip-aware skill breakdown: each category scaled by answered/total share. */
export function skillBreakdownWithSkips(seed: string, answered: number, total: number): SkillScores {
  const base = skillBreakdown(seed);
  if (total <= 0 || answered >= total) return base;
  const clampedAnswered = Math.max(0, Math.min(total, answered));
  if (clampedAnswered <= 0) {
    return Object.fromEntries(SKILL_CATEGORIES.map((label) => [label, MIN_ADJUSTED_SCORE])) as SkillScores;
  }
  return Object.fromEntries(
    SKILL_CATEGORIES.map((label) => [label, applySkipPenalty(base[label], clampedAnswered, total)]),
  ) as SkillScores;
}

/**
 * Review accuracy with skips: scored answers averaged with every skipped
 * question counting as SKIPPED_QUESTION_SCORE (0). Unscored/null answers are
 * still excluded — only real verdicts + skips count.
 */
export function accuracyWithSkips(scores: number[], skippedCount: number): number | null {
  const valid = scores.filter((s) => Number.isFinite(s));
  const skipped = Math.max(0, Math.floor(skippedCount));
  const denominator = valid.length + skipped;
  if (denominator === 0) return null;
  const numerator = valid.reduce((sum, s) => sum + s, 0) + skipped * SKIPPED_QUESTION_SCORE;
  return Math.round(numerator / denominator);
}

export function overallScore(scores: SkillScores): number {
  const values = Object.values(scores);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function readinessLabel(score: number): string {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 50) return "Developing";
  return "Needs work";
}

/** Percent change vs. the previous score, or null when there's nothing to compare against. */
export function readinessDelta(previous: number | null, current: number): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function weakestCategory(scores: SkillScores): SkillCategory {
  return [...SKILL_CATEGORIES].sort((a, b) => scores[a] - scores[b])[0];
}

const FOCUS_COPY: Record<SkillCategory, string> = {
  Technical: "Sharpen this by narrating trade-offs out loud as you work through a problem.",
  Communication: "Focus on clear, structured explanations in your next few sessions.",
  Confidence: "Practice pacing your answers so they land with more certainty under pressure.",
  Structure: "Lean on a clear framework, like STAR, to organize your answers.",
};

export function focusCopy(category: SkillCategory): string {
  return FOCUS_COPY[category];
}

const TECHNICAL_STRENGTHS = ["Strong technical answers", "Clear problem breakdown", "Solid trade-off reasoning"];
const TECHNICAL_IMPROVEMENTS = ["Improve concision", "Go deeper on edge cases", "Explain complexity more clearly"];
const BEHAVIORAL_STRENGTHS = ["Strong communication", "Clear STAR structure", "Concrete, specific examples"];
const BEHAVIORAL_IMPROVEMENTS = ["Improve concision", "Add more specific outcomes", "Slow down under pressure"];

/** Short illustrative feedback tags for a session — same placeholder status as the score above. */
export function sessionHighlight(seed: string, mode: "technical" | "behavioral") {
  const strengths = mode === "technical" ? TECHNICAL_STRENGTHS : BEHAVIORAL_STRENGTHS;
  const improvements = mode === "technical" ? TECHNICAL_IMPROVEMENTS : BEHAVIORAL_IMPROVEMENTS;
  return {
    strength: strengths[hash(`${seed}str`) % strengths.length],
    improvement: improvements[hash(`${seed}imp`) % improvements.length],
  };
}

export function sessionDurationMinutes(createdAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  return ms > 0 ? Math.max(1, Math.round(ms / 60000)) : null;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return "Today";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
