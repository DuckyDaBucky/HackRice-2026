"use server";

import { auth } from "@clerk/nextjs/server";
import {
  createFallbackReport,
  generateReport,
  REPORT_PROMPT_VERSION,
  reportInputHash,
  reportModel,
} from "@/lib/reports/generator";
import {
  beginReportGeneration,
  completeReportGeneration,
  failReportGeneration,
  getLatestReport,
  getReportTranscript,
  isOwnedCompletedSession,
} from "@/lib/reports/persistence";
import { buildSessionReview } from "@/lib/reports/timeline";
import { getBiometricAnalysesForSession } from "@/lib/biometrics/persistence";
import { biometricContextForPrompt } from "@/lib/biometrics/contracts";
import { runBiometricAnalysesForSession } from "@/lib/biometrics/processor";
import { getOwnedEvidenceLinkedReport } from "@/lib/interviews/persistence";

/** Everything the report page renders for an owned session; null when it isn't found. */
export async function getReportPageData(sessionId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  const report = await getLatestReport(sessionId, userId);
  const [review, biometrics, evidence] = await Promise.all([
    buildSessionReview({ sessionId, clerkUserId: userId, findings: report?.findings ?? [] }),
    getBiometricAnalysesForSession(sessionId, userId),
    getOwnedEvidenceLinkedReport(sessionId, userId).catch(() => null),
  ]);
  if (!review) return null;
  return { report, review, biometrics, evidence };
}

/** Retries any queued/failed biometric analyses for an owned session. */
export async function retrySessionBiometrics(sessionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to run biometric analysis.");
  const eligible = await isOwnedCompletedSession(sessionId, userId);
  if (!eligible) throw new Error("Biometric analysis is only available once this interview is completed.");
  await runBiometricAnalysesForSession(sessionId);
  return getBiometricAnalysesForSession(sessionId, userId);
}

function providerErrorCode(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/429|quota|resource.exhausted/i.test(message)) return "QUOTA";
  if (/abort|timeout/i.test(message)) return "TIMEOUT";
  if (/zod|syntaxerror/i.test(message)) return "INVALID_RESPONSE";
  return "UNAVAILABLE";
}

/**
 * Generates a new report for a completed, owned session. Each call creates one new
 * generation/finding set, and the page reads the latest.
 */
export async function generateSessionReport(sessionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to view your report.");
  const eligible = await isOwnedCompletedSession(sessionId, userId);
  if (!eligible) throw new Error("A report is only available once this interview is completed.");

  const turns = await getReportTranscript(sessionId);
  // Best-effort: attach biometric delivery notes so verdicts can reference them.
  // Biometrics never decide a verdict — they only add a supporting sentence.
  let biometricContext: string | null = null;
  try {
    const existing = await getBiometricAnalysesForSession(sessionId, userId);
    const turnByArtifact = new Map<string, string>();
    const timeline = await buildSessionReview({ sessionId, clerkUserId: userId, findings: [] }).catch(() => null);
    void turnByArtifact;
    void timeline;
    biometricContext = biometricContextForPrompt(
      existing.map((a) => ({ turnId: a.turnId, metrics: a.metrics, status: a.status })),
    );
  } catch {
    biometricContext = null;
  }
  const generationId = await beginReportGeneration({
    sessionId,
    model: reportModel(),
    promptVersion: REPORT_PROMPT_VERSION,
    inputHash: reportInputHash(turns),
  });

  const startedAt = Date.now();
  try {
    const generated = await generateReport(turns, biometricContext);
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
    console.error("Report generation failed; storing fallback", error);
    const providerError = providerErrorCode(error);
    const fallback = createFallbackReport(turns);
    try {
      await completeReportGeneration({
        sessionId,
        generationId,
        findings: fallback.findings,
        result: { ...fallback.result, providerError },
        latencyMs: Date.now() - startedAt,
        model: fallback.model,
      });
    } catch {
      await failReportGeneration({ sessionId, generationId, errorCode: providerError });
    }
  }

  return getLatestReport(sessionId, userId);
}
