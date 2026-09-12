/**
 * Placeholder scoring. Rubric-based evaluation (docs/04) isn't wired up yet —
 * these are deterministic stand-in numbers derived from each session id, so
 * they're stable across reloads instead of a live rubric score. Swap this
 * module out once scored transcripts exist; nothing else should need to
 * change since callers only see the shape below.
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

export function overallScore(scores: SkillScores): number {
  const values = Object.values(scores);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
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
