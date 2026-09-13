import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, exists, inArray, isNotNull, isNull, max, ne, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  aiGenerations,
  audioTranscripts,
  evaluationItems,
  evaluationReports,
  interviewEvents,
  interviewPlanQuestions,
  interviewSessionConfigs,
  interviewSessions,
  interviewTurns,
  mediaArtifacts,
  reportShareLinks,
} from "@/lib/db/schema";
import type { InterviewContentType, InterviewSetup, TranscriptSegment } from "./contracts";
import type { AgentContext, AgentDecision } from "./agent-contracts";
import { getPresageNotesForSession } from "@/lib/biometrics/persistence";

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

/** Drizzle transaction executor, shared by helpers that run inside or outside a transaction. */
type TransactionExecutor = Parameters<Parameters<typeof orm.transaction>[0]>[0];

/**
 * Persists the session and a pending generation before calling a model. A
 * refresh or model failure therefore leaves an inspectable/retryable draft.
 */
export async function beginSessionPlanning(input: BeginPlanningInput): Promise<PlannedSessionDraft> {
  const sessionId = input.sessionId ?? randomUUID();
  const generationId = randomUUID();
  const legacyMode = legacyModeFor(input.setup.contentTypes);

  return orm.transaction(async (tx) => {
    await tx.insert(interviewSessions).values({
      id: sessionId,
      clerkUserId: input.clerkUserId,
      mode: legacyMode,
      status: "planned",
      mood: input.setup.mood,
      customPrompt: input.setup.focusArea,
      voiceId: input.setup.voiceId,
      activeConfigRevision: 1,
    });
    await tx.insert(interviewSessionConfigs).values({
      sessionId,
      revision: 1,
      contentTypes: input.setup.contentTypes,
      targetRole: input.setup.targetRole,
      seniority: input.setup.seniority,
      focusArea: input.setup.focusArea,
      timeBudgetSeconds: input.setup.timeBudgetSeconds,
      voiceId: input.setup.voiceId,
      mood: input.setup.mood,
      biometricsEnabled: input.setup.biometricsEnabled,
    });
    await tx.insert(aiGenerations).values({
      id: generationId,
      sessionId,
      purpose: "plan",
      status: "pending",
      model: input.model,
      promptVersion: input.promptVersion,
      inputHash: input.inputHash,
      inputSummary: input.inputSummary ?? {},
    });
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

  return orm.transaction(async (tx) => {
    const generations = await tx
      .select({ status: aiGenerations.status })
      .from(aiGenerations)
      .where(and(eq(aiGenerations.id, params.generationId), eq(aiGenerations.sessionId, params.sessionId)))
      .for("update");
    if (generations.length !== 1) throw new Error("Planning generation not found.");
    if (generations[0].status === "completed") return;
    if (generations[0].status !== "pending" && generations[0].status !== "running") {
      throw new Error("Planning generation cannot be completed from its current state.");
    }

    for (const question of params.questions) {
      await tx.insert(interviewPlanQuestions).values({
        id: question.id ?? randomUUID(),
        sessionId: params.sessionId,
        configRevision: 1,
        position: question.position,
        contentType: question.contentType,
        prompt: question.prompt,
        intent: question.intent ?? {},
        maxFollowUps: question.maxFollowUps ?? 1,
      });
    }
    await tx
      .update(aiGenerations)
      .set({
        status: "completed",
        result: params.result,
        usage: params.usage ?? {},
        estimatedCostCents: params.estimatedCostCents ?? null,
        latencyMs: params.latencyMs ?? null,
        model: params.model ?? undefined,
        completedAt: new Date(),
      })
      .where(and(eq(aiGenerations.id, params.generationId), eq(aiGenerations.sessionId, params.sessionId)));
  });
}

export async function failSessionPlanning(params: {
  sessionId: string;
  generationId: string;
  errorCode: string;
}) {
  await orm
    .update(aiGenerations)
    .set({ status: "failed", errorCode: params.errorCode, completedAt: new Date() })
    .where(
      and(
        eq(aiGenerations.id, params.generationId),
        eq(aiGenerations.sessionId, params.sessionId),
        inArray(aiGenerations.status, ["pending", "running"]),
      ),
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
  const sessionRows = await orm
    .select({
      id: interviewSessions.id,
      status: interviewSessions.status,
      startedAt: interviewSessions.startedAt,
      pausedAt: interviewSessions.pausedAt,
      elapsedActiveMs: sql<string>`(${interviewSessions.elapsedActiveMs} + CASE WHEN ${interviewSessions.status} = 'in_progress' AND ${interviewSessions.activeStartedAt} IS NOT NULL THEN greatest(0, floor(extract(epoch FROM now() - ${interviewSessions.activeStartedAt}) * 1000))::bigint ELSE 0 END)::bigint`,
      activeConfigRevision: interviewSessions.activeConfigRevision,
    })
    .from(interviewSessions)
    .where(
      and(
        eq(interviewSessions.id, sessionId),
        eq(interviewSessions.clerkUserId, clerkUserId),
        isNull(interviewSessions.deletedAt),
        ne(interviewSessions.status, "deleted"),
      ),
    )
    .limit(1);
  const session = sessionRows[0];
  if (!session) return null;
  const configRows = await orm
    .select({
      revision: interviewSessionConfigs.revision,
      contentTypes: interviewSessionConfigs.contentTypes,
      targetRole: interviewSessionConfigs.targetRole,
      seniority: interviewSessionConfigs.seniority,
      focusArea: interviewSessionConfigs.focusArea,
      timeBudgetSeconds: interviewSessionConfigs.timeBudgetSeconds,
      voiceId: interviewSessionConfigs.voiceId,
      mood: interviewSessionConfigs.mood,
      biometricsEnabled: interviewSessionConfigs.biometricsEnabled,
    })
    .from(interviewSessionConfigs)
    .where(
      and(
        eq(interviewSessionConfigs.sessionId, sessionId),
        eq(interviewSessionConfigs.revision, session.activeConfigRevision ?? 1),
      ),
    )
    .limit(1);
  const config = configRows[0];
  if (!config) return null;
  const questionRows = await orm
    .select({
      id: interviewPlanQuestions.id,
      position: interviewPlanQuestions.position,
      contentType: interviewPlanQuestions.contentType,
      prompt: interviewPlanQuestions.prompt,
      status: interviewPlanQuestions.status,
    })
    .from(interviewPlanQuestions)
    .where(
      and(
        eq(interviewPlanQuestions.sessionId, sessionId),
        isNull(interviewPlanQuestions.deletedAt),
        isNull(interviewPlanQuestions.supersededAt),
      ),
    )
    .orderBy(asc(interviewPlanQuestions.position));
  // The unanswered follow-up is the latest follow-up with no later answer on
  // the same question. Resolved in JS over two small indexed reads.
  const followUpRows = await orm
    .select({
      planQuestionId: interviewTurns.planQuestionId,
      sequence: interviewTurns.sequence,
      text: interviewTurns.text,
    })
    .from(interviewTurns)
    .where(
      and(
        eq(interviewTurns.sessionId, sessionId),
        eq(interviewTurns.kind, "follow_up"),
        isNull(interviewTurns.deletedAt),
        isNotNull(interviewTurns.text),
      ),
    )
    .orderBy(desc(interviewTurns.sequence));
  const answerRows = await orm
    .select({ planQuestionId: interviewTurns.planQuestionId, sequence: interviewTurns.sequence })
    .from(interviewTurns)
    .where(
      and(
        eq(interviewTurns.sessionId, sessionId),
        eq(interviewTurns.kind, "candidate_answer"),
        isNull(interviewTurns.deletedAt),
      ),
    );
  const activeFollowUp = followUpRows.find(
    (followUp) =>
      followUp.text &&
      !answerRows.some(
        (answer) => answer.planQuestionId === followUp.planQuestionId && answer.sequence > followUp.sequence,
      ),
  );
  return {
    session: {
      id: session.id,
      status: session.status,
      startedAt: session.startedAt?.toISOString() ?? null,
      pausedAt: session.pausedAt?.toISOString() ?? null,
      elapsedActiveMs: Number(session.elapsedActiveMs),
      activeConfigRevision: session.activeConfigRevision,
    },
    config: {
      revision: config.revision,
      contentTypes: [...config.contentTypes],
      targetRole: config.targetRole,
      seniority: config.seniority,
      focusArea: config.focusArea,
      timeBudgetSeconds: config.timeBudgetSeconds as InterviewSetup["timeBudgetSeconds"],
      voiceId: config.voiceId,
      mood: config.mood,
      biometricsEnabled: config.biometricsEnabled,
    },
    questions: questionRows.map((question) => ({
      id: question.id,
      position: question.position,
      contentType: question.contentType,
      prompt: question.prompt,
      status: question.status,
    })),
    activeFollowUp: activeFollowUp?.text && activeFollowUp.planQuestionId
      ? { planQuestionId: activeFollowUp.planQuestionId, wording: activeFollowUp.text }
      : null,
  };
}

export async function transitionOwnedV2Session(params: {
  sessionId: string;
  clerkUserId: string;
  from: "planned" | "in_progress" | "paused";
  to: "in_progress" | "paused" | "completed" | "abandoned";
}) {
  const stopClockElapsed = sql`${interviewSessions.elapsedActiveMs} + CASE WHEN ${interviewSessions.activeStartedAt} IS NULL THEN 0 ELSE greatest(0, floor(extract(epoch FROM now() - ${interviewSessions.activeStartedAt}) * 1000))::bigint END`;
  const setFor = {
    in_progress: {
      status: params.to,
      startedAt: sql`coalesce(${interviewSessions.startedAt}, now())`,
      pausedAt: null,
      activeStartedAt: new Date(),
    },
    paused: { status: params.to, pausedAt: new Date(), elapsedActiveMs: stopClockElapsed, activeStartedAt: null },
    completed: {
      status: params.to,
      completedAt: new Date(),
      pausedAt: null,
      elapsedActiveMs: stopClockElapsed,
      activeStartedAt: null,
    },
    abandoned: { status: params.to, pausedAt: new Date(), elapsedActiveMs: stopClockElapsed, activeStartedAt: null },
  };
  const updated = await orm
    .update(interviewSessions)
    .set(setFor[params.to])
    .where(
      and(
        eq(interviewSessions.id, params.sessionId),
        eq(interviewSessions.clerkUserId, params.clerkUserId),
        eq(interviewSessions.status, params.from),
        isNull(interviewSessions.deletedAt),
      ),
    )
    .returning({ id: interviewSessions.id });
  return updated.length === 1;
}

/** Next 1-based turn sequence for a session, allocated under the session-row lock. */
async function nextTurnSequence(tx: TransactionExecutor, sessionId: string): Promise<number> {
  const rows = await tx
    .select({ sequence: sql<number>`coalesce(max(${interviewTurns.sequence}), 0) + 1` })
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, sessionId));
  return rows[0]?.sequence ?? 1;
}

/** Next 1-based event sequence for a session, allocated under the session-row lock. */
async function nextEventSequence(tx: TransactionExecutor, sessionId: string): Promise<number> {
  const rows = await tx
    .select({ sequence: sql<number>`coalesce(max(${interviewEvents.sequence}), 0) + 1` })
    .from(interviewEvents)
    .where(eq(interviewEvents.sessionId, sessionId));
  return rows[0]?.sequence ?? 1;
}

/** A revisit creates another candidate-answer turn linked to the original plan question. */
export async function createCandidateAnswerTurn(params: {
  sessionId: string;
  planQuestionId: string;
  parentTurnId?: string;
  text?: string;
}) {
  return orm.transaction(async (tx) => {
    const sessions = await tx
      .select({ status: interviewSessions.status })
      .from(interviewSessions)
      .where(and(eq(interviewSessions.id, params.sessionId), isNull(interviewSessions.deletedAt)))
      .for("update");
    if (sessions.length !== 1 || !["in_progress", "paused"].includes(sessions[0].status)) {
      throw new Error("Interview session cannot accept an answer.");
    }
    const questions = await tx
      .select({ id: interviewPlanQuestions.id })
      .from(interviewPlanQuestions)
      .where(
        and(
          eq(interviewPlanQuestions.id, params.planQuestionId),
          eq(interviewPlanQuestions.sessionId, params.sessionId),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      );
    if (questions.length !== 1) throw new Error("Interview question is unavailable.");
    const id = randomUUID();
    await tx.insert(interviewTurns).values({
      id,
      sessionId: params.sessionId,
      planQuestionId: params.planQuestionId,
      parentTurnId: params.parentTurnId ?? null,
      sequence: await nextTurnSequence(tx, params.sessionId),
      kind: "candidate_answer",
      text: params.text ?? null,
    });
    return id;
  });
}

/** A skip is visible in history and must never be reinterpreted as a weak answer. */
export async function createSkipTurn(params: { sessionId: string; planQuestionId: string }) {
  return orm.transaction(async (tx) => {
    const sessions = await tx
      .select({ status: interviewSessions.status })
      .from(interviewSessions)
      .where(and(eq(interviewSessions.id, params.sessionId), isNull(interviewSessions.deletedAt)))
      .for("update");
    if (sessions.length !== 1 || sessions[0].status !== "in_progress") {
      throw new Error("Interview session cannot skip a question.");
    }
    const updated = await tx
      .update(interviewPlanQuestions)
      .set({ status: "skipped" })
      .where(
        and(
          eq(interviewPlanQuestions.id, params.planQuestionId),
          eq(interviewPlanQuestions.sessionId, params.sessionId),
          inArray(interviewPlanQuestions.status, ["pending", "active"]),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      )
      .returning({ id: interviewPlanQuestions.id });
    if (updated.length !== 1) throw new Error("Interview question is unavailable.");
    const id = randomUUID();
    await tx.insert(interviewTurns).values({
      id,
      sessionId: params.sessionId,
      planQuestionId: params.planQuestionId,
      sequence: await nextTurnSequence(tx, params.sessionId),
      kind: "skip",
      text: "Candidate skipped this question.",
    });
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
  return orm.transaction(async (tx) => {
    const sessions = await tx
      .select({ status: interviewSessions.status })
      .from(interviewSessions)
      .where(and(eq(interviewSessions.id, params.sessionId), isNull(interviewSessions.deletedAt)))
      .for("update");
    if (sessions.length !== 1 || sessions[0].status !== "in_progress") {
      throw new Error("Interview session cannot accept an interviewer clarification.");
    }
    const questions = await tx
      .select({ id: interviewPlanQuestions.id })
      .from(interviewPlanQuestions)
      .where(
        and(
          eq(interviewPlanQuestions.id, params.planQuestionId),
          eq(interviewPlanQuestions.sessionId, params.sessionId),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      );
    if (questions.length !== 1) throw new Error("Interview question is unavailable.");
    const id = randomUUID();
    await tx.insert(interviewTurns).values({
      id,
      sessionId: params.sessionId,
      planQuestionId: params.planQuestionId,
      sequence: await nextTurnSequence(tx, params.sessionId),
      kind: params.kind,
      text: params.text,
    });
    return id;
  });
}

export async function getAgentContextForTurn(params: {
  sessionId: string;
  turnId: string;
  planQuestionId: string;
}): Promise<AgentContext> {
  const rows = await orm
    .select({
      sessionId: interviewSessions.id,
      turnId: interviewTurns.id,
      prompt: interviewPlanQuestions.prompt,
      intent: interviewPlanQuestions.intent,
      maxFollowUps: interviewPlanQuestions.maxFollowUps,
      elapsedActiveMs: interviewSessions.elapsedActiveMs,
      activeStartedAt: interviewSessions.activeStartedAt,
      timeBudgetSeconds: interviewSessionConfigs.timeBudgetSeconds,
      position: interviewPlanQuestions.position,
    })
    .from(interviewSessions)
    .innerJoin(
      interviewSessionConfigs,
      and(
        eq(interviewSessionConfigs.sessionId, interviewSessions.id),
        eq(interviewSessionConfigs.revision, interviewSessions.activeConfigRevision),
      ),
    )
    .innerJoin(
      interviewPlanQuestions,
      and(
        eq(interviewPlanQuestions.id, params.planQuestionId),
        eq(interviewPlanQuestions.sessionId, interviewSessions.id),
        isNull(interviewPlanQuestions.deletedAt),
        isNull(interviewPlanQuestions.supersededAt),
      ),
    )
    .innerJoin(
      interviewTurns,
      and(
        eq(interviewTurns.id, params.turnId),
        eq(interviewTurns.sessionId, interviewSessions.id),
        eq(interviewTurns.planQuestionId, interviewPlanQuestions.id),
      ),
    )
    .where(
      and(
        eq(interviewSessions.id, params.sessionId),
        eq(interviewSessions.status, "in_progress"),
        isNull(interviewSessions.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Interview turn is unavailable for an agent decision.");
  const [finalPositionRow] = await orm
    .select({ value: max(interviewPlanQuestions.position) })
    .from(interviewPlanQuestions)
    .where(
      and(
        eq(interviewPlanQuestions.sessionId, params.sessionId),
        isNull(interviewPlanQuestions.deletedAt),
        isNull(interviewPlanQuestions.supersededAt),
      ),
    );
  const [followUpsRow] = await orm
    .select({ value: count() })
    .from(interviewTurns)
    .where(
      and(
        eq(interviewTurns.sessionId, params.sessionId),
        eq(interviewTurns.planQuestionId, params.planQuestionId),
        eq(interviewTurns.kind, "follow_up"),
        isNull(interviewTurns.deletedAt),
      ),
    );
  const presageNotes = await getPresageNotesForSession(params.sessionId).catch(() => null);
  return {
    sessionId: row.sessionId,
    turnId: row.turnId,
    planQuestionId: params.planQuestionId,
    presageNotes,
    sessionStatus: "in_progress",
    questionPrompt: row.prompt,
    questionIntent: row.intent as Record<string, unknown>,
    transcript: "",
    followUpsUsed: followUpsRow?.value ?? 0,
    maxFollowUps: row.maxFollowUps,
    elapsedActiveMs:
      row.elapsedActiveMs + (row.activeStartedAt ? Math.max(0, Date.now() - row.activeStartedAt.getTime()) : 0),
    timeBudgetSeconds: row.timeBudgetSeconds,
    isLastQuestion: row.position === finalPositionRow?.value,
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
  await orm.insert(aiGenerations).values({
    id: generationId,
    sessionId: params.context.sessionId,
    turnId: params.context.turnId,
    purpose: "next_turn",
    status: "pending",
    model: params.model,
    promptVersion: params.promptVersion,
    inputHash: params.inputHash,
    inputSummary: {
      planQuestionId: params.context.planQuestionId,
      followUpsUsed: params.context.followUpsUsed,
      elapsedActiveMs: params.context.elapsedActiveMs,
    },
  });
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
  return orm.transaction(async (tx) => {
    const updated = await tx
      .update(aiGenerations)
      .set({
        status: "completed",
        model: params.model,
        result: params.decision,
        usage: params.usage,
        latencyMs: params.latencyMs,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(aiGenerations.id, params.generationId),
          eq(aiGenerations.sessionId, params.context.sessionId),
          eq(aiGenerations.turnId, params.context.turnId),
          eq(aiGenerations.purpose, "next_turn"),
          inArray(aiGenerations.status, ["pending", "running"]),
        ),
      )
      .returning({ id: aiGenerations.id });
    if (updated.length !== 1) throw new Error("Agent decision generation is unavailable.");
    if (params.decision.action === "ask_follow_up") {
      await tx.insert(interviewTurns).values({
        id: randomUUID(),
        sessionId: params.context.sessionId,
        planQuestionId: params.context.planQuestionId,
        parentTurnId: params.context.turnId,
        sequence: await nextTurnSequence(tx, params.context.sessionId),
        kind: "follow_up",
        text: params.decision.wording,
      });
    } else {
      await tx
        .update(interviewPlanQuestions)
        .set({ status: "answered" })
        .where(
          and(
            eq(interviewPlanQuestions.id, params.context.planQuestionId),
            eq(interviewPlanQuestions.sessionId, params.context.sessionId),
            inArray(interviewPlanQuestions.status, ["pending", "active"]),
          ),
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
  return orm.transaction(async (tx) => {
    const existing = await tx
      .select({ sequence: interviewEvents.sequence })
      .from(interviewEvents)
      .where(and(eq(interviewEvents.id, params.id), eq(interviewEvents.sessionId, params.sessionId)));
    if (existing.length) return existing[0];

    const locked = await tx
      .select({ status: interviewSessions.status, deletedAt: interviewSessions.deletedAt })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, params.sessionId))
      .for("update");
    if (locked.length !== 1 || locked[0].status === "deleted" || locked[0].deletedAt) {
      throw new Error("Interview session is unavailable.");
    }
    const sequence = await nextEventSequence(tx, params.sessionId);
    await tx.insert(interviewEvents).values({
      id: params.id,
      sessionId: params.sessionId,
      sequence,
      eventType: params.eventType,
      payload: params.payload ?? {},
    });
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
  const updated = await orm.transaction(async (tx) => {
    const sessions = await tx
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.id, params.sessionId),
          ne(interviewSessions.status, "deleted"),
          isNull(interviewSessions.deletedAt),
        ),
      )
      .limit(1);
    if (sessions.length !== 1) throw new Error("Interview session is unavailable.");
    return tx
      .insert(mediaArtifacts)
      .values({
        id: params.artifactId,
        sessionId: params.sessionId,
        turnId: params.turnId ?? null,
        r2Key: params.r2Key,
        mimeType: params.mimeType,
        uploadStatus: "uploading",
      })
      .onConflictDoUpdate({
        target: mediaArtifacts.id,
        set: {
          uploadStatus:
            sql`CASE WHEN ${mediaArtifacts.uploadStatus} = 'uploaded' THEN 'uploaded' ELSE 'uploading' END`,
        },
      })
      .returning({ id: mediaArtifacts.id });
  });
  if (updated.length !== 1) throw new Error("Interview session is unavailable.");
}

export async function saveClientDraftTranscript(params: {
  artifactId: string;
  turnId?: string;
  text: string;
  segments?: TranscriptSegment[];
}) {
  await orm
    .insert(audioTranscripts)
    .values({
      artifactId: params.artifactId,
      turnId: params.turnId ?? null,
      provider: "browser_speech_recognition",
      status: "completed",
      fullText: params.text,
      segments: params.segments ?? [],
    })
    .onConflictDoUpdate({
      target: [audioTranscripts.artifactId, audioTranscripts.provider],
      set: {
        turnId: sql`COALESCE(EXCLUDED.turn_id, ${audioTranscripts.turnId})`,
        fullText: params.text,
        segments: params.segments ?? [],
        completedAt: new Date(),
      },
      where: isNull(audioTranscripts.deletedAt),
    });
}

/** Only a server-side object verification may promote an artifact to uploaded. */
export async function confirmArtifactUploaded(params: {
  artifactId: string;
  sessionId: string;
  byteSize: number | null;
  checksumSha256: string | null;
  durationMs: number;
}) {
  const updated = await orm
    .update(mediaArtifacts)
    .set({
      uploadStatus: "uploaded",
      byteSize: params.byteSize,
      checksumSha256: params.checksumSha256,
      durationMs: params.durationMs,
      uploadedAt: new Date(),
    })
    .where(
      and(
        eq(mediaArtifacts.id, params.artifactId),
        eq(mediaArtifacts.sessionId, params.sessionId),
        isNull(mediaArtifacts.deletedAt),
        inArray(mediaArtifacts.uploadStatus, ["uploading", "retryable_failed"]),
        exists(
          orm
            .select({ id: interviewSessions.id })
            .from(interviewSessions)
            .where(
              and(
                eq(interviewSessions.id, params.sessionId),
                ne(interviewSessions.status, "deleted"),
                isNull(interviewSessions.deletedAt),
              ),
            ),
        ),
      ),
    )
    .returning({ id: mediaArtifacts.id, turnId: mediaArtifacts.turnId });
  if (updated.length !== 1) throw new Error("Recording upload cannot be confirmed.");
  // A confirmed upload is proof the candidate answered: flip the linked plan
  // question to answered even if the agent next-turn decision never ran
  // (hiring flow, LLM failure, or abandoned follow-up). Best-effort only.
  const turnId = updated[0]?.turnId;
  if (turnId) {
    const turns = await orm
      .select({ planQuestionId: interviewTurns.planQuestionId })
      .from(interviewTurns)
      .where(
        and(
          eq(interviewTurns.id, turnId),
          eq(interviewTurns.sessionId, params.sessionId),
          isNull(interviewTurns.deletedAt),
        ),
      )
      .limit(1);
    const planQuestionId = turns[0]?.planQuestionId;
    if (planQuestionId) {
      await orm
        .update(interviewPlanQuestions)
        .set({ status: "answered" })
        .where(
          and(
            eq(interviewPlanQuestions.id, planQuestionId),
            eq(interviewPlanQuestions.sessionId, params.sessionId),
            inArray(interviewPlanQuestions.status, ["pending", "active"]),
            isNull(interviewPlanQuestions.deletedAt),
            isNull(interviewPlanQuestions.supersededAt),
          ),
        );
    }
  }
}

export interface EvidenceLinkedReport {
  id: string;
  status: "processing" | "completed" | "retryable_failed" | "terminal_failed";
  rubricVersion: string;
  summary: {
    answeredCount: number;
    skippedCount: number;
    transcriptCount: number;
    artifactCount: number;
    transcriptSource: "browser_caption_draft";
  };
  generatedAt: string | null;
  items: Array<{
    id: string;
    planQuestionId: string | null;
    turnId: string | null;
    artifactId: string | null;
    competency: string;
    coverage: "observed" | "insufficient";
    finding: string;
    nextStep: string;
    evidenceText: string | null;
  }>;
}

function nextStepFor(contentType: string) {
  if (contentType === "behavioral") return "Practice a concise situation, action, and outcome structure for a future example.";
  if (contentType === "system_design") return "Practice naming constraints, tradeoffs, and one reliability failure mode before proposing components.";
  if (contentType === "code_explanation") return "Practice stating the approach, complexity, and one edge case before walking through implementation details.";
  return "Practice stating the decision criteria and one concrete tradeoff before giving your conclusion.";
}

/**
 * Creates the initial no-score report from durable candidate-owned evidence.
 * Browser captions are useful immediately but explicitly remain draft evidence
 * until a provider transcription is introduced in a later report version.
 */
export async function ensureEvidenceLinkedReport(sessionId: string, clerkUserId: string): Promise<EvidenceLinkedReport> {
  return orm.transaction(async (tx) => {
    const sessions = await tx
      .select({ id: interviewSessions.id })
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.id, sessionId),
          eq(interviewSessions.clerkUserId, clerkUserId),
          eq(interviewSessions.status, "completed"),
          isNull(interviewSessions.deletedAt),
        ),
      )
      .for("update");
    if (sessions.length !== 1) throw new Error("A report is available only after this interview is complete.");

    const existing = await tx
      .select({ id: evaluationReports.id, status: evaluationReports.status })
      .from(evaluationReports)
      .where(
        and(
          eq(evaluationReports.sessionId, sessionId),
          eq(evaluationReports.version, 1),
          isNull(evaluationReports.deletedAt),
        ),
      )
      .for("update");
    const reportId = existing[0]?.id ?? randomUUID();
    if (!existing.length) {
      await tx.insert(evaluationReports).values({
        id: reportId,
        sessionId,
        version: 1,
        status: "processing",
        rubricVersion: "practice-report-v1",
      });
    }

    // Latest candidate answer per question, latest uploaded clip per answer,
    // latest completed transcript per clip — assembled in JS over small reads.
    const planRows = await tx
      .select({
        id: interviewPlanQuestions.id,
        contentType: interviewPlanQuestions.contentType,
        prompt: interviewPlanQuestions.prompt,
        status: interviewPlanQuestions.status,
      })
      .from(interviewPlanQuestions)
      .where(
        and(
          eq(interviewPlanQuestions.sessionId, sessionId),
          isNull(interviewPlanQuestions.deletedAt),
          isNull(interviewPlanQuestions.supersededAt),
        ),
      )
      .orderBy(asc(interviewPlanQuestions.position));
    const answerRows = await tx
      .select({ id: interviewTurns.id, planQuestionId: interviewTurns.planQuestionId })
      .from(interviewTurns)
      .where(
        and(
          eq(interviewTurns.sessionId, sessionId),
          eq(interviewTurns.kind, "candidate_answer"),
          isNull(interviewTurns.deletedAt),
        ),
      )
      .orderBy(desc(interviewTurns.sequence));
    const latestAnswerByQuestion = new Map<string, string>();
    for (const answer of answerRows) {
      if (answer.planQuestionId && !latestAnswerByQuestion.has(answer.planQuestionId)) {
        latestAnswerByQuestion.set(answer.planQuestionId, answer.id);
      }
    }
    const artifactRows = await tx
      .select({ id: mediaArtifacts.id, turnId: mediaArtifacts.turnId })
      .from(mediaArtifacts)
      .where(
        and(
          eq(mediaArtifacts.sessionId, sessionId),
          eq(mediaArtifacts.uploadStatus, "uploaded"),
          isNull(mediaArtifacts.deletedAt),
        ),
      )
      .orderBy(sql`${mediaArtifacts.uploadedAt} DESC NULLS LAST`);
    const latestArtifactByTurn = new Map<string, string>();
    for (const artifact of artifactRows) {
      if (artifact.turnId && !latestArtifactByTurn.has(artifact.turnId)) {
        latestArtifactByTurn.set(artifact.turnId, artifact.id);
      }
    }
    const transcriptRows = await tx
      .select({
        artifactId: audioTranscripts.artifactId,
        fullText: audioTranscripts.fullText,
        completedAt: audioTranscripts.completedAt,
      })
      .from(audioTranscripts)
      .where(
        and(
          eq(audioTranscripts.status, "completed"),
          isNull(audioTranscripts.deletedAt),
          isNotNull(audioTranscripts.fullText),
        ),
      )
      .orderBy(sql`${audioTranscripts.completedAt} DESC NULLS LAST`);
    const latestTranscriptByArtifact = new Map<string, string>();
    for (const transcript of transcriptRows) {
      if (transcript.fullText && !latestTranscriptByArtifact.has(transcript.artifactId)) {
        latestTranscriptByArtifact.set(transcript.artifactId, transcript.fullText);
      }
    }

    const rows = planRows.map((question) => {
      const turnId = latestAnswerByQuestion.get(question.id) ?? null;
      const artifactId = turnId ? (latestArtifactByTurn.get(turnId) ?? null) : null;
      return {
        planQuestionId: question.id,
        contentType: question.contentType,
        prompt: question.prompt,
        questionStatus: question.status,
        turnId,
        artifactId,
        transcript: artifactId ? (latestTranscriptByArtifact.get(artifactId) ?? null) : null,
      };
    });
    const answeredCount = rows.filter((row) => row.questionStatus === "answered" || Boolean(row.turnId)).length;
    const skippedCount = rows.filter((row) => row.questionStatus === "skipped").length;
    const transcriptCount = rows.filter((row) => Boolean(row.transcript?.trim())).length;
    const artifactCount = rows.filter((row) => Boolean(row.artifactId)).length;
    const summary: EvidenceLinkedReport["summary"] = {
      answeredCount,
      skippedCount,
      transcriptCount,
      artifactCount,
      transcriptSource: "browser_caption_draft",
    };

    await tx.delete(evaluationItems).where(eq(evaluationItems.reportId, reportId));
    for (const row of rows) {
      const transcript = row.transcript?.trim() ?? "";
      const observed = transcript.length >= 40;
      await tx.insert(evaluationItems).values({
        reportId,
        planQuestionId: row.planQuestionId,
        turnId: row.turnId,
        artifactId: row.artifactId,
        competency: row.contentType.replaceAll("_", " "),
        coverage: observed ? "observed" : "insufficient",
        finding: observed
          ? `A saved response is available for: ${row.prompt}`
          : row.questionStatus === "skipped"
            ? "This question was skipped, so there is no response evidence to review."
            : "There is not enough saved transcript evidence for a practice observation on this question.",
        nextStep: nextStepFor(row.contentType),
        evidenceText: observed ? transcript.slice(0, 320) : null,
      });
    }
    await tx
      .update(evaluationReports)
      .set({ status: "completed", summary, errorCode: null, generatedAt: new Date() })
      .where(eq(evaluationReports.id, reportId));
    return readOwnedEvidenceLinkedReport(tx, sessionId, clerkUserId);
  });
}

async function readOwnedEvidenceLinkedReport(tx: TransactionExecutor, sessionId: string, clerkUserId: string): Promise<EvidenceLinkedReport> {
  const reportRows = await tx
    .select({
      id: evaluationReports.id,
      status: evaluationReports.status,
      rubricVersion: evaluationReports.rubricVersion,
      summary: evaluationReports.summary,
      generatedAt: evaluationReports.generatedAt,
    })
    .from(evaluationReports)
    .innerJoin(interviewSessions, eq(interviewSessions.id, evaluationReports.sessionId))
    .where(
      and(
        eq(evaluationReports.sessionId, sessionId),
        eq(interviewSessions.clerkUserId, clerkUserId),
        isNull(evaluationReports.deletedAt),
        isNull(interviewSessions.deletedAt),
      ),
    )
    .orderBy(desc(evaluationReports.version))
    .limit(1);
  const report = reportRows[0];
  if (!report) throw new Error("Interview report not found.");
  const items = await tx
    .select({
      id: evaluationItems.id,
      planQuestionId: evaluationItems.planQuestionId,
      turnId: evaluationItems.turnId,
      artifactId: evaluationItems.artifactId,
      competency: evaluationItems.competency,
      coverage: evaluationItems.coverage,
      finding: evaluationItems.finding,
      nextStep: evaluationItems.nextStep,
      evidenceText: evaluationItems.evidenceText,
    })
    .from(evaluationItems)
    .where(eq(evaluationItems.reportId, report.id))
    .orderBy(asc(evaluationItems.createdAt), asc(evaluationItems.id));
  const summary = report.summary as EvidenceLinkedReport["summary"];
  return {
    id: report.id,
    status: report.status,
    rubricVersion: report.rubricVersion,
    summary,
    generatedAt: report.generatedAt?.toISOString() ?? null,
    items: items.map((item) => ({
      id: item.id,
      planQuestionId: item.planQuestionId,
      turnId: item.turnId,
      artifactId: item.artifactId,
      competency: item.competency,
      coverage: item.coverage,
      finding: item.finding,
      nextStep: item.nextStep,
      evidenceText: item.evidenceText,
    })),
  };
}

export async function getOwnedEvidenceLinkedReport(sessionId: string, clerkUserId: string) {
  return orm.transaction(async (tx) => readOwnedEvidenceLinkedReport(tx, sessionId, clerkUserId));
}

export async function markArtifactRetryableFailure(artifactId: string, sessionId: string) {
  await orm
    .update(mediaArtifacts)
    .set({ uploadStatus: "retryable_failed" })
    .where(
      and(
        eq(mediaArtifacts.id, artifactId),
        eq(mediaArtifacts.sessionId, sessionId),
        ne(mediaArtifacts.uploadStatus, "uploaded"),
        exists(
          orm
            .select({ id: interviewSessions.id })
            .from(interviewSessions)
            .where(
              and(
                eq(interviewSessions.id, sessionId),
                ne(interviewSessions.status, "deleted"),
                isNull(interviewSessions.deletedAt),
              ),
            ),
        ),
      ),
    );
}

export async function getArtifactKeyForOwnedSession(params: {
  artifactId: string;
  sessionId: string;
  clerkUserId: string;
}) {
  const rows = await orm
    .select({ r2Key: mediaArtifacts.r2Key })
    .from(mediaArtifacts)
    .innerJoin(interviewSessions, eq(interviewSessions.id, mediaArtifacts.sessionId))
    .where(
      and(
        eq(mediaArtifacts.id, params.artifactId),
        eq(mediaArtifacts.sessionId, params.sessionId),
        eq(interviewSessions.clerkUserId, params.clerkUserId),
        isNull(mediaArtifacts.deletedAt),
        isNull(interviewSessions.deletedAt),
        ne(interviewSessions.status, "deleted"),
      ),
    )
    .limit(1);
  return rows[0]?.r2Key ?? null;
}

/** Soft deletion is irreversible access denial, while preserving retained records in R2/Postgres. */
export async function softDeleteInterviewSession(sessionId: string, clerkUserId: string) {
  return orm.transaction(async (tx) => {
    const sessions = await tx
      .update(interviewSessions)
      .set({ status: "deleted", deletedAt: sql`coalesce(${interviewSessions.deletedAt}, now())`, deletedByUserId: clerkUserId })
      .where(
        and(
          eq(interviewSessions.id, sessionId),
          eq(interviewSessions.clerkUserId, clerkUserId),
          isNull(interviewSessions.deletedAt),
        ),
      )
      .returning({ id: interviewSessions.id });
    if (sessions.length !== 1) return false;
    await tx
      .update(interviewPlanQuestions)
      .set({ deletedAt: new Date() })
      .where(and(eq(interviewPlanQuestions.sessionId, sessionId), isNull(interviewPlanQuestions.deletedAt)));
    await tx
      .update(interviewTurns)
      .set({ deletedAt: new Date() })
      .where(and(eq(interviewTurns.sessionId, sessionId), isNull(interviewTurns.deletedAt)));
    await tx
      .update(mediaArtifacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(mediaArtifacts.sessionId, sessionId), isNull(mediaArtifacts.deletedAt)));
    await tx
      .update(audioTranscripts)
      .set({ deletedAt: new Date() })
      .where(
        and(
          isNull(audioTranscripts.deletedAt),
          inArray(
            audioTranscripts.artifactId,
            tx
              .select({ id: mediaArtifacts.id })
              .from(mediaArtifacts)
              .where(eq(mediaArtifacts.sessionId, sessionId)),
          ),
        ),
      );
    await tx
      .update(aiGenerations)
      .set({ deletedAt: new Date() })
      .where(and(eq(aiGenerations.sessionId, sessionId), isNull(aiGenerations.deletedAt)));
    await tx
      .update(reportShareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(reportShareLinks.sessionId, sessionId), isNull(reportShareLinks.revokedAt)));
    return true;
  });
}
