import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { orm } from "./db";
import { answerAttempts } from "./db/schema";
import type { InterviewMode } from "./questions/types";

export async function recordAttemptUploaded(params: {
  sessionId: string;
  questionId: string;
  mode: InterviewMode;
  mediaRef: string;
  mimeType: string;
  durationMs: number;
}) {
  const { sessionId, questionId, mode, mediaRef, mimeType, durationMs } = params;
  const recordedAt = new Date();
  await orm
    .insert(answerAttempts)
    .values({
      sessionId,
      questionId,
      mode,
      mediaRef,
      mimeType,
      durationMs,
      recordedAt,
      uploadStatus: "uploaded",
    })
    .onConflictDoUpdate({
      target: [answerAttempts.sessionId, answerAttempts.questionId],
      set: { mediaRef, mimeType, durationMs, recordedAt, uploadStatus: "uploaded" },
    });
}

export async function recordAttemptFailed(params: {
  sessionId: string;
  questionId: string;
  mode: InterviewMode;
}) {
  const { sessionId, questionId, mode } = params;
  await orm
    .insert(answerAttempts)
    .values({ sessionId, questionId, mode, uploadStatus: "failed" })
    .onConflictDoUpdate({
      target: [answerAttempts.sessionId, answerAttempts.questionId],
      set: { uploadStatus: "failed" },
    });
}

/** Question ids already successfully uploaded for a session — used to resume past them. */
export async function listUploadedQuestionIds(sessionId: string): Promise<string[]> {
  const rows = await orm
    .select({ questionId: answerAttempts.questionId })
    .from(answerAttempts)
    .where(
      and(
        eq(answerAttempts.sessionId, sessionId),
        eq(answerAttempts.uploadStatus, "uploaded"),
      ),
    );
  return rows.map((row) => row.questionId);
}

/** Answered-question counts per session, for the dashboard's "2 of 3 answered" progress. */
export async function countUploadedAttemptsBySession(
  sessionIds: string[],
): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const rows = await orm
    .select({ sessionId: answerAttempts.sessionId, count: count() })
    .from(answerAttempts)
    .where(
      and(
        inArray(answerAttempts.sessionId, sessionIds),
        eq(answerAttempts.uploadStatus, "uploaded"),
      ),
    )
    .groupBy(answerAttempts.sessionId);
  return Object.fromEntries(rows.map((row) => [row.sessionId, row.count]));
}
