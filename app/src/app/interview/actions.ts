"use server";

import { auth } from "@clerk/nextjs/server";
import { createSession, getSessionOwner, setSessionStatus, type SessionConfig } from "@/lib/sessions";
import { recordAttemptFailed, recordAttemptUploaded, listUploadedQuestionIds } from "@/lib/answer-attempts";
import { answerClipKey, createUploadUrl } from "@/lib/storage/r2";
import type { InterviewMode } from "@/lib/questions/types";

/** Best-effort session tracking for the practice dashboard — never blocks the interview flow on a DB error. Called once the candidate actually joins (camera granted), not on page load. */
export async function startInterviewSession(id: string, mode: InterviewMode, config: SessionConfig) {
  const { userId } = await auth();
  if (!userId) return;
  await createSession(id, userId, mode, config);
}

export async function completeInterviewSession(id: string) {
  const { userId } = await auth();
  if (!userId) return;
  await setSessionStatus(id, userId, "completed");
}

export async function abandonInterviewSession(id: string) {
  const { userId } = await auth();
  if (!userId) return;
  await setSessionStatus(id, userId, "abandoned");
}

/** Full resume state for a session the caller owns — uploaded question ids plus the config it was created with. */
export async function getResumeState(
  sessionId: string,
): Promise<{ uploadedQuestionIds: string[]; mode: InterviewMode; config: SessionConfig } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const owner = await getSessionOwner(sessionId);
  if (!owner || owner.clerkUserId !== userId) return null;
  const uploadedQuestionIds = await listUploadedQuestionIds(sessionId);
  return {
    uploadedQuestionIds,
    mode: owner.mode,
    config: {
      questionCount: owner.questionCount,
      mood: owner.mood,
      customPrompt: owner.customPrompt,
      voiceId: owner.voiceId,
    },
  };
}

async function verifySessionOwner(sessionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to record an answer.");
  const owner = await getSessionOwner(sessionId);
  if (!owner || owner.clerkUserId !== userId) throw new Error("Session not found.");
  return { userId, mode: owner.mode };
}

export async function getAnswerUploadUrl(
  sessionId: string,
  questionId: string,
  mimeType: string,
): Promise<{ url: string; key: string; mode: InterviewMode }> {
  const { mode } = await verifySessionOwner(sessionId);
  const key = answerClipKey(sessionId, questionId, mimeType);
  const url = await createUploadUrl(key, mimeType);
  return { url, key, mode };
}

export async function confirmAnswerUploaded(params: {
  sessionId: string;
  questionId: string;
  mode: InterviewMode;
  mediaRef: string;
  mimeType: string;
  durationMs: number;
}) {
  await verifySessionOwner(params.sessionId);
  await recordAttemptUploaded(params);
}

export async function confirmAnswerFailed(sessionId: string, questionId: string) {
  const { mode } = await verifySessionOwner(sessionId);
  await recordAttemptFailed({ sessionId, questionId, mode });
}
