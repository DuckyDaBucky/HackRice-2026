import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import type { InterviewContentType, InterviewSetup, TranscriptSegment } from "./contracts";
import type { AgentContext, AgentDecision } from "./agent-contracts";

export interface PlannedQuestionInput {
  id?: string;
  position: number;
  contentType: InterviewContentType;
  prompt: string;
  intent?: Record<string, unknown>;
  maxFollowUps?: 0 | 1;
}

export interface BeginPlanningInput {
  sessionId?: string;
  clerkUserId: string;
  setup: InterviewSetup;
  model: string;
  promptVersion: string;
  inputHash: string;
  inputSummary?: Record<string, unknown>;
}

export interface PlannedSessionDraft {
  sessionId: string;
  generationId: string;
  configRevision: number;
}

function legacyModeFor(contentTypes: InterviewContentType[]): "technical" | "behavioral" {
  return contentTypes.length === 1 && contentTypes[0] === "behavioral" ? "behavioral" : "technical";
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Persists the session and a pending generation before calling a model. A
 * refresh or model failure therefore leaves an inspectable/retryable draft.
 */
export async function beginSessionPlanning(input: BeginPlanningInput): Promise<PlannedSessionDraft> {
  const sessionId = input.sessionId ?? randomUUID();
  const generationId = randomUUID();
  const legacyMode = legacyModeFor(input.setup.contentTypes);

  return transaction(async (client) => {
    await client.query(
      `INSERT INTO interview_sessions
         (id, clerk_user_id, mode, status, mood, custom_prompt, voice_id, active_config_revision)
       VALUES ($1, $2, $3, 'planned', $4, $5, $6, 1)`,
      [
        sessionId,
        input.clerkUserId,
        legacyMode,
        input.setup.mood,
        input.setup.focusArea,
        input.setup.voiceId,
      ],
    );
    await client.query(
      `INSERT INTO interview_session_configs
         (session_id, revision, content_types, target_role, seniority, focus_area,
          time_budget_seconds, voice_id, mood)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        input.setup.contentTypes,
        input.setup.targetRole,
        input.setup.seniority,
        input.setup.focusArea,
        input.setup.timeBudgetSeconds,
        input.setup.voiceId,
        input.setup.mood,
      ],
    );
    await client.query(
      `INSERT INTO ai_generations
         (id, session_id, purpose, status, model, prompt_version, input_hash, input_summary)
       VALUES ($1, $2, 'plan', 'pending', $3, $4, $5, $6::jsonb)`,
      [
        generationId,
        sessionId,
        input.model,
        input.promptVersion,
        input.inputHash,
        JSON.stringify(input.inputSummary ?? {}),
      ],
    );
    return { sessionId, generationId, configRevision: 1 };
  });
}

/** Writes the exact generated plan once; it may never be regenerated on resume. */
export async function completeSessionPlan(params: {
  sessionId: string;
  generationId: string;
  questions: PlannedQuestionInput[];
  result: Record<string, unknown>;
  usage?: Record<string, unknown>;
  estimatedCostCents?: number;
  latencyMs?: number;
  model?: string;
}) {
  if (params.questions.length === 0) throw new Error("An interview plan needs at least one question.");
  const positions = new Set(params.questions.map((question) => question.position));
  if (positions.size !== params.questions.length) throw new Error("Interview plan positions must be unique.");

  return transaction(async (client) => {
    const generation = await client.query<{ status: string; session_id: string }>(
      `SELECT status, session_id FROM ai_generations
       WHERE id = $1 AND session_id = $2 FOR UPDATE`,
      [params.generationId, params.sessionId],
    );
    if (generation.rowCount !== 1) throw new Error("Planning generation not found.");
    if (generation.rows[0].status === "completed") return;
    if (generation.rows[0].status !== "pending" && generation.rows[0].status !== "running") {
      throw new Error("Planning generation cannot be completed from its current state.");
    }

    for (const question of params.questions) {
      await client.query(
        `INSERT INTO interview_plan_questions
           (id, session_id, config_revision, position, content_type, prompt, intent, max_follow_ups)
         VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb, $7)`,
        [
          question.id ?? randomUUID(),
          params.sessionId,
          question.position,
          question.contentType,
          question.prompt,
          JSON.stringify(question.intent ?? {}),
          question.maxFollowUps ?? 1,
        ],
      );
    }
    await client.query(
      `UPDATE ai_generations
       SET status = 'completed', result = $3::jsonb, usage = $4::jsonb,
           estimated_cost_cents = $5, latency_ms = $6, model = coalesce($7, model), completed_at = now()
       WHERE id = $1 AND session_id = $2`,
      [
        params.generationId,
        params.sessionId,
        JSON.stringify(params.result),
        JSON.stringify(params.usage ?? {}),
        params.estimatedCostCents ?? null,
        params.latencyMs ?? null,
        params.model ?? null,
      ],
    );
  });
}

export async function failSessionPlanning(params: {
  sessionId: string;
  generationId: string;
  errorCode: string;
}) {
  await db.query(
    `UPDATE ai_generations
     SET status = 'failed', error_code = $3, completed_at = now()
     WHERE id = $1 AND session_id = $2 AND status IN ('pending', 'running')`,
    [params.generationId, params.sessionId, params.errorCode],
  );
}

export interface V2ResumeState {
  session: {
    id: string;
    status: string;
    startedAt: string | null;
    pausedAt: string | null;
    elapsedActiveMs: number;
    activeConfigRevision: number | null;
  };
  config: InterviewSetup & { revision: number };
  questions: Array<{
    id: string;
    position: number;
    contentType: InterviewContentType;
    prompt: string;
    status: string;
  }>;
  activeFollowUp: { planQuestionId: string; wording: string } | null;
}

/** Returns exactly the persisted configuration and plan for an owned v2 session. */
export async function getV2ResumeState(sessionId: string, clerkUserId: string): Promise<V2ResumeState | null> {
  const sessionResult = await db.query<{
    id: string;
    status: string;
    started_at: Date | null;
    paused_at: Date | null;
    elapsed_active_ms: number;
    active_config_revision: number | null;
  }>(
    `SELECT id, status, started_at, paused_at,
            (elapsed_active_ms + CASE
              WHEN status = 'in_progress' AND active_started_at IS NOT NULL
              THEN greatest(0, floor(extract(epoch FROM now() - active_started_at) * 1000))::bigint
              ELSE 0
            END)::bigint AS elapsed_active_ms,
            active_config_revision
     FROM interview_sessions
     WHERE id = $1 AND clerk_user_id = $2 AND deleted_at IS NULL AND status <> 'deleted'`,
    [sessionId, clerkUserId],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;
  const configResult = await db.query<{
    revision: number;
    content_types: InterviewContentType[];
    target_role: string;
    seniority: InterviewSetup["seniority"];
    focus_area: string | null;
    time_budget_seconds: InterviewSetup["timeBudgetSeconds"];
    voice_id: string | null;
    mood: InterviewSetup["mood"];
  }>(
    `SELECT revision, content_types, target_role, seniority, focus_area, time_budget_seconds, voice_id, mood
     FROM interview_session_configs
     WHERE session_id = $1 AND revision = $2`,
    [sessionId, session.active_config_revision ?? 1],
  );
  const config = configResult.rows[0];
  if (!config) return null;
  const questions = await db.query<{
    id: string;
    position: number;
    content_type: InterviewContentType;
    prompt: string;
    status: string;
  }>(
    `SELECT id, position, content_type, prompt, status
     FROM interview_plan_questions
     WHERE session_id = $1 AND deleted_at IS NULL AND superseded_at IS NULL
     ORDER BY position ASC`,
    [sessionId],
  );
  const activeFollowUpResult = await db.query<{ plan_question_id: string; text: string }>(
    `SELECT follow_up.plan_question_id, follow_up.text
     FROM interview_turns AS follow_up
     WHERE follow_up.session_id = $1 AND follow_up.kind = 'follow_up'
       AND follow_up.deleted_at IS NULL AND follow_up.text IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM interview_turns AS later_answer
         WHERE later_answer.session_id = follow_up.session_id
           AND later_answer.plan_question_id = follow_up.plan_question_id
           AND later_answer.kind = 'candidate_answer'
           AND later_answer.sequence > follow_up.sequence
           AND later_answer.deleted_at IS NULL
       )
     ORDER BY follow_up.sequence DESC
     LIMIT 1`,
    [sessionId],
  );
  const activeFollowUp = activeFollowUpResult.rows[0];
  return {
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.started_at?.toISOString() ?? null,
      pausedAt: session.paused_at?.toISOString() ?? null,
      elapsedActiveMs: Number(session.elapsed_active_ms),
      activeConfigRevision: session.active_config_revision,
    },
    config: {
      revision: config.revision,
      contentTypes: config.content_types,
      targetRole: config.target_role,
      seniority: config.seniority,
      focusArea: config.focus_area,
      timeBudgetSeconds: config.time_budget_seconds,
      voiceId: config.voice_id,
      mood: config.mood,
    },
    questions: questions.rows.map((question) => ({
      id: question.id,
      position: question.position,
      contentType: question.content_type,
      prompt: question.prompt,
      status: question.status,
    })),
    activeFollowUp: activeFollowUp
      ? { planQuestionId: activeFollowUp.plan_question_id, wording: activeFollowUp.text }
      : null,
  };
}

export async function transitionOwnedV2Session(params: {
  sessionId: string;
  clerkUserId: string;
  from: "planned" | "in_progress" | "paused";
  to: "in_progress" | "paused" | "completed" | "abandoned";
}) {
  const stopClock = `
    elapsed_active_ms = elapsed_active_ms + CASE
      WHEN active_started_at IS NULL THEN 0
      ELSE greatest(0, floor(extract(epoch FROM now() - active_started_at) * 1000))::bigint
    END,
    active_started_at = null`;
  const timestamps: Record<typeof params.to, string> = {
    in_progress: "started_at = coalesce(started_at, now()), paused_at = null, active_started_at = now()",
    paused: `paused_at = now(), ${stopClock}`,
    completed: `completed_at = now(), paused_at = null, ${stopClock}`,
    abandoned: `paused_at = now(), ${stopClock}`,
  };
  const result = await db.query<{ id: string }>(
    `UPDATE interview_sessions
     SET status = $4, ${timestamps[params.to]}
     WHERE id = $1 AND clerk_user_id = $2 AND status = $3 AND deleted_at IS NULL
     RETURNING id`,
    [params.sessionId, params.clerkUserId, params.from, params.to],
  );
  return result.rowCount === 1;
}

/** A revisit creates another candidate-answer turn linked to the original plan question. */
export async function createCandidateAnswerTurn(params: {
  sessionId: string;
  planQuestionId: string;
  parentTurnId?: string;
  text?: string;
}) {
  return transaction(async (client) => {
    const session = await client.query<{ status: string }>(
      "SELECT status FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [params.sessionId],
    );
    if (session.rowCount !== 1 || !["in_progress", "paused"].includes(session.rows[0].status)) {
      throw new Error("Interview session cannot accept an answer.");
    }
    const question = await client.query<{ id: string }>(
      `SELECT id FROM interview_plan_questions
       WHERE id = $1 AND session_id = $2 AND deleted_at IS NULL AND superseded_at IS NULL`,
      [params.planQuestionId, params.sessionId],
    );
    if (question.rowCount !== 1) throw new Error("Interview question is unavailable.");
    const next = await client.query<{ sequence: number }>(
      "SELECT coalesce(max(sequence), 0)::int + 1 AS sequence FROM interview_turns WHERE session_id = $1",
      [params.sessionId],
    );
    const id = randomUUID();
    await client.query(
      `INSERT INTO interview_turns
         (id, session_id, plan_question_id, parent_turn_id, sequence, kind, text)
       VALUES ($1, $2, $3, $4, $5, 'candidate_answer', $6)`,
      [id, params.sessionId, params.planQuestionId, params.parentTurnId ?? null, next.rows[0]?.sequence ?? 1, params.text ?? null],
    );
    return id;
  });
}

/** A skip is visible in history and must never be reinterpreted as a weak answer. */
export async function createSkipTurn(params: { sessionId: string; planQuestionId: string }) {
  return transaction(async (client) => {
    const session = await client.query<{ status: string }>(
      "SELECT status FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [params.sessionId],
    );
    if (session.rowCount !== 1 || session.rows[0].status !== "in_progress") {
      throw new Error("Interview session cannot skip a question.");
    }
    const question = await client.query<{ id: string }>(
      `UPDATE interview_plan_questions
       SET status = 'skipped'
       WHERE id = $1 AND session_id = $2 AND status IN ('pending', 'active')
         AND deleted_at IS NULL AND superseded_at IS NULL
       RETURNING id`,
      [params.planQuestionId, params.sessionId],
    );
    if (question.rowCount !== 1) throw new Error("Interview question is unavailable.");
    const next = await client.query<{ sequence: number }>(
      "SELECT coalesce(max(sequence), 0)::int + 1 AS sequence FROM interview_turns WHERE session_id = $1",
      [params.sessionId],
    );
    const id = randomUUID();
    await client.query(
      `INSERT INTO interview_turns (id, session_id, plan_question_id, sequence, kind, text)
       VALUES ($1, $2, $3, $4, 'skip', 'Candidate skipped this question.')`,
      [id, params.sessionId, params.planQuestionId, next.rows[0]?.sequence ?? 1],
    );
    return id;
  });
}

/** Stores a bounded interviewer clarification without mutating the planned question. */
export async function createInterviewerTurn(params: {
  sessionId: string;
  planQuestionId: string;
  kind: "follow_up" | "rephrase" | "repeat" | "agent_explanation";
  text: string;
}) {
  return transaction(async (client) => {
    const session = await client.query<{ status: string }>(
      "SELECT status FROM interview_sessions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [params.sessionId],
    );
    if (session.rowCount !== 1 || session.rows[0].status !== "in_progress") {
      throw new Error("Interview session cannot accept an interviewer clarification.");
    }
    const question = await client.query<{ id: string }>(
      `SELECT id FROM interview_plan_questions
       WHERE id = $1 AND session_id = $2 AND deleted_at IS NULL AND superseded_at IS NULL`,
      [params.planQuestionId, params.sessionId],
    );
    if (question.rowCount !== 1) throw new Error("Interview question is unavailable.");
    const next = await client.query<{ sequence: number }>(
      "SELECT coalesce(max(sequence), 0)::int + 1 AS sequence FROM interview_turns WHERE session_id = $1",
      [params.sessionId],
    );
    const id = randomUUID();
    await client.query(
      `INSERT INTO interview_turns (id, session_id, plan_question_id, sequence, kind, text)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, params.sessionId, params.planQuestionId, next.rows[0]?.sequence ?? 1, params.kind, params.text],
    );
    return id;
  });
}

export async function getAgentContextForTurn(params: {
  sessionId: string;
  turnId: string;
  planQuestionId: string;
}): Promise<AgentContext> {
  const result = await db.query<{
    session_id: string;
    turn_id: string;
    status: string;
    prompt: string;
    intent: Record<string, unknown>;
    max_follow_ups: number;
    elapsed_active_ms: number;
    time_budget_seconds: number;
    position: number;
    final_position: number;
    follow_ups_used: number;
  }>(
    `SELECT s.id AS session_id, t.id AS turn_id, s.status, q.prompt, q.intent,
            q.max_follow_ups, c.time_budget_seconds, q.position,
            (SELECT max(position) FROM interview_plan_questions p
             WHERE p.session_id = s.id AND p.deleted_at IS NULL AND p.superseded_at IS NULL) AS final_position,
            (SELECT count(*)::int FROM interview_turns ft
             WHERE ft.session_id = s.id AND ft.plan_question_id = q.id
               AND ft.kind = 'follow_up' AND ft.deleted_at IS NULL) AS follow_ups_used,
            (s.elapsed_active_ms + CASE
              WHEN s.active_started_at IS NULL THEN 0
              ELSE greatest(0, floor(extract(epoch FROM now() - s.active_started_at) * 1000))::bigint
            END)::bigint AS elapsed_active_ms
     FROM interview_sessions s
     JOIN interview_session_configs c ON c.session_id = s.id AND c.revision = s.active_config_revision
     JOIN interview_plan_questions q ON q.id = $3 AND q.session_id = s.id
     JOIN interview_turns t ON t.id = $2 AND t.session_id = s.id AND t.plan_question_id = q.id
     WHERE s.id = $1 AND s.status = 'in_progress' AND s.deleted_at IS NULL
       AND q.deleted_at IS NULL AND q.superseded_at IS NULL`,
    [params.sessionId, params.turnId, params.planQuestionId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Interview turn is unavailable for an agent decision.");
  return {
    sessionId: row.session_id,
    turnId: row.turn_id,
    planQuestionId: params.planQuestionId,
    sessionStatus: "in_progress",
    questionPrompt: row.prompt,
    questionIntent: row.intent,
    transcript: "",
    followUpsUsed: row.follow_ups_used,
    maxFollowUps: row.max_follow_ups,
    elapsedActiveMs: Number(row.elapsed_active_ms),
    timeBudgetSeconds: row.time_budget_seconds,
    isLastQuestion: row.position === row.final_position,
  };
}

/** Persists intent before the provider call so an interrupted call stays auditable. */
export async function beginAgentDecision(params: {
  context: AgentContext;
  model: string;
  promptVersion: string;
  inputHash: string;
}) {
  const generationId = randomUUID();
  await db.query(
    `INSERT INTO ai_generations
       (id, session_id, turn_id, purpose, status, model, prompt_version, input_hash, input_summary)
     VALUES ($1, $2, $3, 'next_turn', 'pending', $4, $5, $6, $7::jsonb)`,
    [
      generationId,
      params.context.sessionId,
      params.context.turnId,
      params.model,
      params.promptVersion,
      params.inputHash,
      JSON.stringify({
        planQuestionId: params.context.planQuestionId,
        followUpsUsed: params.context.followUpsUsed,
        elapsedActiveMs: params.context.elapsedActiveMs,
      }),
    ],
  );
  return generationId;
}

/** Completes the safe model trace and atomically materializes a permitted probe. */
export async function persistAgentDecision(params: {
  generationId: string;
  context: AgentContext;
  decision: AgentDecision;
  model: string;
  usage: Record<string, number>;
  latencyMs: number;
}) {
  return transaction(async (client) => {
    const updated = await client.query(
      `UPDATE ai_generations
       SET status = 'completed', model = $4, result = $5::jsonb, usage = $6::jsonb,
           latency_ms = $7, completed_at = now()
       WHERE id = $1 AND session_id = $2 AND turn_id = $3 AND purpose = 'next_turn'
         AND status IN ('pending', 'running')
       RETURNING id`,
      [
        params.generationId,
        params.context.sessionId,
        params.context.turnId,
        params.model,
        JSON.stringify(params.decision),
        JSON.stringify(params.usage),
        params.latencyMs,
      ],
    );
    if (updated.rowCount !== 1) throw new Error("Agent decision generation is unavailable.");
    if (params.decision.action === "ask_follow_up") {
      const next = await client.query<{ sequence: number }>(
        "SELECT coalesce(max(sequence), 0)::int + 1 AS sequence FROM interview_turns WHERE session_id = $1",
        [params.context.sessionId],
      );
      await client.query(
        `INSERT INTO interview_turns (id, session_id, plan_question_id, parent_turn_id, sequence, kind, text)
         VALUES ($1, $2, $3, $4, $5, 'follow_up', $6)`,
        [
          randomUUID(),
          params.context.sessionId,
          params.context.planQuestionId,
          params.context.turnId,
          next.rows[0]?.sequence ?? 1,
          params.decision.wording,
        ],
      );
    } else {
      await client.query(
        `UPDATE interview_plan_questions
         SET status = 'answered'
         WHERE id = $1 AND session_id = $2 AND status IN ('pending', 'active')`,
        [params.context.planQuestionId, params.context.sessionId],
      );
    }
    return params.generationId;
  });
}

/**
 * Client event ids make retried browser requests safe; the session-row lock
 * allocates monotonically increasing event sequences without races.
 */
export async function appendInterviewEvent(params: {
  id: string;
  sessionId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  return transaction(async (client) => {
    const existing = await client.query<{ sequence: number }>(
      "SELECT sequence FROM interview_events WHERE id = $1 AND session_id = $2",
      [params.id, params.sessionId],
    );
    if (existing.rowCount) return existing.rows[0];

    const locked = await client.query<{ status: string; deleted_at: Date | null }>(
      "SELECT status, deleted_at FROM interview_sessions WHERE id = $1 FOR UPDATE",
      [params.sessionId],
    );
    if (locked.rowCount !== 1 || locked.rows[0].status === "deleted" || locked.rows[0].deleted_at) {
      throw new Error("Interview session is unavailable.");
    }
    const next = await client.query<{ sequence: number }>(
      "SELECT coalesce(max(sequence), 0)::int + 1 AS sequence FROM interview_events WHERE session_id = $1",
      [params.sessionId],
    );
    const sequence = next.rows[0]?.sequence ?? 1;
    await client.query(
      `INSERT INTO interview_events (id, session_id, sequence, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [params.id, params.sessionId, sequence, params.eventType, JSON.stringify(params.payload ?? {})],
    );
    return { sequence };
  });
}

export async function registerArtifactForUpload(params: {
  artifactId: string;
  sessionId: string;
  turnId?: string;
  r2Key: string;
  mimeType: string;
}) {
  const result = await db.query<{ id: string }>(
    `INSERT INTO media_artifacts (id, session_id, turn_id, r2_key, mime_type, upload_status)
     SELECT $1, $2, $3, $4, $5, 'uploading'
     WHERE EXISTS (
       SELECT 1 FROM interview_sessions WHERE id = $2 AND status <> 'deleted' AND deleted_at IS NULL
     )
     ON CONFLICT (id) DO UPDATE
       SET upload_status = CASE
         WHEN media_artifacts.upload_status = 'uploaded' THEN 'uploaded'
         ELSE 'uploading'
       END
     RETURNING id`,
    [params.artifactId, params.sessionId, params.turnId ?? null, params.r2Key, params.mimeType],
  );
  if (result.rowCount !== 1) throw new Error("Interview session is unavailable.");
}

export async function saveClientDraftTranscript(params: {
  artifactId: string;
  turnId?: string;
  text: string;
  segments?: TranscriptSegment[];
}) {
  await db.query(
    `INSERT INTO audio_transcripts (artifact_id, turn_id, provider, status, full_text, segments)
     VALUES ($1, $2, 'browser_speech_recognition', 'completed', $3, $4::jsonb)
     ON CONFLICT (artifact_id, provider) DO UPDATE
       SET turn_id = COALESCE(EXCLUDED.turn_id, audio_transcripts.turn_id),
           full_text = EXCLUDED.full_text,
           segments = EXCLUDED.segments,
           completed_at = now()
     WHERE audio_transcripts.deleted_at IS NULL`,
    [params.artifactId, params.turnId ?? null, params.text, JSON.stringify(params.segments ?? [])],
  );
}

/** Only a server-side object verification may promote an artifact to uploaded. */
export async function confirmArtifactUploaded(params: {
  artifactId: string;
  sessionId: string;
  byteSize: number | null;
  checksumSha256: string | null;
  durationMs: number;
}) {
  const result = await db.query<{ id: string }>(
    `UPDATE media_artifacts AS artifact
     SET upload_status = 'uploaded', byte_size = $3, checksum_sha256 = $4,
         duration_ms = $5, uploaded_at = now()
     FROM interview_sessions AS session
     WHERE artifact.id = $1 AND artifact.session_id = $2
       AND session.id = artifact.session_id
       AND session.status <> 'deleted' AND session.deleted_at IS NULL
       AND artifact.deleted_at IS NULL
       AND artifact.upload_status IN ('uploading', 'retryable_failed')
     RETURNING artifact.id`,
    [params.artifactId, params.sessionId, params.byteSize, params.checksumSha256, params.durationMs],
  );
  if (result.rowCount !== 1) throw new Error("Recording upload cannot be confirmed.");
}

export async function markArtifactRetryableFailure(artifactId: string, sessionId: string) {
  await db.query(
    `UPDATE media_artifacts AS artifact
     SET upload_status = 'retryable_failed'
     FROM interview_sessions AS session
     WHERE artifact.id = $1 AND artifact.session_id = $2
       AND session.id = artifact.session_id
       AND session.status <> 'deleted' AND session.deleted_at IS NULL
       AND artifact.upload_status <> 'uploaded'`,
    [artifactId, sessionId],
  );
}

export async function getArtifactKeyForOwnedSession(params: {
  artifactId: string;
  sessionId: string;
  clerkUserId: string;
}) {
  const result = await db.query<{ r2_key: string }>(
    `SELECT artifact.r2_key
     FROM media_artifacts AS artifact
     JOIN interview_sessions AS session ON session.id = artifact.session_id
     WHERE artifact.id = $1 AND artifact.session_id = $2 AND session.clerk_user_id = $3
       AND artifact.deleted_at IS NULL AND session.deleted_at IS NULL AND session.status <> 'deleted'`,
    [params.artifactId, params.sessionId, params.clerkUserId],
  );
  return result.rows[0]?.r2_key ?? null;
}

/** Soft deletion is irreversible access denial, while preserving retained records in R2/Postgres. */
export async function softDeleteInterviewSession(sessionId: string, clerkUserId: string) {
  return transaction(async (client) => {
    const session = await client.query<{ id: string }>(
      `UPDATE interview_sessions
       SET status = 'deleted', deleted_at = coalesce(deleted_at, now()), deleted_by_user_id = $2
       WHERE id = $1 AND clerk_user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [sessionId, clerkUserId],
    );
    if (session.rowCount !== 1) return false;
    await client.query(
      "UPDATE interview_plan_questions SET deleted_at = now() WHERE session_id = $1 AND deleted_at IS NULL",
      [sessionId],
    );
    await client.query(
      "UPDATE interview_turns SET deleted_at = now() WHERE session_id = $1 AND deleted_at IS NULL",
      [sessionId],
    );
    await client.query(
      "UPDATE media_artifacts SET deleted_at = now() WHERE session_id = $1 AND deleted_at IS NULL",
      [sessionId],
    );
    await client.query(
      `UPDATE audio_transcripts SET deleted_at = now()
       WHERE artifact_id IN (SELECT id FROM media_artifacts WHERE session_id = $1) AND deleted_at IS NULL`,
      [sessionId],
    );
    await client.query(
      "UPDATE ai_generations SET deleted_at = now() WHERE session_id = $1 AND deleted_at IS NULL",
      [sessionId],
    );
    await client.query(
      "UPDATE report_share_links SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL",
      [sessionId],
    );
    return true;
  });
}
