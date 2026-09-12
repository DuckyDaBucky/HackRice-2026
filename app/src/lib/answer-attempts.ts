import "server-only";
import { db } from "./db";
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
  await db.query(
    `INSERT INTO answer_attempts (session_id, question_id, mode, media_ref, mime_type, duration_ms, recorded_at, upload_status)
     VALUES ($1, $2, $3, $4, $5, $6, now(), 'uploaded')
     ON CONFLICT (session_id, question_id) DO UPDATE
       SET media_ref = EXCLUDED.media_ref,
           mime_type = EXCLUDED.mime_type,
           duration_ms = EXCLUDED.duration_ms,
           recorded_at = now(),
           upload_status = 'uploaded'`,
    [sessionId, questionId, mode, mediaRef, mimeType, durationMs],
  );
}

export async function recordAttemptFailed(params: {
  sessionId: string;
  questionId: string;
  mode: InterviewMode;
}) {
  const { sessionId, questionId, mode } = params;
  await db.query(
    `INSERT INTO answer_attempts (session_id, question_id, mode, upload_status)
     VALUES ($1, $2, $3, 'failed')
     ON CONFLICT (session_id, question_id) DO UPDATE SET upload_status = 'failed'`,
    [sessionId, questionId, mode],
  );
}

/** Question ids already successfully uploaded for a session — used to resume past them. */
export async function listUploadedQuestionIds(sessionId: string): Promise<string[]> {
  const result = await db.query<{ question_id: string }>(
    `SELECT question_id FROM answer_attempts WHERE session_id = $1 AND upload_status = 'uploaded'`,
    [sessionId],
  );
  return result.rows.map((row) => row.question_id);
}

/** Answered-question counts per session, for the dashboard's "2 of 3 answered" progress. */
export async function countUploadedAttemptsBySession(
  sessionIds: string[],
): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const result = await db.query<{ session_id: string; count: number }>(
    `SELECT session_id, count(*)::int AS count
     FROM answer_attempts
     WHERE session_id = ANY($1::uuid[]) AND upload_status = 'uploaded'
     GROUP BY session_id`,
    [sessionIds],
  );
  return Object.fromEntries(result.rows.map((row) => [row.session_id, row.count]));
}
