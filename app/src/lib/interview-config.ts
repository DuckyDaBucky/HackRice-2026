export type InterviewMood = "supportive" | "neutral" | "challenging";

export const MOOD_OPTIONS: { id: InterviewMood; label: string; description: string }[] = [
  {
    id: "supportive",
    label: "Supportive",
    description: "Warm delivery, encouraging follow-ups.",
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Professional and even-keeled — the default.",
  },
  {
    id: "challenging",
    label: "Challenging",
    description: "Pushes for rigor with pointed follow-ups.",
  },
];

export const DEFAULT_MOOD: InterviewMood = "neutral";

export function isInterviewMood(value: unknown): value is InterviewMood {
  return value === "supportive" || value === "neutral" || value === "challenging";
}

export const MIN_QUESTION_COUNT = 3;
export const MAX_QUESTION_COUNT = 6;
export const DEFAULT_QUESTION_COUNT = 3;

export function clampQuestionCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUESTION_COUNT;
  return Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, Math.round(value)));
}

export const MAX_CUSTOM_PROMPT_LENGTH = 500;

/** Tone instruction appended to the live follow-up prompt — real effect on generated follow-ups, not cosmetic. */
export const MOOD_FOLLOW_UP_INSTRUCTION: Record<InterviewMood, string> = {
  supportive: "Keep your tone warm and encouraging in the follow-up.",
  neutral: "Keep your tone neutral and professional in the follow-up.",
  challenging: "Be rigorous — if warranted, ask a pointed, skeptical follow-up that pushes for specifics.",
};
