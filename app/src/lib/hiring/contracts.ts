import { z } from "zod";

export const reportReleaseMaskSchema = z.object({
  summary: z.boolean(),
  rubric: z.boolean(),
  perQuestion: z.boolean(),
  transcript: z.boolean(),
  recordings: z.boolean(),
});

export type ReportReleaseMask = z.infer<typeof reportReleaseMaskSchema>;

export const approvedQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(1),
  prompt: z.string().min(1),
  category: z.enum(["behavioral", "technical-behavioral"]),
  competency: z.string(),
  profileEvidence: z.array(z.string()).default([]),
  projectId: z.string().nullable().default(null),
  sourceQuestionId: z.string().nullable().default(null),
  origin: z.string(),
  rubricId: z.string().optional(),
  // Rich generator metadata (Phase C). Optional so packs approved before
  // this field existed still parse — the overlay simply shows less for them.
  intent: z.string().optional(),
  strongAnswerIndicators: z.array(z.string()).min(1).max(6).optional(),
});

export type ApprovedQuestion = z.infer<typeof approvedQuestionSchema>;

export const hiringInterviewPolicySchema = z.object({
  frozenPlan: z.literal(true),
  hideFutureQuestions: z.literal(true),
  allowRetakesBeforeSubmit: z.literal(true),
  allowFollowUps: z.literal(false),
  completionWindowSeconds: z.number().int().default(7200),
  subtitleSize: z.enum(["small", "medium", "large", "extra-large"]).default("medium"),
});

export type HiringInterviewPolicy = z.infer<typeof hiringInterviewPolicySchema>;

export const DEFAULT_HIRING_POLICY: HiringInterviewPolicy = {
  frozenPlan: true,
  hideFutureQuestions: true,
  allowRetakesBeforeSubmit: true,
  allowFollowUps: false,
  completionWindowSeconds: 7200,
  subtitleSize: "medium",
};

export type SessionPrincipal =
  | { kind: "practice_owner"; clerkUserId: string; sessionId: string }
  | { kind: "assigned_candidate"; clerkUserId: string; sessionId: string; candidacyId: string }
  | { kind: "org_recruiter"; clerkUserId: string; sessionId: string; organizationId: string; role: "admin" | "recruiter" };
