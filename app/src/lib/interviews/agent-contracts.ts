import { z } from "zod";

export const agentRationaleSchema = z.enum([
  "missing_specific_example",
  "needs_tradeoff",
  "candidate_requested_clarification",
  "coverage_complete",
  "time_budget_reached",
  "provider_fallback",
]);

export const agentDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ask_follow_up"),
    rationale: z.enum(["missing_specific_example", "needs_tradeoff"]),
    wording: z.string().trim().min(8).max(650),
  }).strict(),
  z.object({
    action: z.literal("move_to_next_question"),
    rationale: z.enum(["coverage_complete", "provider_fallback"]),
  }).strict(),
  z.object({
    action: z.literal("close_interview"),
    rationale: z.enum(["time_budget_reached", "coverage_complete", "provider_fallback"]),
  }).strict(),
]);

export type AgentDecision = z.infer<typeof agentDecisionSchema>;

export interface AgentContext {
  sessionId: string;
  turnId: string;
  planQuestionId: string;
  sessionStatus: "in_progress";
  questionPrompt: string;
  questionIntent: Record<string, unknown>;
  transcript: string;
  followUpsUsed: number;
  maxFollowUps: number;
  elapsedActiveMs: number;
  timeBudgetSeconds: number;
  isLastQuestion: boolean;
  cameraObservations?: string | null;
  presageNotes?: string | null;
}
