import { z } from "zod";

export const REPORT_COMPETENCIES = [
  "concrete_example",
  "technical_reasoning",
  "structured_communication",
  "ownership_and_impact",
] as const;

export const reportCompetencySchema = z.enum(REPORT_COMPETENCIES);
export type ReportCompetency = z.infer<typeof reportCompetencySchema>;

export const REPORT_FINDING_KINDS = ["strength", "gap", "insufficient_evidence"] as const;
export const REPORT_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const reportFindingSchema = z.object({
  competencyId: reportCompetencySchema,
  kind: z.enum(REPORT_FINDING_KINDS),
  finding: z.string().trim().min(1).max(500),
  improvement: z.string().trim().min(1).max(500).nullable(),
  evidenceTurnIds: z.array(z.string().uuid()).max(5),
  confidence: z.enum(REPORT_CONFIDENCE_LEVELS),
}).strict();

export const rawReportSchema = z.object({
  findings: z.array(reportFindingSchema).min(REPORT_COMPETENCIES.length).max(REPORT_COMPETENCIES.length * 2),
}).strict();

export type ReportFindingInput = z.infer<typeof reportFindingSchema>;

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
