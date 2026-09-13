"use server";

import { auth } from "@clerk/nextjs/server";
import {
  confirmArtifactUploaded,
  beginAgentDecision,
  createCandidateAnswerTurn,
  createInterviewerTurn,
  createSkipTurn,
  ensureEvidenceLinkedReport,
  getArtifactKeyForOwnedSession,
  getAgentContextForTurn,
  getV2ResumeState,
  getOwnedEvidenceLinkedReport,
  markArtifactRetryableFailure,
  registerArtifactForUpload,
  persistAgentDecision,
  saveClientDraftTranscript,
  transitionOwnedV2Session,
} from "@/lib/interviews/persistence";
import { rephraseInterviewQuestion } from "@/lib/interviews/rephrase";
import { llmTextModel } from "@/lib/llm/provider";
import { AGENT_PROMPT_VERSION, agentInputHash, decideNextTurn } from "@/lib/interviews/agent";
import type { AgentDecision } from "@/lib/interviews/agent-contracts";
import { getUploadedObjectMetadata, artifactClipKey, createPlaybackUrl, createUploadUrl } from "@/lib/storage/r2";
import { requireSessionPrincipal, isHiringSession } from "@/lib/access/session-principal";
import { completeHiringInterview } from "@/lib/hiring/sessions";
import { isBiometricsEnabledForSession, queueBiometricAnalysis } from "@/lib/biometrics/persistence";
import { biometricNoteFor } from "@/lib/biometrics/contracts";
import { getBiometricAnalysesForSession } from "@/lib/biometrics/persistence";
import { runBiometricAnalysesForSession } from "@/lib/biometrics/processor";
import { saveIncrementalFinding } from "@/lib/reports/incremental";

async function requireOwnedV2Session(sessionId: string) {
  const principal = await requireSessionPrincipal(sessionId);
  if (principal.kind === "org_recruiter") throw new Error("Interview session not found.");
  const state = await getV2ResumeState(sessionId, principal.clerkUserId);
  if (!state) throw new Error("Interview session not found.");
  return { userId: principal.clerkUserId, state, principal };
}

export async function getPersistedInterviewState(sessionId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  try {
    const principal = await requireSessionPrincipal(sessionId);
    if (principal.kind === "org_recruiter") return null;
    if (principal.clerkUserId !== userId) return null;
    return getV2ResumeState(sessionId, userId);
  } catch {
    return null;
  }
}

export async function beginOrResumePersistedInterview(sessionId: string) {
  const { userId, state } = await requireOwnedV2Session(sessionId);
  if (state.session.status === "in_progress") return true;
  if (state.session.status !== "planned" && state.session.status !== "paused") return false;
  return transitionOwnedV2Session({
    sessionId,
    clerkUserId: userId,
    from: state.session.status,
    to: "in_progress",
  });
}

export async function pausePersistedInterview(sessionId: string) {
  const { userId, state } = await requireOwnedV2Session(sessionId);
  if (state.session.status === "paused") return true;
  if (state.session.status !== "in_progress") return false;
  return transitionOwnedV2Session({ sessionId, clerkUserId: userId, from: "in_progress", to: "paused" });
}

export async function completePersistedInterview(sessionId: string) {
  const { userId, state } = await requireOwnedV2Session(sessionId);
  const finish = async () => {
    await ensureEvidenceLinkedReport(sessionId, userId).catch(() => {});
    // Best-effort full AI review so the report page already has verdicts.
    // Never blocks completion: failures fall back to the instant heuristic.
    const { getReportTranscript } = await import("@/lib/reports/persistence");
    const { beginReportGeneration, completeReportGeneration } = await import("@/lib/reports/persistence");
    const { createFallbackReport, generateReport, REPORT_PROMPT_VERSION, reportInputHash, reportModel } =
      await import("@/lib/reports/generator");
    const { biometricContextForPrompt } = await import("@/lib/biometrics/contracts");
    try {
      const turns = await getReportTranscript(sessionId);
      if (turns.some((t) => t.kind === "candidate_answer" && t.text?.trim())) {
        let biometricContext: string | null = null;
        try {
          const bios = await getBiometricAnalysesForSession(sessionId, userId);
          biometricContext = biometricContextForPrompt(
            bios.map((a) => ({ turnId: a.turnId, metrics: a.metrics, status: a.status })),
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
        try {
          const generated = await generateReport(turns, biometricContext);
          await completeReportGeneration({
            sessionId,
            generationId,
            findings: generated.findings,
            result: generated.result,
            usage: generated.usage,
            model: generated.model,
          });
        } catch (error) {
          console.error("Auto report generation failed; storing heuristic fallback", error);
          const fallback = createFallbackReport(turns);
          await completeReportGeneration({
            sessionId,
            generationId,
            findings: fallback.findings,
            result: fallback.result,
            model: fallback.model,
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Auto report setup failed", error);
    }
  };
  if (state.session.status === "completed") {
    await finish();
    return true;
  }
  if (state.session.status !== "in_progress" && state.session.status !== "paused") return false;
  // A paused-but-fully-answered session is finished: completing straight
  // from paused (clock already stopped) closes the "Resume forever" loop
  // with no extra join/resume round-trip.
  const from = state.session.status as "in_progress" | "paused";
  const completed = await transitionOwnedV2Session({ sessionId, clerkUserId: userId, from, to: "completed" });
  // Report work is recoverable and must never make a completed recording look
  // unfinished. Hiring sessions run their own completion; practice sessions get
  // the evidence report plus the best-effort full review.
  if (completed) {
    if (await isHiringSession(sessionId)) {
      await completeHiringInterview(sessionId, userId).catch(() => {});
    } else {
      await finish();
    }
  }
  return completed;
}

export async function getPersistedInterviewReport(sessionId: string) {
  const { userId } = await requireOwnedV2Session(sessionId);
  try {
    return await getOwnedEvidenceLinkedReport(sessionId, userId);
  } catch {
    return ensureEvidenceLinkedReport(sessionId, userId);
  }
}

export async function getPersistedArtifactPlaybackUrl(sessionId: string, artifactId: string) {
  const { userId } = await requireOwnedV2Session(sessionId);
  const key = await getArtifactKeyForOwnedSession({ artifactId, sessionId, clerkUserId: userId });
  if (!key) throw new Error("Recording is unavailable.");
  return createPlaybackUrl(key);
}

export async function skipPersistedInterviewQuestion(sessionId: string, planQuestionId: string) {
  await requireOwnedV2Session(sessionId);
  await createSkipTurn({ sessionId, planQuestionId });
}

export async function rephrasePersistedInterviewQuestion(sessionId: string, planQuestionId: string) {
  const { state } = await requireOwnedV2Session(sessionId);
  if (state.session.status !== "in_progress") throw new Error("Resume the interview before requesting a rephrase.");
  const question = state.questions.find((item) => item.id === planQuestionId);
  if (!question) throw new Error("Interview question not found.");
  const wording = await rephraseInterviewQuestion(question.prompt);
  await createInterviewerTurn({ sessionId, planQuestionId, kind: "rephrase", text: wording });
  return wording;
}

export async function decidePersistedInterviewNextTurn(params: {
  sessionId: string;
  turnId: string;
  planQuestionId: string;
  transcript: string;
  cameraObservations?: string | null;
}): Promise<AgentDecision> {
  const { principal } = await requireOwnedV2Session(params.sessionId);
  if (principal.kind === "assigned_candidate") {
    // Hiring flow has no agent follow-ups, but the answer is still real:
    // persist the answered flag so list counts stay correct.
    const { orm } = await import("@/lib/db");
    const { interviewPlanQuestions } = await import("@/lib/db/schema");
    const { and, eq, inArray, isNull } = await import("drizzle-orm");
    await orm
      .update(interviewPlanQuestions)
      .set({ status: "answered" })
      .where(
        and(
          eq(interviewPlanQuestions.id, params.planQuestionId),
          eq(interviewPlanQuestions.sessionId, params.sessionId),
          inArray(interviewPlanQuestions.status, ["pending", "active"]),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      );
    return { action: "move_to_next_question", rationale: "coverage_complete" };
  }
  const baseContext = await getAgentContextForTurn(params);
  const { sanitizeVisualNote } = await import("@/lib/biometrics/live-context");
  const context = {
    ...baseContext,
    transcript: params.transcript.slice(0, 12_000),
    cameraObservations: sanitizeVisualNote(params.cameraObservations),
  };
  const inputHash = agentInputHash(context);
  const generationId = await beginAgentDecision({
    context,
    model: llmTextModel("agent"),
    promptVersion: AGENT_PROMPT_VERSION,
    inputHash,
  });
  const startedAt = Date.now();
  const outcome = await decideNextTurn(context);
  await persistAgentDecision({
    generationId,
    context,
    decision: outcome.decision,
    model: outcome.model,
    usage: outcome.usage,
    latencyMs: Date.now() - startedAt,
  });
  return outcome.decision;
}

export async function preparePersistedAnswerUpload(params: {
  sessionId: string;
  planQuestionId: string;
  artifactId: string;
  mimeType: string;
  transcript: string;
}) {
  const { state } = await requireOwnedV2Session(params.sessionId);
  if (state.session.status !== "in_progress") throw new Error("Resume the interview before submitting an answer.");
  const turnId = await createCandidateAnswerTurn({
    sessionId: params.sessionId,
    planQuestionId: params.planQuestionId,
    text: params.transcript || undefined,
  });
  const key = artifactClipKey(params.sessionId, params.artifactId, params.mimeType);
  try {
    await registerArtifactForUpload({
      artifactId: params.artifactId,
      sessionId: params.sessionId,
      turnId,
      r2Key: key,
      mimeType: params.mimeType,
    });
    const url = await createUploadUrl(key, params.mimeType);
    return { key, turnId, url };
  } catch (error) {
    await markArtifactRetryableFailure(params.artifactId, params.sessionId).catch(() => {});
    throw error;
  }
}

export async function confirmPersistedAnswerUpload(params: {
  sessionId: string;
  artifactId: string;
  turnId: string;
  durationMs: number;
  transcript: string;
}) {
  const { userId } = await requireOwnedV2Session(params.sessionId);
  const key = await getArtifactKeyForOwnedSession({
    artifactId: params.artifactId,
    sessionId: params.sessionId,
    clerkUserId: userId,
  });
  if (!key) throw new Error("Recording artifact not found.");
  const metadata = await getUploadedObjectMetadata(key);
  await confirmArtifactUploaded({
    artifactId: params.artifactId,
    sessionId: params.sessionId,
    byteSize: metadata.byteSize,
    checksumSha256: metadata.checksumSha256,
    durationMs: params.durationMs,
  });
  if (params.transcript.trim()) {
    await saveClientDraftTranscript({
      artifactId: params.artifactId,
      turnId: params.turnId,
      text: params.transcript.trim(),
    });
  }
  // Instant per-answer analysis: heuristic verdict stored immediately so the
  // review page shows accuracy while the full AI pass is still pending.
  try {
    let biometricNote: string | null = null;
    try {
      const bios = await getBiometricAnalysesForSession(params.sessionId, userId);
      const match = bios.find((b) => b.artifactId === params.artifactId);
      if (match) biometricNote = biometricNoteFor(match.metrics);
    } catch {
      biometricNote = null;
    }
    await saveIncrementalFinding({
      sessionId: params.sessionId,
      turn: {
        turnId: params.turnId,
        planQuestionId: null,
        kind: "candidate_answer",
        position: null,
        prompt: null,
        text: params.transcript.trim() || null,
        startMs: null,
        endMs: null,
      },
      biometricNote,
    });
  } catch (error) {
    console.error("Incremental answer analysis failed", error);
  }
  if (await isBiometricsEnabledForSession(params.sessionId)) {
    await queueBiometricAnalysis({ sessionId: params.sessionId, artifactId: params.artifactId });
    // Best-effort: the report page can also trigger/retry this. A failure here must never
    // fail the upload confirmation the candidate is waiting on.
    runBiometricAnalysesForSession(params.sessionId).catch((error) => {
      console.error("Biometric analysis relay failed", error);
    });
  }
}

export async function failPersistedAnswerUpload(sessionId: string, artifactId: string) {
  await requireOwnedV2Session(sessionId);
  await markArtifactRetryableFailure(artifactId, sessionId);
}
