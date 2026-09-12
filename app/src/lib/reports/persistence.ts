import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { TranscriptSegment } from "@/lib/interviews/contracts";
import type { ReportFindingInput, ReportTranscriptTurn } from "./contracts";

/** True only for a session the caller owns and that has finished. */
export async function isOwnedCompletedSession(sessionId: string, clerkUserId: string): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    `SELECT id FROM interview_sessions
     WHERE id = $1 AND clerk_user_id = $2 AND status = 'completed' AND deleted_at IS NULL`,
    [sessionId, clerkUserId],
  );
  return result.rowCount === 1;
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
  artifacts: Array<{ id: string; turnId: string | null; uploadStatus: string; r2Key: string }>;
  transcriptsByTurnId: Map<string, TranscriptSegment[]>;
}

/** Everything the report/timeline page needs beyond the rubric findings themselves. */
export async function getSessionTimelineContext(
  sessionId: string,
  clerkUserId: string,
): Promise<SessionTimelineContext | null> {
  const sessionResult = await db.query<{
    id: string;
    elapsed_active_ms: number;
    time_budget_seconds: number;
  }>(
    `SELECT s.id, s.elapsed_active_ms,
            coalesce(c.time_budget_seconds, 600) AS time_budget_seconds
     FROM interview_sessions s
     LEFT JOIN interview_session_configs c
       ON c.session_id = s.id AND c.revision = s.active_config_revision
     WHERE s.id = $1 AND s.clerk_user_id = $2 AND s.deleted_at IS NULL`,
    [sessionId, clerkUserId],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const planQuestions = await db.query<{ id: string; position: number; prompt: string; status: string }>(
    `SELECT id, position, prompt, status FROM interview_plan_questions
     WHERE session_id = $1 AND deleted_at IS NULL
     ORDER BY position ASC`,
    [sessionId],
  );

  const turns = await db.query<{
    id: string;
    plan_question_id: string | null;
    kind: string;
    sequence: number;
    text: string | null;
  }>(
    `SELECT id, plan_question_id, kind, sequence, text FROM interview_turns
     WHERE session_id = $1 AND deleted_at IS NULL
     ORDER BY sequence ASC`,
    [sessionId],
  );

  const artifacts = await db.query<{
    id: string;
    turn_id: string | null;
    upload_status: string;
    r2_key: string;
  }>(
    `SELECT id, turn_id, upload_status, r2_key FROM media_artifacts
     WHERE session_id = $1 AND deleted_at IS NULL`,
    [sessionId],
  );

  const transcripts = await db.query<{ turn_id: string; segments: TranscriptSegment[] }>(
    `SELECT tr.turn_id, tr.segments
     FROM audio_transcripts tr
     JOIN media_artifacts ma ON ma.id = tr.artifact_id
     WHERE ma.session_id = $1 AND tr.deleted_at IS NULL AND tr.status = 'completed' AND tr.turn_id IS NOT NULL`,
    [sessionId],
  );

  const transcriptsByTurnId = new Map<string, TranscriptSegment[]>();
  for (const row of transcripts.rows) {
    transcriptsByTurnId.set(row.turn_id, row.segments);
  }

  return {
    session: {
      id: session.id,
      elapsedActiveMs: Number(session.elapsed_active_ms),
      timeBudgetSeconds: session.time_budget_seconds,
    },
    planQuestions: planQuestions.rows,
    turns: turns.rows.map((turn) => ({
      id: turn.id,
      planQuestionId: turn.plan_question_id,
      kind: turn.kind,
      sequence: turn.sequence,
      text: turn.text,
    })),
    artifacts: artifacts.rows.map((artifact) => ({
      id: artifact.id,
      turnId: artifact.turn_id,
      uploadStatus: artifact.upload_status,
      r2Key: artifact.r2_key,
    })),
    transcriptsByTurnId,
  };
}

/** Flattens turns, plan questions and completed transcripts into evaluator input, in order. */
export async function getReportTranscript(sessionId: string): Promise<ReportTranscriptTurn[]> {
  const result = await db.query<{
    turn_id: string;
    plan_question_id: string | null;
    kind: string;
    position: number | null;
    prompt: string | null;
    turn_text: string | null;
    transcript_text: string | null;
    start_ms: number | null;
    end_ms: number | null;
  }>(
    `SELECT
       t.id AS turn_id,
       t.plan_question_id,
       t.kind,
       pq.position,
       pq.prompt,
       t.text AS turn_text,
       tr.full_text AS transcript_text,
       (SELECT min((segment->>'startMs')::int) FROM jsonb_array_elements(tr.segments) AS segment) AS start_ms,
       (SELECT max((segment->>'endMs')::int) FROM jsonb_array_elements(tr.segments) AS segment) AS end_ms
     FROM interview_turns t
     LEFT JOIN interview_plan_questions pq ON pq.id = t.plan_question_id
     LEFT JOIN media_artifacts ma ON ma.turn_id = t.id AND ma.deleted_at IS NULL
     LEFT JOIN audio_transcripts tr
       ON tr.artifact_id = ma.id AND tr.deleted_at IS NULL AND tr.status = 'completed'
     WHERE t.session_id = $1 AND t.deleted_at IS NULL
     ORDER BY t.sequence ASC`,
    [sessionId],
  );
  return result.rows.map((row) => ({
    turnId: row.turn_id,
    planQuestionId: row.plan_question_id,
    kind: row.kind,
    position: row.position,
    prompt: row.prompt,
    text: row.transcript_text ?? row.turn_text,
    startMs: row.start_ms,
    endMs: row.end_ms,
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
  await db.query(
    `INSERT INTO ai_generations
       (id, session_id, purpose, status, model, prompt_version, input_hash, input_summary)
     VALUES ($1, $2, 'report', 'pending', $3, $4, $5, '{}'::jsonb)`,
    [generationId, params.sessionId, params.model, params.promptVersion, params.inputHash],
  );
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
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const generation = await client.query<{ status: string }>(
      `SELECT status FROM ai_generations WHERE id = $1 AND session_id = $2 FOR UPDATE`,
      [params.generationId, params.sessionId],
    );
    if (generation.rowCount !== 1) throw new Error("Report generation not found.");
    if (generation.rows[0].status === "completed") {
      await client.query("ROLLBACK");
      return;
    }
    for (const finding of params.findings) {
      await client.query(
        `INSERT INTO report_findings
           (id, session_id, generation_id, competency_id, kind, finding, improvement, evidence_turn_ids, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          randomUUID(),
          params.sessionId,
          params.generationId,
          finding.competencyId,
          finding.kind,
          finding.finding,
          finding.improvement,
          finding.evidenceTurnIds,
          finding.confidence,
        ],
      );
    }
    await client.query(
      `UPDATE ai_generations
       SET status = 'completed', result = $3::jsonb, usage = $4::jsonb, latency_ms = $5,
           model = coalesce($6, model), completed_at = now()
       WHERE id = $1 AND session_id = $2`,
      [
        params.generationId,
        params.sessionId,
        JSON.stringify(params.result),
        JSON.stringify(params.usage ?? {}),
        params.latencyMs ?? null,
        params.model ?? null,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function failReportGeneration(params: { sessionId: string; generationId: string; errorCode: string }) {
  await db.query(
    `UPDATE ai_generations
     SET status = 'failed', error_code = $3, completed_at = now()
     WHERE id = $1 AND session_id = $2 AND status IN ('pending', 'running')`,
    [params.generationId, params.sessionId, params.errorCode],
  );
}

export interface StoredReportFinding {
  id: string;
  competencyId: string;
  kind: string;
  finding: string;
  improvement: string | null;
  evidenceTurnIds: string[];
  confidence: string;
}

export interface StoredReport {
  generationId: string;
  status: string;
  errorCode: string | null;
  generatedAt: string | null;
  findings: StoredReportFinding[];
}

/** Returns the latest report generation (any status) for an owned session, or null if none exists. */
export async function getLatestReport(sessionId: string, clerkUserId: string): Promise<StoredReport | null> {
  const generation = await db.query<{
    id: string;
    status: string;
    error_code: string | null;
    completed_at: Date | null;
  }>(
    `SELECT g.id, g.status, g.error_code, g.completed_at
     FROM ai_generations g
     JOIN interview_sessions s ON s.id = g.session_id
     WHERE g.session_id = $1 AND s.clerk_user_id = $2 AND g.purpose = 'report' AND g.deleted_at IS NULL
     ORDER BY g.created_at DESC
     LIMIT 1`,
    [sessionId, clerkUserId],
  );
  const row = generation.rows[0];
  if (!row) return null;

  const findings = await db.query<{
    id: string;
    competency_id: string;
    kind: string;
    finding: string;
    improvement: string | null;
    evidence_turn_ids: string[];
    confidence: string;
  }>(
    `SELECT id, competency_id, kind, finding, improvement, evidence_turn_ids, confidence
     FROM report_findings
     WHERE generation_id = $1
     ORDER BY created_at ASC`,
    [row.id],
  );

  return {
    generationId: row.id,
    status: row.status,
    errorCode: row.error_code,
    generatedAt: row.completed_at?.toISOString() ?? null,
    findings: findings.rows.map((finding) => ({
      id: finding.id,
      competencyId: finding.competency_id,
      kind: finding.kind,
      finding: finding.finding,
      improvement: finding.improvement,
      evidenceTurnIds: finding.evidence_turn_ids,
      confidence: finding.confidence,
    })),
  };
}
