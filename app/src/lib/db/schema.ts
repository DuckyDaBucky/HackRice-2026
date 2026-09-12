import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const interviewModes = ["technical", "behavioral"] as const;
export const sessionModes = ["practice", "hiring_recorded"] as const;
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
    sessionMode: text("session_mode", { enum: sessionModes }).default("practice").notNull(),
  },
  (table) => [
    index("idx_interview_sessions_clerk_user_id").on(table.clerkUserId),
    unique("interview_sessions_id_mode_key").on(table.id, table.mode),
    check("interview_sessions_mode_check", sql`${table.mode} in ('technical', 'behavioral')`),
    check(
      "interview_sessions_status_check",
      sql`${table.status} in ('planned', 'in_progress', 'paused', 'completed', 'abandoned', 'deleted')`,
    ),
    check(
      "interview_sessions_session_mode_check",
      sql`${table.sessionMode} in ('practice', 'hiring_recorded')`,
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("interview_session_configs_session_revision_key").on(table.sessionId, table.revision),
    check("interview_session_configs_revision_check", sql`${table.revision} >= 1`),
    check(
      "interview_session_configs_duration_check",
      sql`${table.timeBudgetSeconds} in (600, 1200, 1800)`,
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
    segments: jsonb("segments").notNull().default([]),
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

export const organizationStatuses = ["pending", "active", "suspended"] as const;
export const candidacyStatuses = [
  "draft", "questions_pending", "ready_to_invite", "invited",
  "verification_pending", "verification_review", "verified",
  "interview_in_progress", "interview_completed", "processing",
  "report_ready", "revoked", "expired", "deleted",
] as const;
export const invitationStatuses = ["active", "revoked", "expired", "superseded", "accepted"] as const;
export const verificationStatuses = ["pending", "verified", "review", "failed"] as const;
export const processingJobTypes = ["transcription", "evaluation", "solana_reconcile", "retention"] as const;
export const processingJobStatuses = ["queued", "leased", "completed", "retryable_failed", "terminal_failed"] as const;
export const solanaOutboxStates = ["queued", "submitted", "finalized", "failed", "reconcile_required"] as const;

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  provisioningStatus: text("provisioning_status", { enum: organizationStatuses }).default("active").notNull(),
  maxInvitationsPerDay: integer("max_invitations_per_day").default(50).notNull(),
  maxSolanaLamportsPerDay: bigint("max_solana_lamports_per_day", { mode: "number" }).default(500_000_000).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hiringJobs = pgTable("hiring_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  roleFamily: text("role_family").notNull(),
  specialty: text("specialty"),
  competencies: jsonb("competencies").notNull().default([]),
  questionCount: integer("question_count").default(6).notNull(),
  timeBudgetSeconds: integer("time_budget_seconds").default(1200).notNull(),
  language: text("language").default("en").notNull(),
  sharedQuestionCount: integer("shared_question_count").default(3).notNull(),
  personalizedQuestionCount: integer("personalized_question_count").default(3).notNull(),
  allowLiveFollowUps: boolean("allow_live_follow_ups").default(false).notNull(),
  createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const candidacies = pgTable("candidacies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => hiringJobs.id, { onDelete: "cascade" }),
  confirmedName: text("confirmed_name").notNull(),
  confirmedEmail: text("confirmed_email").notNull(),
  resumeId: uuid("resume_id"),
  resumeVersion: integer("resume_version").default(1).notNull(),
  clerkUserId: text("clerk_user_id"),
  status: text("status", { enum: candidacyStatuses }).default("draft").notNull(),
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hiringResumes = pgTable("hiring_resumes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  candidacyId: uuid("candidacy_id").references(() => candidacies.id, { onDelete: "set null" }),
  originalFilename: text("original_filename").notNull(),
  r2Key: text("r2_key").notNull(),
  extractedText: text("extracted_text").notNull(),
  structuredFacts: jsonb("structured_facts").notNull().default({}),
  resumeVersion: integer("resume_version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvedQuestionPacks = pgTable("approved_question_packs", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidacyId: uuid("candidacy_id").notNull().references(() => candidacies.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  resumeVersion: integer("resume_version").notNull(),
  questions: jsonb("questions").notNull(),
  packCommitment: text("pack_commitment").notNull(),
  approvedByClerkUserId: text("approved_by_clerk_user_id").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("approved_question_packs_candidacy_revision_key").on(table.candidacyId, table.revision)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidacyId: uuid("candidacy_id").notNull().references(() => candidacies.id, { onDelete: "cascade" }),
  packRevision: integer("pack_revision").notNull(),
  secretHash: text("secret_hash").notNull().unique(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
  recruiterContact: text("recruiter_contact").notNull().default(""),
  status: text("status", { enum: invitationStatuses }).default("active").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  solanaInvitationPda: text("solana_invitation_pda"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export const verificationAttempts = pgTable("verification_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidacyId: uuid("candidacy_id").notNull().references(() => candidacies.id, { onDelete: "cascade" }),
  invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  personaInquiryRef: text("persona_inquiry_ref").notNull(),
  environment: text("environment").notNull(),
  status: text("status", { enum: verificationStatuses }).default("pending").notNull(),
  nameMatch: text("name_match"),
  boundAt: timestamp("bound_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hiringSessionBindings = pgTable("hiring_session_bindings", {
  id: uuid("id").defaultRandom().primaryKey(),
  interviewSessionId: uuid("interview_session_id").notNull().unique().references(() => interviewSessions.id, { onDelete: "cascade" }),
  candidacyId: uuid("candidacy_id").notNull().references(() => candidacies.id, { onDelete: "cascade" }),
  invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  packRevision: integer("pack_revision").notNull(),
  policy: jsonb("policy").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportRevisions = pgTable("report_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => interviewSessions.id, { onDelete: "cascade" }),
  candidacyId: uuid("candidacy_id").notNull().references(() => candidacies.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  revisionCommitment: text("revision_commitment"),
  status: text("status", { enum: reportStatuses }).default("processing").notNull(),
  summary: jsonb("summary").notNull().default({}),
  privateNotes: text("private_notes"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("report_revisions_session_revision_key").on(table.sessionId, table.revision)]);

export const reportReleases = pgTable("report_releases", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportRevisionId: uuid("report_revision_id").notNull().references(() => reportRevisions.id, { onDelete: "cascade" }),
  releaseSummary: boolean("release_summary").default(false).notNull(),
  releaseRubric: boolean("release_rubric").default(false).notNull(),
  releasePerQuestion: boolean("release_per_question").default(false).notNull(),
  releaseTranscript: boolean("release_transcript").default(false).notNull(),
  releaseRecordings: boolean("release_recordings").default(false).notNull(),
  releasedByClerkUserId: text("released_by_clerk_user_id").notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  solanaReleasePda: text("solana_release_pda"),
});

export const processingJobs = pgTable("processing_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobType: text("job_type", { enum: processingJobTypes }).notNull(),
  targetId: uuid("target_id").notNull(),
  targetKind: text("target_kind").notNull(),
  status: text("status", { enum: processingJobStatuses }).default("queued").notNull(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  attempts: integer("attempts").default(0).notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).defaultNow().notNull(),
  lastError: text("last_error"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const solanaOutbox = pgTable("solana_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  expectedRevision: integer("expected_revision"),
  payloadCommitment: text("payload_commitment").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  candidacyId: uuid("candidacy_id").references(() => candidacies.id, { onDelete: "set null" }),
  invitationId: uuid("invitation_id").references(() => invitations.id, { onDelete: "set null" }),
  txSignature: text("tx_signature"),
  state: text("state", { enum: solanaOutboxStates }).default("queued").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

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
export type AudioTranscript = typeof audioTranscripts.$inferSelect;
