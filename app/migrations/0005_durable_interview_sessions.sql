-- 0005_durable_interview_sessions.sql
--
-- M1 foundation for adaptive, resumable interviews. This is deliberately
-- additive: legacy static-question sessions and recordings remain readable;
-- new v2 services write the versioned configuration, plan, turn and artifact
-- tables below. Apply after 0004.

BEGIN;

ALTER TABLE interview_sessions
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS paused_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by_user_id text,
    ADD COLUMN IF NOT EXISTS active_config_revision integer;

ALTER TABLE interview_sessions
    DROP CONSTRAINT IF EXISTS interview_sessions_status_check;
ALTER TABLE interview_sessions
    ADD CONSTRAINT interview_sessions_status_check
    CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'abandoned', 'deleted'));

CREATE TABLE IF NOT EXISTS interview_session_configs (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    revision            integer     NOT NULL CHECK (revision >= 1),
    content_types       text[]      NOT NULL CHECK (
        cardinality(content_types) >= 1
        AND content_types <@ ARRAY['behavioral', 'technical_concepts', 'system_design', 'code_explanation']::text[]
    ),
    target_role         text        NOT NULL CHECK (char_length(target_role) BETWEEN 1 AND 160),
    seniority           text        NOT NULL CHECK (seniority IN ('junior', 'mid_level', 'senior')),
    focus_area          text        CHECK (focus_area IS NULL OR char_length(focus_area) <= 500),
    time_budget_seconds integer     NOT NULL CHECK (time_budget_seconds IN (600, 1200, 1800)),
    voice_id            text,
    mood                text        NOT NULL DEFAULT 'neutral'
                                CHECK (mood IN ('supportive', 'neutral', 'challenging')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_interview_session_configs_session_revision
    ON interview_session_configs(session_id, revision DESC);

CREATE TABLE IF NOT EXISTS interview_plan_questions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    config_revision     integer     NOT NULL,
    position            integer     NOT NULL CHECK (position >= 1),
    content_type        text        NOT NULL CHECK (content_type IN ('behavioral', 'technical_concepts', 'system_design', 'code_explanation')),
    prompt              text        NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 4000),
    intent              jsonb       NOT NULL DEFAULT '{}'::jsonb,
    max_follow_ups      integer     NOT NULL DEFAULT 1 CHECK (max_follow_ups BETWEEN 0 AND 1),
    status              text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'active', 'answered', 'skipped', 'superseded', 'closed')),
    asked_at            timestamptz,
    superseded_at       timestamptz,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (session_id, config_revision)
        REFERENCES interview_session_configs(session_id, revision) ON DELETE CASCADE,
    UNIQUE (session_id, config_revision, position)
);

CREATE INDEX IF NOT EXISTS idx_interview_plan_questions_active
    ON interview_plan_questions(session_id, position)
    WHERE superseded_at IS NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS interview_turns (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    plan_question_id    uuid        REFERENCES interview_plan_questions(id) ON DELETE SET NULL,
    parent_turn_id      uuid        REFERENCES interview_turns(id) ON DELETE SET NULL,
    sequence            integer     NOT NULL CHECK (sequence >= 1),
    kind                text        NOT NULL CHECK (kind IN (
        'question', 'candidate_answer', 'follow_up', 'repeat', 'rephrase',
        'revisit', 'skip', 'agent_explanation', 'coaching_detour', 'system'
    )),
    text                text,
    status              text        NOT NULL DEFAULT 'final'
                                CHECK (status IN ('draft', 'final', 'failed', 'superseded')),
    metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_interview_turns_session_sequence
    ON interview_turns(session_id, sequence)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS media_artifacts (
    id                  uuid        PRIMARY KEY,
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    turn_id             uuid        REFERENCES interview_turns(id) ON DELETE SET NULL,
    r2_key              text        NOT NULL UNIQUE,
    mime_type           text        NOT NULL,
    duration_ms         integer     CHECK (duration_ms IS NULL OR duration_ms >= 0),
    byte_size           bigint      CHECK (byte_size IS NULL OR byte_size >= 0),
    checksum_sha256     text,
    upload_status       text        NOT NULL DEFAULT 'uploading'
                                CHECK (upload_status IN ('uploading', 'uploaded', 'retryable_failed', 'terminal_failed')),
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    uploaded_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_media_artifacts_session
    ON media_artifacts(session_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS audio_transcripts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id         uuid        NOT NULL REFERENCES media_artifacts(id) ON DELETE CASCADE,
    turn_id             uuid        REFERENCES interview_turns(id) ON DELETE SET NULL,
    provider            text        NOT NULL,
    language            text        NOT NULL DEFAULT 'en',
    status              text        NOT NULL DEFAULT 'not_started'
                                CHECK (status IN ('not_started', 'queued', 'processing', 'completed', 'retryable_failed', 'terminal_failed')),
    full_text           text,
    segments            jsonb       NOT NULL DEFAULT '[]'::jsonb,
    error_code          text,
    started_at          timestamptz,
    completed_at        timestamptz,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (artifact_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_audio_transcripts_artifact
    ON audio_transcripts(artifact_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_generations (
    id                  uuid        PRIMARY KEY,
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    turn_id             uuid        REFERENCES interview_turns(id) ON DELETE SET NULL,
    purpose             text        NOT NULL CHECK (purpose IN ('plan', 'next_turn', 'report')),
    status              text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    model               text        NOT NULL,
    prompt_version      text        NOT NULL,
    input_hash          text        NOT NULL,
    input_summary       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    result              jsonb,
    usage               jsonb       NOT NULL DEFAULT '{}'::jsonb,
    estimated_cost_cents integer,
    latency_ms          integer     CHECK (latency_ms IS NULL OR latency_ms >= 0),
    error_code          text,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_session
    ON ai_generations(session_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS interview_events (
    id                  uuid        PRIMARY KEY,
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    sequence            integer     NOT NULL CHECK (sequence >= 1),
    event_type          text        NOT NULL,
    payload             jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, sequence)
);

CREATE TABLE IF NOT EXISTS report_share_links (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    token_hash          text        NOT NULL UNIQUE,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_report_share_links_active
    ON report_share_links(token_hash)
    WHERE revoked_at IS NULL;

COMMIT;
