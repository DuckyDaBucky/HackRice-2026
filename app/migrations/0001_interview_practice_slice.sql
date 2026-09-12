-- 0001_interview_practice_slice.sql
--
-- Minimum schema to persist the practice-interview flow described in
-- docs/16-camera-recorder-build-slice.md and docs/17-camera-recorder-component.md:
-- a user runs a session (technical or behavioral), works through a static
-- set of questions, and records one video clip per question.
--
-- Scope and rationale: docs/18-data-model-slice.md.
-- Target long-term entity list: docs/07-data-and-api-design.md.
--
-- Applied and verified against the DEV TigerData service (t75o4scmb8) on
-- Postgres 18.6. gen_random_uuid() is built in on this server version, so
-- no pgcrypto/uuid-ossp extension is created here. If a future environment
-- runs Postgres < 13, add:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- No migration runner is installed (no Prisma/Drizzle/node-pg-migrate).
-- Apply by hand:
--   psql "$DATABASE_URL" -f app/migrations/0001_interview_practice_slice.sql

BEGIN;

-- One row per practice run. clerk_user_id is the Clerk user id (text) --
-- there is no local users table; Clerk is the identity source of truth
-- for this slice.
CREATE TABLE interview_sessions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id   text        NOT NULL,
    mode            text        NOT NULL CHECK (mode IN ('technical', 'behavioral')),
    status          text        NOT NULL DEFAULT 'in_progress'
                                 CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);

CREATE INDEX idx_interview_sessions_clerk_user_id
    ON interview_sessions (clerk_user_id);

-- Static/seeded question bank, one pack per mode. No AI generation, no
-- resume personalization, no per-session copies -- sessions reference
-- these rows directly.
CREATE TABLE questions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    mode        text        NOT NULL CHECK (mode IN ('technical', 'behavioral')),
    prompt      text        NOT NULL,
    sequence    integer     NOT NULL CHECK (sequence >= 0),
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_mode_sequence
    ON questions (mode, sequence);

-- One row per recorded clip (one AnswerAttempt per question per session in
-- this slice; retries/multiple attempts per question are not modeled yet).
-- media_ref is a pointer to wherever the blob eventually lands (e.g. an
-- object storage key/URL) -- storage itself is out of scope for this
-- slice, so the column is nullable until an upload target exists.
-- upload_status and analysis_status are separate fields because analysis
-- is deferred/stubbed per docs/16 ("per-answer, not real-time, not
-- end-of-session") and must not be conflated with whether the clip made it
-- to storage.
CREATE TABLE answer_attempts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid        NOT NULL REFERENCES interview_sessions (id) ON DELETE CASCADE,
    question_id     uuid        NOT NULL REFERENCES questions (id),
    media_ref       text,
    mime_type       text,
    duration_ms     integer     CHECK (duration_ms IS NULL OR duration_ms >= 0),
    recorded_at     timestamptz,
    upload_status   text        NOT NULL DEFAULT 'pending'
                                 CHECK (upload_status IN ('pending', 'uploading', 'uploaded', 'failed')),
    analysis_status text        NOT NULL DEFAULT 'not_started'
                                 CHECK (analysis_status IN ('not_started', 'queued', 'processing', 'completed', 'failed')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (upload_status <> 'uploaded' OR media_ref IS NOT NULL)
);

-- Composite index for the review-page query pattern (docs/16/17: one clip
-- per question, listed per session). Separate single-column indexes cover
-- the foreign keys for cascade/lookup performance independent of that
-- composite.
CREATE INDEX idx_answer_attempts_session_question
    ON answer_attempts (session_id, question_id);

CREATE INDEX idx_answer_attempts_question_id
    ON answer_attempts (question_id);

COMMIT;
