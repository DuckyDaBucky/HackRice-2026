"use server";

import { auth } from "@clerk/nextjs/server";
import {
  confirmArtifactUploaded,
  beginAgentDecision,
  createCandidateAnswerTurn,
  createInterviewerTurn,
  createSkipTurn,
  getArtifactKeyForOwnedSession,
  getAgentContextForTurn,
  getV2ResumeState,
  markArtifactRetryableFailure,
  registerArtifactForUpload,
  persistAgentDecision,
  saveClientDraftTranscript,
  transitionOwnedV2Session,
} from "@/lib/interviews/persistence";
import { rephraseInterviewQuestion } from "@/lib/interviews/rephrase";
import { AGENT_PROMPT_VERSION, agentInputHash, decideNextTurn } from "@/lib/interviews/agent";
import type { AgentDecision } from "@/lib/interviews/agent-contracts";
import { getUploadedObjectMetadata, artifactClipKey, createUploadUrl } from "@/lib/storage/r2";

async function requireOwnedV2Session(sessionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to access this interview.");
  const state = await getV2ResumeState(sessionId, userId);
  if (!state) throw new Error("Interview session not found.");
  return { userId, state };
}

export async function getPersistedInterviewState(sessionId: string) {
  const { userId } = await auth();
  if (!userId) return null;
  return getV2ResumeState(sessionId, userId);
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
  if (state.session.status === "completed") return true;
  if (state.session.status !== "in_progress") return false;
  return transitionOwnedV2Session({ sessionId, clerkUserId: userId, from: "in_progress", to: "completed" });
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
}): Promise<AgentDecision> {
  await requireOwnedV2Session(params.sessionId);
  const baseContext = await getAgentContextForTurn(params);
  const context = { ...baseContext, transcript: params.transcript.slice(0, 12_000) };
  const inputHash = agentInputHash(context);
  const generationId = await beginAgentDecision({
    context,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
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
}

export async function failPersistedAnswerUpload(sessionId: string, artifactId: string) {
  await requireOwnedV2Session(sessionId);
  await markArtifactRetryableFailure(artifactId, sessionId);
}
