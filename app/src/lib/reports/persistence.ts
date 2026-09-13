import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  aiGenerations,
  audioTranscripts,
  interviewPlanQuestions,
  interviewSessionConfigs,
  interviewSessions,
  interviewTurns,
  mediaArtifacts,
  reportFindings,
} from "@/lib/db/schema";
import type { TranscriptSegment } from "@/lib/interviews/contracts";
import type { ReportFindingInput, ReportOverview, ReportTranscriptTurn } from "./contracts";

/** True only for a session the caller owns and that has finished. */
export async function isOwnedCompletedSession(sessionId: string, clerkUserId: string): Promise<boolean> {
  const rows = await orm
    .select({ id: interviewSessions.id })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.clerkUserId, clerkUserId),
        eq(interviewSessions.status, "completed"),
        isNull(interviewSessions.deletedAt),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

export interface SessionTimelineContext {
  session: { id: string; elapsedActiveMs: number; timeBudgetSeconds: number };
  planQuestions: Array<{ id: string; position: number; prompt: string; status: string }>;
  turns: Array<{
    id: string;
    planQuestionId: string | null;
    kind: string;
    sequence: number;
    text: string | null;
  }>;
  artifacts: Array<{ id: string; turnId: string | null; uploadStatus: string; r2Key: string; durationMs: number | null }>;
  transcriptsByTurnId: Map<string, TranscriptSegment[]>;
}

/** Everything the report/timeline page needs beyond the rubric findings themselves. */
export async function getSessionTimelineContext(
  sessionId: string,
  clerkUserId: string,
): Promise<SessionTimelineContext | null> {
  const sessionRows = await orm
    .select({
      id: interviewSessions.id,
      elapsedActiveMs: interviewSessions.elapsedActiveMs,
      timeBudgetSeconds: interviewSessionConfigs.timeBudgetSeconds,
    })
    .from(interviewSessions)
    .leftJoin(
      interviewSessionConfigs,
      and(
        eq(interviewSessionConfigs.sessionId, interviewSessions.id),
        eq(interviewSessionConfigs.revision, interviewSessions.activeConfigRevision),
      ),
    )
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.clerkUserId, clerkUserId),
        isNull(interviewSessions.deletedAt),
      ),
    )
    .limit(1);
  const session = sessionRows[0];
  if (!session) return null;

  const planQuestions = await orm
    .select({
      id: interviewPlanQuestions.id,
      position: interviewPlanQuestions.position,
      prompt: interviewPlanQuestions.prompt,
      status: interviewPlanQuestions.status,
    })
    .from(interviewPlanQuestions)
    .where(
      and(
        eq(interviewPlanQuestions.sessionId, sessionId),
        isNull(interviewPlanQuestions.deletedAt),
        isNull(interviewPlanQuestions.supersededAt),
      ),
    )
    .orderBy(asc(interviewPlanQuestions.position));

  const turns = await orm
    .select({
      id: interviewTurns.id,
      planQuestionId: interviewTurns.planQuestionId,
      kind: interviewTurns.kind,
      sequence: interviewTurns.sequence,
      text: interviewTurns.text,
    })
    .from(interviewTurns)
    .where(and(eq(interviewTurns.sessionId, sessionId), isNull(interviewTurns.deletedAt)))
    .orderBy(asc(interviewTurns.sequence));

  const artifacts = await orm
    .select({
      id: mediaArtifacts.id,
      turnId: mediaArtifacts.turnId,
      uploadStatus: mediaArtifacts.uploadStatus,
      r2Key: mediaArtifacts.r2Key,
      durationMs: mediaArtifacts.durationMs,
    })
    .from(mediaArtifacts)
    .where(and(eq(mediaArtifacts.sessionId, sessionId), isNull(mediaArtifacts.deletedAt)))
    .orderBy(asc(mediaArtifacts.createdAt));

  const transcripts = await orm
    .select({ turnId: audioTranscripts.turnId, segments: audioTranscripts.segments })
    .from(audioTranscripts)
    .innerJoin(mediaArtifacts, eq(mediaArtifacts.id, audioTranscripts.artifactId))
    .where(
      and(
        eq(mediaArtifacts.sessionId, sessionId),
        isNull(audioTranscripts.deletedAt),
        eq(audioTranscripts.status, "completed"),
        // Only turn-linked transcripts feed the timeline.
        isNotNull(audioTranscripts.turnId),
      ),
    );

  const transcriptsByTurnId = new Map<string, TranscriptSegment[]>();
  for (const row of transcripts) {
    if (row.turnId) transcriptsByTurnId.set(row.turnId, row.segments);
  }

  return {
    session: {
      id: session.id,
      elapsedActiveMs: Number(session.elapsedActiveMs),
      timeBudgetSeconds: session.timeBudgetSeconds ?? 600,
    },
    planQuestions: planQuestions.map((question) => ({
      id: question.id,
      position: question.position,
      prompt: question.prompt,
      status: question.status,
    })),
    turns: turns.map((turn) => ({
      id: turn.id,
      planQuestionId: turn.planQuestionId,
      kind: turn.kind,
      sequence: turn.sequence,
      text: turn.text,
    })),
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      turnId: artifact.turnId,
      uploadStatus: artifact.uploadStatus,
      r2Key: artifact.r2Key,
      durationMs: artifact.durationMs,
    })),
    transcriptsByTurnId,
  };
}

/** Flattens turns, plan questions and completed transcripts into evaluator input, in order. */
export async function getReportTranscript(sessionId: string): Promise<ReportTranscriptTurn[]> {
  const rows = await orm
    .select({
      turnId: interviewTurns.id,
      planQuestionId: interviewTurns.planQuestionId,
      kind: interviewTurns.kind,
      position: interviewPlanQuestions.position,
      prompt: interviewPlanQuestions.prompt,
      turnText: interviewTurns.text,
      transcriptText: audioTranscripts.fullText,
      startMs: sql<number | null>`(SELECT min((segment->>'startMs')::int) FROM jsonb_array_elements(${audioTranscripts.segments}) AS segment)`,
      endMs: sql<number | null>`(SELECT max((segment->>'endMs')::int) FROM jsonb_array_elements(${audioTranscripts.segments}) AS segment)`,
    })
    .from(interviewTurns)
    .leftJoin(interviewPlanQuestions, eq(interviewPlanQuestions.id, interviewTurns.planQuestionId))
    .leftJoin(
      mediaArtifacts,
      and(eq(mediaArtifacts.turnId, interviewTurns.id), isNull(mediaArtifacts.deletedAt)),
    )
    .leftJoin(
      audioTranscripts,
      and(
        eq(audioTranscripts.artifactId, mediaArtifacts.id),
        isNull(audioTranscripts.deletedAt),
        eq(audioTranscripts.status, "completed"),
      ),
    )
    .where(and(eq(interviewTurns.sessionId, sessionId), isNull(interviewTurns.deletedAt)))
    .orderBy(asc(interviewTurns.sequence));
  return rows.map((row) => ({
    turnId: row.turnId,
    planQuestionId: row.planQuestionId,
    kind: row.kind,
    position: row.position,
    prompt: row.prompt,
    text: row.transcriptText ?? row.turnText,
    startMs: row.startMs,
    endMs: row.endMs,
  }));
}

/** Persists a pending generation before the model call, mirroring beginSessionPlanning. */
export async function beginReportGeneration(params: {
  sessionId: string;
  model: string;
  promptVersion: string;
  inputHash: string;
}): Promise<string> {
  const generationId = randomUUID();
  await orm.insert(aiGenerations).values({
    id: generationId,
    sessionId: params.sessionId,
    purpose: "report",
    status: "pending",
    model: params.model,
    promptVersion: params.promptVersion,
    inputHash: params.inputHash,
    inputSummary: {},
  });
  return generationId;
}

/** Writes findings and marks the generation completed in one transaction. */
export async function completeReportGeneration(params: {
  sessionId: string;
  generationId: string;
  findings: ReportFindingInput[];
  result: Record<string, unknown>;
  usage?: Record<string, unknown>;
  latencyMs?: number;
  model?: string;
}) {
  await orm.transaction(async (tx) => {
    const generations = await tx
      .select({ status: aiGenerations.status })
      .from(aiGenerations)
      .where(and(eq(aiGenerations.id, params.generationId), eq(aiGenerations.sessionId, params.sessionId)))
      .for("update");
    if (generations.length !== 1) throw new Error("Report generation not found.");
    if (generations[0].status === "completed") return;
    for (const finding of params.findings) {
      await tx.insert(reportFindings).values({
        id: randomUUID(),
        sessionId: params.sessionId,
        generationId: params.generationId,
        turnId: finding.turnId,
        verdict: finding.verdict,
        explanation: finding.explanation,
        improvement: finding.improvement,
      });
    }
    await tx
      .update(aiGenerations)
      .set({
        status: "completed",
        result: params.result,
        usage: params.usage ?? {},
        latencyMs: params.latencyMs ?? null,
        model: params.model ?? undefined,
        completedAt: new Date(),
      })
      .where(and(eq(aiGenerations.id, params.generationId), eq(aiGenerations.sessionId, params.sessionId)));
  });
}

export async function failReportGeneration(params: { sessionId: string; generationId: string; errorCode: string }) {
  await orm
    .update(aiGenerations)
    .set({ status: "failed", errorCode: params.errorCode, completedAt: new Date() })
    .where(
      and(
        eq(aiGenerations.id, params.generationId),
        eq(aiGenerations.sessionId, params.sessionId),
        inArray(aiGenerations.status, ["pending", "running"]),
      ),
    );
}

export interface StoredReportFinding {
  id: string;
  turnId: string;
  verdict: string;
  explanation: string;
  improvement: string | null;
}

export interface StoredReport {
  generationId: string;
  status: string;
  errorCode: string | null;
  generatedAt: string | null;
  overview: ReportOverview | null;
  usedFallback: boolean;
  providerError: string | null;
  findings: StoredReportFinding[];
}

/** Returns the latest report generation (any status) for an owned session, or null if none exists. */
export async function getLatestReport(sessionId: string, clerkUserId: string): Promise<StoredReport | null> {
  const generations = await orm
    .select({
      id: aiGenerations.id,
      status: aiGenerations.status,
      errorCode: aiGenerations.errorCode,
      completedAt: aiGenerations.completedAt,
      result: aiGenerations.result,
    })
    .from(aiGenerations)
    .innerJoin(interviewSessions, eq(interviewSessions.id, aiGenerations.sessionId))
    .where(
      and(
        eq(aiGenerations.sessionId, sessionId),
        eq(interviewSessions.clerkUserId, clerkUserId),
        eq(aiGenerations.purpose, "report"),
        isNull(aiGenerations.deletedAt),
      ),
    )
    .orderBy(desc(aiGenerations.createdAt))
    .limit(1);
  const row = generations[0];
  if (!row) return null;

  const findings = await orm
    .select({
      id: reportFindings.id,
      turnId: reportFindings.turnId,
      verdict: reportFindings.verdict,
      explanation: reportFindings.explanation,
      improvement: reportFindings.improvement,
    })
    .from(reportFindings)
    .where(eq(reportFindings.generationId, row.id))
    .orderBy(asc(reportFindings.createdAt));

  const result = row.result as {
    overview?: ReportOverview;
    source?: string;
    providerError?: string;
  } | null;
  return {
    generationId: row.id,
    status: row.status,
    errorCode: row.errorCode,
    generatedAt: row.completedAt?.toISOString() ?? null,
    overview: result?.overview ?? null,
    usedFallback: result?.source === "fallback",
    providerError: result?.providerError ?? null,
    findings: findings.map((finding) => ({
      id: finding.id,
      turnId: finding.turnId,
      verdict: finding.verdict,
      explanation: finding.explanation,
      improvement: finding.improvement,
    })),
  };
}
