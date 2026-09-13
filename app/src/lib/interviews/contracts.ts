import { z } from "zod";

export const CONTENT_TYPES = [
  "behavioral",
  "technical_concepts",
  "system_design",
  "code_explanation",
] as const;
export const SENIORITY_LEVELS = ["junior", "mid_level", "senior"] as const;
export const TIME_BUDGET_SECONDS = [180, 600, 1200, 1800] as const;
export const INTERVIEW_MOODS = ["supportive", "neutral", "challenging"] as const;

export const interviewContentTypeSchema = z.enum(CONTENT_TYPES);
export const senioritySchema = z.enum(SENIORITY_LEVELS);
export const timeBudgetSchema = z.union([
  z.literal(TIME_BUDGET_SECONDS[0]),
  z.literal(TIME_BUDGET_SECONDS[1]),
  z.literal(TIME_BUDGET_SECONDS[2]),
  z.literal(TIME_BUDGET_SECONDS[3]),
]);
export const interviewMoodSchema = z.enum(INTERVIEW_MOODS);

/** The setup snapshot persisted before planning begins. */
export const interviewSetupSchema = z.object({
  contentTypes: z.array(interviewContentTypeSchema).min(1).max(CONTENT_TYPES.length).transform(
    (value) => [...new Set(value)],
  ),
  targetRole: z.string().trim().min(1).max(160),
  seniority: senioritySchema,
  focusArea: z.string().trim().max(500).nullable(),
  timeBudgetSeconds: timeBudgetSchema,
  voiceId: z.string().trim().min(1).max(200).nullable(),
  mood: interviewMoodSchema,
  biometricsEnabled: z.boolean().default(false),
});

export type InterviewContentType = z.infer<typeof interviewContentTypeSchema>;
export type Seniority = z.infer<typeof senioritySchema>;
export type InterviewSetup = z.infer<typeof interviewSetupSchema>;

export const transcriptSegmentSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string().trim().min(1),
}).superRefine((value, context) => {
  if (value.endMs < value.startMs) {
    context.addIssue({ code: "custom", message: "Transcript segment ends before it starts." });
  }
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const PLAN_LENGTH_BY_TIME: Record<(typeof TIME_BUDGET_SECONDS)[number], {
  minimum: number;
  target: number;
  maximum: number;
}> = {
  180: { minimum: 1, target: 1, maximum: 1 },
  600: { minimum: 3, target: 4, maximum: 5 },
  1200: { minimum: 5, target: 6, maximum: 7 },
  1800: { minimum: 7, target: 8, maximum: 10 },
};

export function planLengthFor(timeBudgetSeconds: number) {
  return PLAN_LENGTH_BY_TIME[timeBudgetSchema.parse(timeBudgetSeconds)];
}

/** Blitz demo mode: one question plus at most one follow-up, ~3 minutes. */
export const BLITZ_TIME_BUDGET_SECONDS = 180 as const;

export function isBlitzBudget(timeBudgetSeconds: number): boolean {
  return timeBudgetSeconds === BLITZ_TIME_BUDGET_SECONDS;
}
