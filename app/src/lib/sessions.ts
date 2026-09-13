import "server-only";
import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { orm } from "./db";
import {
  aiGenerations,
  interviewPlanQuestions,
  interviewSessions,
  reportFindings,
  type InterviewSession as InterviewSessionRow,
} from "./db/schema";
import type { InterviewMode } from "./questions/types";
import type { InterviewMood } from "./interview-config";
import { reportScoreFromVerdicts } from "./reports/scoring";

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
  /** Canonical score from the latest completed chess-style report; null until reviewed. */
  score: number | null;
  /** Active planned questions with a submitted candidate answer. */
  answeredCount: number;
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
  answeredCount: number;
};

function toRecord(row: SessionSelectRow, score: number | null = null): SessionRecord {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    isDurable: row.activeConfigRevision !== null,
    reportStatus: row.reportStatus,
    score,
    answeredCount: row.answeredCount,
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
    answeredCount:
      sql<number>`coalesce((select count(*)::int from interview_plan_questions where session_id = ${interviewSessions.id} and status = 'answered' and deleted_at is null and superseded_at is null), 0)`,
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
  if (rows.length === 0) return [];

  const sessionIds = rows.map((row) => row.id);
  // Pick the latest report attempt for each session. If that attempt is still
  // pending/failed, expose no score rather than silently showing a stale one.
  const latestGenerations = await orm
    .selectDistinctOn([aiGenerations.sessionId], {
      id: aiGenerations.id,
      sessionId: aiGenerations.sessionId,
      status: aiGenerations.status,
    })
    .from(aiGenerations)
    .where(
      and(
        inArray(aiGenerations.sessionId, sessionIds),
        eq(aiGenerations.purpose, "report"),
        isNull(aiGenerations.deletedAt),
      ),
    )
    .orderBy(aiGenerations.sessionId, desc(aiGenerations.createdAt));

  const completedGenerations = latestGenerations.filter((generation) => generation.status === "completed");
  const generationIds = completedGenerations.map((generation) => generation.id);
  const [findingRows, skippedRows] = await Promise.all([
    generationIds.length > 0
      ? orm
          .select({ generationId: reportFindings.generationId, verdict: reportFindings.verdict })
          .from(reportFindings)
          .where(inArray(reportFindings.generationId, generationIds))
      : Promise.resolve([]),
    orm
      .select({ sessionId: interviewPlanQuestions.sessionId, count: count() })
      .from(interviewPlanQuestions)
      .where(
        and(
          inArray(interviewPlanQuestions.sessionId, sessionIds),
          eq(interviewPlanQuestions.status, "skipped"),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      )
      .groupBy(interviewPlanQuestions.sessionId),
  ]);

  const verdictsByGeneration = new Map<string, string[]>();
  for (const finding of findingRows) {
    const verdicts = verdictsByGeneration.get(finding.generationId) ?? [];
    verdicts.push(finding.verdict);
    verdictsByGeneration.set(finding.generationId, verdicts);
  }
  const skippedBySession = new Map(skippedRows.map((row) => [row.sessionId, row.count]));
  const generationBySession = new Map(completedGenerations.map((generation) => [generation.sessionId, generation.id]));
  const scoreBySession = new Map<string, number | null>();
  for (const sessionId of sessionIds) {
    const generationId = generationBySession.get(sessionId);
    if (!generationId) continue;
    scoreBySession.set(
      sessionId,
      reportScoreFromVerdicts(verdictsByGeneration.get(generationId) ?? [], skippedBySession.get(sessionId) ?? 0),
    );
  }

  return rows.map((row) => toRecord(row, scoreBySession.get(row.id) ?? null));
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
