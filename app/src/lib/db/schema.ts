import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const interviewModes = ["technical", "behavioral"] as const;
export const interviewMoods = ["supportive", "neutral", "challenging"] as const;
export const sessionStatuses = [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "abandoned",
  "deleted",
] as const;
export const uploadStatuses = ["pending", "uploading", "uploaded", "failed"] as const;
export const analysisStatuses = [
  "not_started",
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    mode: text("mode", { enum: interviewModes }).notNull(),
    status: text("status", { enum: sessionStatuses }).default("in_progress").notNull(),
    // Added by migrations/0004_session_setup_options.sql — kept in sync by
    // hand (see AGENTS.md); do NOT regenerate these via drizzle-kit against
    // a database that already applied 0004.
    questionCount: integer("question_count").default(3).notNull(),
    mood: text("mood", { enum: interviewMoods }).default("neutral").notNull(),
    customPrompt: text("custom_prompt"),
    voiceId: text("voice_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    elapsedActiveMs: bigint("elapsed_active_ms", { mode: "number" }).default(0).notNull(),
    activeStartedAt: timestamp("active_started_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: text("deleted_by_user_id"),
    activeConfigRevision: integer("active_config_revision"),
  },
  (table) => [
    index("idx_interview_sessions_clerk_user_id").on(table.clerkUserId),
    unique("interview_sessions_id_mode_key").on(table.id, table.mode),
    check("interview_sessions_mode_check", sql`${table.mode} in ('technical', 'behavioral')`),
    check(
      "interview_sessions_status_check",
      sql`${table.status} in ('planned', 'in_progress', 'paused', 'completed', 'abandoned', 'deleted')`,
    ),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mode: text("mode", { enum: interviewModes }).notNull(),
    prompt: text("prompt").notNull(),
    sequence: integer("sequence").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("questions_mode_sequence_key").on(table.mode, table.sequence),
    unique("questions_id_mode_key").on(table.id, table.mode),
    check("questions_mode_check", sql`${table.mode} in ('technical', 'behavioral')`),
    check("questions_sequence_check", sql`${table.sequence} >= 0`),
  ],
);

export const answerAttempts = pgTable(
  "answer_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull(),
    questionId: uuid("question_id").notNull(),
    mode: text("mode", { enum: interviewModes }).notNull(),
    mediaRef: text("media_ref"),
    mimeType: text("mime_type"),
    durationMs: integer("duration_ms"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    uploadStatus: text("upload_status", { enum: uploadStatuses }).default("pending").notNull(),
    analysisStatus: text("analysis_status", { enum: analysisStatuses })
      .default("not_started")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("answer_attempts_session_question_key").on(table.sessionId, table.questionId),
    index("idx_answer_attempts_question_id").on(table.questionId),
    foreignKey({
      columns: [table.sessionId, table.mode],
      foreignColumns: [interviewSessions.id, interviewSessions.mode],
      name: "answer_attempts_session_mode_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.questionId, table.mode],
      foreignColumns: [questions.id, questions.mode],
      name: "answer_attempts_question_mode_fkey",
    }),
    check("answer_attempts_mode_check", sql`${table.mode} in ('technical', 'behavioral')`),
    check("answer_attempts_duration_ms_check", sql`${table.durationMs} is null or ${table.durationMs} >= 0`),
    check(
      "answer_attempts_upload_status_check",
      sql`${table.uploadStatus} in ('pending', 'uploading', 'uploaded', 'failed')`,
    ),
    check(
      "answer_attempts_analysis_status_check",
      sql`${table.analysisStatus} in ('not_started', 'queued', 'processing', 'completed', 'failed')`,
    ),
    check(
      "answer_attempts_uploaded_media_check",
      sql`${table.uploadStatus} <> 'uploaded' or ${table.mediaRef} is not null`,
    ),
  ],
);

export const interviewContentTypes = [
  "behavioral",
  "technical_concepts",
  "system_design",
  "code_explanation",
] as const;
export const seniorityLevels = ["junior", "mid_level", "senior"] as const;
export const planQuestionStatuses = [
  "pending",
  "active",
  "answered",
  "skipped",
  "superseded",
  "closed",
] as const;
export const interviewTurnKinds = [
  "question",
  "candidate_answer",
  "follow_up",
  "repeat",
  "rephrase",
  "revisit",
  "skip",
  "agent_explanation",
  "coaching_detour",
  "system",
] as const;
export const interviewTurnStatuses = ["draft", "final", "failed", "superseded"] as const;
export const artifactUploadStatuses = [
  "uploading",
  "uploaded",
  "retryable_failed",
  "terminal_failed",
] as const;
export const transcriptStatuses = [
  "not_started",
  "queued",
  "processing",
  "completed",
  "retryable_failed",
  "terminal_failed",
] as const;
export const generationPurposes = ["plan", "next_turn", "report"] as const;
export const generationStatuses = ["pending", "running", "completed", "failed"] as const;
export const reportStatuses = ["processing", "completed", "retryable_failed", "terminal_failed"] as const;
export const reportCoverageStatuses = ["observed", "insufficient"] as const;

/** Immutable setup snapshots. Focus-area changes create a new revision. */
export const interviewSessionConfigs = pgTable(
  "interview_session_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    contentTypes: text("content_types", { enum: interviewContentTypes }).array().notNull(),
    targetRole: text("target_role").notNull(),
    seniority: text("seniority", { enum: seniorityLevels }).notNull(),
    focusArea: text("focus_area"),
    timeBudgetSeconds: integer("time_budget_seconds").notNull(),
    voiceId: text("voice_id"),
    mood: text("mood", { enum: ["supportive", "neutral", "challenging"] as const })
      .notNull()
      .default("neutral"),
    biometricsEnabled: boolean("biometrics_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("interview_session_configs_session_revision_key").on(table.sessionId, table.revision),
    check("interview_session_configs_revision_check", sql`${table.revision} >= 1`),
    check(
      "interview_session_configs_duration_check",
      sql`${table.timeBudgetSeconds} in (180, 600, 1200, 1800)`,
    ),
  ],
);

/** Planned questions are session-owned; no resume path may regenerate these. */
export const interviewPlanQuestions = pgTable(
  "interview_plan_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    configRevision: integer("config_revision").notNull(),
    position: integer("position").notNull(),
    contentType: text("content_type", { enum: interviewContentTypes }).notNull(),
    prompt: text("prompt").notNull(),
    intent: jsonb("intent").notNull().default({}),
    maxFollowUps: integer("max_follow_ups").notNull().default(1),
    status: text("status", { enum: planQuestionStatuses }).notNull().default("pending"),
    askedAt: timestamp("asked_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sessionId, table.configRevision],
      foreignColumns: [interviewSessionConfigs.sessionId, interviewSessionConfigs.revision],
      name: "interview_plan_questions_config_fkey",
    }).onDelete("cascade"),
    unique("interview_plan_questions_session_revision_position_key").on(
      table.sessionId,
      table.configRevision,
      table.position,
    ),
    check("interview_plan_questions_position_check", sql`${table.position} >= 1`),
    check("interview_plan_questions_follow_up_check", sql`${table.maxFollowUps} between 0 and 1`),
  ],
);

/** Append-only conversational history, including repeats, skips and revisits. */
export const interviewTurns = pgTable(
  "interview_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    planQuestionId: uuid("plan_question_id").references(() => interviewPlanQuestions.id, {
      onDelete: "set null",
    }),
    parentTurnId: uuid("parent_turn_id"),
    sequence: integer("sequence").notNull(),
    kind: text("kind", { enum: interviewTurnKinds }).notNull(),
    text: text("text"),
    status: text("status", { enum: interviewTurnStatuses }).notNull().default("final"),
    metadata: jsonb("metadata").notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentTurnId],
      foreignColumns: [table.id],
      name: "interview_turns_parent_turn_fkey",
    }).onDelete("set null"),
    unique("interview_turns_session_sequence_key").on(table.sessionId, table.sequence),
    check("interview_turns_sequence_check", sql`${table.sequence} >= 1`),
  ],
);

export const mediaArtifacts = pgTable(
  "media_artifacts",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").references(() => interviewTurns.id, { onDelete: "set null" }),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    durationMs: integer("duration_ms"),
    byteSize: bigint("byte_size", { mode: "number" }),
    checksumSha256: text("checksum_sha256"),
    uploadStatus: text("upload_status", { enum: artifactUploadStatuses })
      .notNull()
      .default("uploading"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  },
  (table) => [
    unique("media_artifacts_r2_key_key").on(table.r2Key),
    check("media_artifacts_duration_check", sql`${table.durationMs} is null or ${table.durationMs} >= 0`),
  ],
);

export const evaluationReports = pgTable(
  "evaluation_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => interviewSessions.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: reportStatuses }).notNull().default("processing"),
    rubricVersion: text("rubric_version").notNull(),
    summary: jsonb("summary").notNull().default({}),
    errorCode: text("error_code"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("evaluation_reports_session_version_key").on(table.sessionId, table.version),
    check("evaluation_reports_version_check", sql`${table.version} >= 1`),
  ],
);

export const evaluationItems = pgTable(
  "evaluation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id").notNull().references(() => evaluationReports.id, { onDelete: "cascade" }),
    planQuestionId: uuid("plan_question_id").references(() => interviewPlanQuestions.id, { onDelete: "set null" }),
    turnId: uuid("turn_id").references(() => interviewTurns.id, { onDelete: "set null" }),
    artifactId: uuid("artifact_id").references(() => mediaArtifacts.id, { onDelete: "set null" }),
    competency: text("competency").notNull(),
    coverage: text("coverage", { enum: reportCoverageStatuses }).notNull(),
    finding: text("finding").notNull(),
    nextStep: text("next_step").notNull(),
    evidenceText: text("evidence_text"),
    evidenceStartMs: integer("evidence_start_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("evaluation_items_evidence_start_check", sql`${table.evidenceStartMs} is null or ${table.evidenceStartMs} >= 0`),
  ],
);

export const audioTranscripts = pgTable(
  "audio_transcripts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => mediaArtifacts.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").references(() => interviewTurns.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    language: text("language").notNull().default("en"),
    status: text("status", { enum: transcriptStatuses }).notNull().default("not_started"),
    fullText: text("full_text"),
    segments: jsonb("segments").$type<TranscriptSegment[]>().notNull().default([]),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("audio_transcripts_artifact_provider_key").on(table.artifactId, table.provider)],
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id").references(() => interviewTurns.id, { onDelete: "set null" }),
    purpose: text("purpose", { enum: generationPurposes }).notNull(),
    status: text("status", { enum: generationStatuses }).notNull().default("pending"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    inputSummary: jsonb("input_summary").notNull().default({}),
    result: jsonb("result"),
    usage: jsonb("usage").notNull().default({}),
    estimatedCostCents: integer("estimated_cost_cents"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("ai_generations_latency_check", sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`),
  ],
);

export const interviewEvents = pgTable(
  "interview_events",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("interview_events_session_sequence_key").on(table.sessionId, table.sequence),
    check("interview_events_sequence_check", sql`${table.sequence} >= 1`),
  ],
);

export const reportShareLinks = pgTable(
  "report_share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("report_share_links_token_hash_key").on(table.tokenHash),
    check("report_share_links_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

/** Chess.com-style move review, applied to answers: a verdict per answered turn. */
export const reportVerdicts = ["blunder", "mistake", "inaccuracy", "good", "best", "insufficient_evidence"] as const;

export const reportFindings = pgTable(
  "report_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => aiGenerations.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => interviewTurns.id, { onDelete: "cascade" }),
    verdict: text("verdict", { enum: reportVerdicts }).notNull(),
    explanation: text("explanation").notNull(),
    improvement: text("improvement"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("report_findings_session_idx").on(table.sessionId, table.createdAt),
    index("report_findings_generation_idx").on(table.generationId),
    unique("report_findings_generation_turn_key").on(table.generationId, table.turnId),
  ],
);

export const biometricStatuses = [
  "not_started",
  "queued",
  "processing",
  "completed",
  "retryable_failed",
  "terminal_failed",
] as const;

export const biometricAnalyses = pgTable(
  "biometric_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    artifactId: uuid("artifact_id").references(() => mediaArtifacts.id, { onDelete: "set null" }),
    provider: text("provider").notNull().default("presage_smartspectra"),
    status: text("status", { enum: biometricStatuses }).notNull().default("not_started"),
    analysisId: text("analysis_id"),
    sdkVersion: text("sdk_version"),
    metrics: jsonb("metrics").notNull().default({}),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("biometric_analyses_session_idx").on(table.sessionId, table.createdAt),
    index("biometric_analyses_artifact_idx").on(table.artifactId),
    unique("biometric_analyses_artifact_provider_key").on(table.artifactId, table.provider),
  ],
);

export type ReportFinding = typeof reportFindings.$inferSelect;
export type NewReportFinding = typeof reportFindings.$inferInsert;
export type BiometricAnalysis = typeof biometricAnalyses.$inferSelect;
export type NewBiometricAnalysis = typeof biometricAnalyses.$inferInsert;

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type AnswerAttempt = typeof answerAttempts.$inferSelect;
export type NewAnswerAttempt = typeof answerAttempts.$inferInsert;
export type InterviewSessionConfig = typeof interviewSessionConfigs.$inferSelect;
export type InterviewPlanQuestion = typeof interviewPlanQuestions.$inferSelect;
export type InterviewTurn = typeof interviewTurns.$inferSelect;
export type MediaArtifact = typeof mediaArtifacts.$inferSelect;
export type NewMediaArtifact = typeof mediaArtifacts.$inferInsert;
export type AudioTranscript = typeof audioTranscripts.$inferSelect;
export type NewAudioTranscript = typeof audioTranscripts.$inferInsert;

// Workbench schemas (gmh_accounts, gmh_research) are provisioned outside the
// migrations/ series. Models below mirror the live tables column-for-column
// so application queries stay typed; DDL changes there must update both.
export const gmhAccounts = pgSchema("gmh_accounts");

export const accountProfiles = gmhAccounts.table("profiles", {
  clerkInstance: text("clerk_instance").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  profile: jsonb("profile").$type<unknown>().notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  classifiedAt: timestamp("classified_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gmhResearch = pgSchema("gmh_research");

export const researchDatasets = gmhResearch.table("datasets", {
  version: text("version").notNull(),
  manifestSha256: text("manifest_sha256").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
});

export const researchDocuments = gmhResearch.table("documents", {
  version: text("version").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  sha256: text("sha256").notNull(),
});

export type AccountProfile = typeof accountProfiles.$inferSelect;
export type ResearchDocument = typeof researchDocuments.$inferSelect;

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number | null;
}

