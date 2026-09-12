import "server-only";
import { and, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { orm } from "./db";
import { interviewSessions, type InterviewSession as InterviewSessionRow } from "./db/schema";
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
  reportStatus: "processing" | "completed" | "retryable_failed" | "terminal_failed" | null;
}

type SessionSelectRow = Pick<
  InterviewSessionRow,
  | "id"
  | "clerkUserId"
  | "mode"
  | "createdAt"
  | "completedAt"
  | "mood"
  | "customPrompt"
  | "voiceId"
  | "activeConfigRevision"
> & {
  status: SessionStatus;
  questionCount: number;
  reportStatus: SessionRecord["reportStatus"];
};

function toRecord(row: SessionSelectRow): SessionRecord {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    isDurable: row.activeConfigRevision !== null,
    reportStatus: row.reportStatus,
    questionCount: row.questionCount,
    mood: row.mood,
    customPrompt: row.customPrompt,
    voiceId: row.voiceId,
  };
}

// Derived columns mirroring the former SESSION_COLUMNS raw SQL: the question
// count prefers the live plan over the session default, and the report status
// is the latest non-deleted evaluation report. Kept as SQL fragments because
// they are correlated subqueries over other tables.
function sessionSelection() {
  return {
    id: interviewSessions.id,
    clerkUserId: interviewSessions.clerkUserId,
    mode: interviewSessions.mode,
    // The status column can hold 'deleted' in the database even though the
    // application type excludes it; every read filters deleted rows out, so
    // the cast below never observes that value.
    status: sql<SessionStatus>`${interviewSessions.status}`.as("status"),
    createdAt: interviewSessions.createdAt,
    completedAt: interviewSessions.completedAt,
    activeConfigRevision: interviewSessions.activeConfigRevision,
    mood: interviewSessions.mood,
    customPrompt: interviewSessions.customPrompt,
    voiceId: interviewSessions.voiceId,
    questionCount:
      sql<number>`coalesce(nullif((select count(*)::int from interview_plan_questions where session_id = ${interviewSessions.id} and deleted_at is null and superseded_at is null), 0), ${interviewSessions.questionCount})`,
    reportStatus:
      sql<SessionRecord["reportStatus"]>`(select status from evaluation_reports where session_id = ${interviewSessions.id} and deleted_at is null order by version desc limit 1)`,
  };
}

function liveSessionFilter() {
  return and(
    isNull(interviewSessions.deletedAt),
    ne(interviewSessions.status, "deleted"),
  );
}

/** Called once a candidate actually joins (camera granted) — not on page load, so bouncing off the lobby never leaves a ghost row. */
export async function createSession(
  id: string,
  clerkUserId: string,
  mode: InterviewMode,
  config: SessionConfig,
) {
  await orm
    .insert(interviewSessions)
    .values({
      id,
      clerkUserId,
      mode,
      questionCount: config.questionCount,
      mood: config.mood,
      customPrompt: config.customPrompt,
      voiceId: config.voiceId,
    })
    .onConflictDoNothing({ target: interviewSessions.id });
}

export async function setSessionStatus(
  id: string,
  clerkUserId: string,
  status: Extract<SessionStatus, "completed" | "abandoned">,
) {
  await orm
    .update(interviewSessions)
    .set({
      status,
      // Mirror the old CASE: stamp completion only when completing.
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(interviewSessions.id, id),
        eq(interviewSessions.clerkUserId, clerkUserId),
        eq(interviewSessions.status, "in_progress"),
      ),
    );
}

/** Ownership + full config for actions that act on an existing session id from the client. */
export async function getSessionOwner(
  id: string,
): Promise<(SessionRecord & { clerkUserId: string }) | null> {
  const rows = await orm
    .select(sessionSelection())
    .from(interviewSessions)
    .where(eq(interviewSessions.id, id))
    .limit(1);
  const row = rows[0];
  return row ? { ...toRecord(row), clerkUserId: row.clerkUserId } : null;
}

export async function listRecentSessions(
  clerkUserId: string,
  limit = 5,
): Promise<SessionRecord[]> {
  const rows = await orm
    .select(sessionSelection())
    .from(interviewSessions)
    .where(and(eq(interviewSessions.clerkUserId, clerkUserId), liveSessionFilter()))
    .orderBy(desc(interviewSessions.createdAt))
    .limit(limit);
  return rows.map(toRecord);
}

export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  last7Days: number;
}

export async function getSessionStats(clerkUserId: string): Promise<SessionStats> {
  const rows = await orm
    .select({
      total: count(),
      completed:
        sql<number>`(count(*) filter (where ${interviewSessions.status} = 'completed'))::int`,
      recent:
        sql<number>`(count(*) filter (where ${interviewSessions.createdAt} >= now() - interval '7 days'))::int`,
    })
    .from(interviewSessions)
    .where(and(eq(interviewSessions.clerkUserId, clerkUserId), liveSessionFilter()));
  const row = rows[0];
  return {
    totalSessions: row?.total ?? 0,
    completedSessions: row?.completed ?? 0,
    last7Days: row?.recent ?? 0,
  };
}
