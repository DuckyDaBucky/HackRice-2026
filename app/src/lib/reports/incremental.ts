import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { orm } from "@/lib/db";
import { aiGenerations, reportFindings } from "@/lib/db/schema";
import { heuristicFindings, heuristicOverview } from "./heuristic";
import type { ReportFindingInput, ReportTranscriptTurn } from "./contracts";

/**
 * Instant per-answer analysis: runs synchronously (no model call) right after
 * each answer upload so the review page has verdicts before the full
 * provider pass finishes. Findings accumulate on one `report-incremental`
 * generation; the full report later creates its own `report` generation and
 * supersedes it.
 */

const INCREMENTAL_PROMPT_VERSION = "report-incremental-v1";

async function ensureIncrementalGeneration(sessionId: string): Promise<string> {
  const existing = await orm
    .select({ id: aiGenerations.id })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.sessionId, sessionId),
        eq(aiGenerations.purpose, "report"),
        eq(aiGenerations.promptVersion, INCREMENTAL_PROMPT_VERSION),
        eq(aiGenerations.status, "completed"),
        isNull(aiGenerations.deletedAt),
      ),
    )
    .orderBy(desc(aiGenerations.createdAt))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = randomUUID();
  await orm.insert(aiGenerations).values({
    id,
    sessionId,
    purpose: "report",
    status: "completed",
    model: "heuristic-v1",
    promptVersion: INCREMENTAL_PROMPT_VERSION,
    inputHash: randomUUID(),
    inputSummary: {},
    result: {},
  });
  return id;
}

export async function saveIncrementalFinding(params: {
  sessionId: string;
  turn: ReportTranscriptTurn;
  biometricNote?: string | null;
}): Promise<void> {
  if (!params.turn.text?.trim()) return;
  const [finding] = heuristicFindings([params.turn]);
  if (!finding) return;
  const generationId = await ensureIncrementalGeneration(params.sessionId);
  const explanation = params.biometricNote
    ? `${finding.explanation} Biometric note: ${params.biometricNote}`
    : finding.explanation;
  // Replace a previous incremental verdict for the same turn (e.g. re-upload).
  await orm
    .insert(reportFindings)
    .values({
      id: randomUUID(),
      sessionId: params.sessionId,
      generationId,
      turnId: finding.turnId,
      verdict: finding.verdict,
      explanation,
      improvement: finding.improvement,
    })
    .onConflictDoUpdate({
      target: [reportFindings.generationId, reportFindings.turnId],
      set: { verdict: finding.verdict, explanation, improvement: finding.improvement },
    });
  const rows = await orm
    .select({ verdict: reportFindings.verdict })
    .from(reportFindings)
    .where(eq(reportFindings.generationId, generationId));
  const overview = heuristicOverview(
    rows.map(
      (row) =>
        ({ turnId: "", verdict: row.verdict, explanation: "", improvement: null }) as ReportFindingInput,
    ),
  );
  await orm
    .update(aiGenerations)
    .set({ result: { overview, source: "incremental-heuristic" } })
    .where(eq(aiGenerations.id, generationId));
}
