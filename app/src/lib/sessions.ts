import "server-only";
import { db } from "./db";
import type { InterviewMode } from "./questions/types";
import type { InterviewMood } from "./interview-config";

export type SessionStatus = "planned" | "in_progress" | "paused" | "completed" | "abandoned";

export interface SessionConfig {
  questionCount: number;
  mood: InterviewMood;
  customPrompt: string | null;
  voiceId: string | null;
}

export interface SessionRecord extends SessionConfig {
  id: string;
  mode: InterviewMode;
  status: SessionStatus;
  createdAt: string;
  completedAt: string | null;
  isDurable: boolean;
}

interface SessionRow {
  id: string;
  clerk_user_id: string;
  mode: InterviewMode;
  status: SessionStatus;
  created_at: string;
  completed_at: string | null;
  question_count: number;
  mood: InterviewMood;
  custom_prompt: string | null;
  voice_id: string | null;
  active_config_revision: number | null;
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    isDurable: row.active_config_revision !== null,
    questionCount: row.question_count,
    mood: row.mood,
    customPrompt: row.custom_prompt,
    voiceId: row.voice_id,
  };
}

const SESSION_COLUMNS =
  `id, clerk_user_id, mode, status, created_at, completed_at,
   coalesce(nullif((SELECT count(*)::int FROM interview_plan_questions plan
                    WHERE plan.session_id = interview_sessions.id
                      AND plan.deleted_at IS NULL AND plan.superseded_at IS NULL), 0), question_count) AS question_count,
   mood, custom_prompt, voice_id, active_config_revision`;

/** Called once a candidate actually joins (camera granted) — not on page load, so bouncing off the lobby never leaves a ghost row. */
export async function createSession(
  id: string,
  clerkUserId: string,
  mode: InterviewMode,
  config: SessionConfig,
) {
  await db.query(
    `INSERT INTO interview_sessions
       (id, clerk_user_id, mode, question_count, mood, custom_prompt, voice_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [id, clerkUserId, mode, config.questionCount, config.mood, config.customPrompt, config.voiceId],
  );
}

export async function setSessionStatus(
  id: string,
  clerkUserId: string,
  status: Extract<SessionStatus, "completed" | "abandoned">,
) {
  await db.query(
    `UPDATE interview_sessions
     SET status = $3, completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE completed_at END
     WHERE id = $1 AND clerk_user_id = $2 AND status = 'in_progress'`,
    [id, clerkUserId, status],
  );
}

/** Ownership + full config for actions that act on an existing session id from the client. */
export async function getSessionOwner(
  id: string,
): Promise<(SessionRecord & { clerkUserId: string }) | null> {
  const result = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM interview_sessions WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? { ...toRecord(row), clerkUserId: row.clerk_user_id } : null;
}

export async function listRecentSessions(
  clerkUserId: string,
  limit = 5,
): Promise<SessionRecord[]> {
  const result = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS}
     FROM interview_sessions
     WHERE clerk_user_id = $1 AND deleted_at IS NULL AND status <> 'deleted'
     ORDER BY created_at DESC
     LIMIT $2`,
    [clerkUserId, limit],
  );
  return result.rows.map(toRecord);
}

export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  last7Days: number;
}

export async function getSessionStats(clerkUserId: string): Promise<SessionStats> {
  const result = await db.query<{ total: number; completed: number; recent: number }>(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'completed')::int AS completed,
       count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS recent
     FROM interview_sessions
     WHERE clerk_user_id = $1 AND deleted_at IS NULL AND status <> 'deleted'`,
    [clerkUserId],
  );
  const row = result.rows[0];
  return {
    totalSessions: row?.total ?? 0,
    completedSessions: row?.completed ?? 0,
    last7Days: row?.recent ?? 0,
  };
}
