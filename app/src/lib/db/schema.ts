import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const interviewModes = ["technical", "behavioral"] as const;
export const sessionStatuses = ["in_progress", "completed", "abandoned"] as const;
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
  },
  (table) => [
    index("idx_interview_sessions_clerk_user_id").on(table.clerkUserId),
    unique("interview_sessions_id_mode_key").on(table.id, table.mode),
    check("interview_sessions_mode_check", sql`${table.mode} in ('technical', 'behavioral')`),
    check(
      "interview_sessions_status_check",
      sql`${table.status} in ('in_progress', 'completed', 'abandoned')`,
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

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type AnswerAttempt = typeof answerAttempts.$inferSelect;
export type NewAnswerAttempt = typeof answerAttempts.$inferInsert;
