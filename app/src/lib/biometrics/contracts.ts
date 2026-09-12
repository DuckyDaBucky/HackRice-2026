import { z } from "zod";

export const videoAnalysisEventSchema = z.object({
  type: z.string(),
  emittedAt: z.string(),
}).loose();

export const videoAnalysisSchema = z.object({
  analysisId: z.string(),
  sdkVersion: z.string(),
  requestedMetrics: z.array(z.number()),
  status: z.literal("completed"),
  eventCounts: z.record(z.string(), z.number()),
  events: z.array(videoAnalysisEventSchema),
}).loose();

export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;

export class PresageBusyError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("presage-api has another active analysis session.");
    this.name = "PresageBusyError";
  }
}

/** A small, display-ready summary — not the full raw event stream. */
export function summarizeVideoAnalysis(analysis: VideoAnalysis): Record<string, unknown> {
  return {
    analysisId: analysis.analysisId,
    sdkVersion: analysis.sdkVersion,
    eventCounts: analysis.eventCounts,
  };
}
