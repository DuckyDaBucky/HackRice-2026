import { z } from "zod";

/** Chess.com-style move review, applied to answers: a verdict per answered turn. */
export const REPORT_VERDICTS = ["blunder", "mistake", "inaccuracy", "good", "best", "insufficient_evidence"] as const;

export const reportVerdictSchema = z.enum(REPORT_VERDICTS);
export type ReportVerdict = z.infer<typeof reportVerdictSchema>;

export const reportFindingSchema = z.object({
  turnId: z.string().uuid(),
  verdict: reportVerdictSchema,
  explanation: z.string().trim().min(1).max(500),
  improvement: z.string().trim().min(1).max(500).nullable(),
}).strict();

export type ReportFindingInput = z.infer<typeof reportFindingSchema>;

export const reportOverviewSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  keyProblems: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
}).strict();

export type ReportOverview = z.infer<typeof reportOverviewSchema>;

export const rawReportSchema = z.object({
  overview: reportOverviewSchema,
  findings: z.array(reportFindingSchema).min(1),
}).strict();

/** One turn's transcript, flattened for the evaluator prompt and evidence linking. */
export interface ReportTranscriptTurn {
  turnId: string;
  planQuestionId: string | null;
  kind: string;
  position: number | null;
  prompt: string | null;
  text: string | null;
  startMs: number | null;
  endMs: number | null;
}
