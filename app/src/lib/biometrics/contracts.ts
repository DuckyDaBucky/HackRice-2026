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
  const counts = analysis.eventCounts ?? {};
  const metricReadouts =
    (counts["metrics"] ?? 0) + (counts["accumulated_metrics"] ?? 0);
  const biometricEvents = Object.entries(counts)
    .filter(([type]) => type !== "processing_status" && type !== "validation_status" && type !== "frame_sent_through")
    .reduce((sum, [, n]) => sum + n, 0);
  return {
    analysisId: analysis.analysisId,
    sdkVersion: analysis.sdkVersion,
    eventCounts: analysis.eventCounts,
    metricReadouts,
    biometricEvents,
  };
}

/** One-line human note per analysis, used for per-answer incremental feedback. */
export function biometricNoteFor(metrics: Record<string, unknown>): string | null {
  const counts = (metrics.eventCounts ?? {}) as Record<string, number>;
  if (!counts || Object.keys(counts).length === 0) return null;
  const readouts = (metrics.metricReadouts as number | undefined) ?? 0;
  const total = (metrics.biometricEvents as number | undefined) ?? 0;
  if (readouts === 0 && total === 0) return null;
  return `${total} biometric events · ${readouts} metric readouts (SDK ${String(metrics.sdkVersion ?? "")})`;
}

/** Compact context block for the evaluator prompt, linking clips to turns. */
export function biometricContextForPrompt(
  rows: Array<{ turnId: string | null; metrics: Record<string, unknown>; status: string }>,
): string | null {
  const lines = rows
    .filter((r) => r.status === "completed")
    .map((r, i) => {
      const note = biometricNoteFor(r.metrics);
      if (!note) return null;
      return `Answer ${i + 1}${r.turnId ? ` (turnId=${r.turnId})` : ""}: ${note}.`;
    })
    .filter(Boolean) as string[];
  if (lines.length === 0) return null;
  return lines.join("\n");
}
