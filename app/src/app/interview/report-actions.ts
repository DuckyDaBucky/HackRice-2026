"use server";

import { auth } from "@clerk/nextjs/server";
import { createFallbackReport, generateReport, REPORT_PROMPT_VERSION, reportInputHash } from "@/lib/reports/generator";
import {
  beginReportGeneration,
  completeReportGeneration,
  failReportGeneration,
  getLatestReport,
  getReportTranscript,
  isOwnedCompletedSession,
} from "@/lib/reports/persistence";
import { buildSessionTimeline } from "@/lib/reports/timeline";

/** Returns the latest report for an owned session, or null if none has been requested yet. */
export async function getSessionReport(sessionId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  return getLatestReport(sessionId, userId);
}

/** Returns the ordered turn-by-turn timeline (findings + derived mistakes) for an owned session. */
export async function getSessionTimelineForReport(sessionId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const report = await getLatestReport(sessionId, userId);
  return buildSessionTimeline({ sessionId, clerkUserId: userId, findings: report?.findings ?? [] });
}

/**
 * Queues a new report generation for a completed, owned session. Idempotent per call: always
 * creates one new generation/finding set, and the UI reads the latest by generated_at.
 */
export async function generateSessionReport(sessionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to view your report.");
  const eligible = await isOwnedCompletedSession(sessionId, userId);
  if (!eligible) throw new Error("A report is only available once this interview is completed.");

  const turns = await getReportTranscript(sessionId);
  const inputHash = reportInputHash(turns);
  const generationId = await beginReportGeneration({
    sessionId,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    promptVersion: REPORT_PROMPT_VERSION,
    inputHash,
  });

  const startedAt = Date.now();
  try {
    const generated = await generateReport(turns);
    await completeReportGeneration({
      sessionId,
      generationId,
      findings: generated.findings,
      result: generated.result,
      usage: generated.usage,
      latencyMs: Date.now() - startedAt,
      model: generated.model,
    });
  } catch (error) {
    const fallback = createFallbackReport(turns);
    try {
      await completeReportGeneration({
        sessionId,
        generationId,
        findings: fallback.findings,
        result: fallback.result,
        latencyMs: Date.now() - startedAt,
        model: fallback.model,
      });
    } catch {
      await failReportGeneration({
        sessionId,
        generationId,
        errorCode: error instanceof Error ? error.message.slice(0, 200) : "report_generation_failed",
      });
    }
  }

  return getLatestReport(sessionId, userId);
}
