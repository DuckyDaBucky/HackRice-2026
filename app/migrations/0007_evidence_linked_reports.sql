-- 0007_evidence_linked_reports.sql
-- Versioned, evidence-linked practice reports. Scores are intentionally absent:
-- coverage is explicit when a usable transcript was not captured.

BEGIN;

CREATE TABLE IF NOT EXISTS evaluation_reports (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    version         integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
    status          text        NOT NULL DEFAULT 'processing'
                                CHECK (status IN ('processing', 'completed', 'retryable_failed', 'terminal_failed')),
    rubric_version  text        NOT NULL,
    summary         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    error_code      text,
    generated_at    timestamptz,
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, version)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_reports_session_active
    ON evaluation_reports(session_id, version DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS evaluation_items (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id           uuid        NOT NULL REFERENCES evaluation_reports(id) ON DELETE CASCADE,
    plan_question_id    uuid        REFERENCES interview_plan_questions(id) ON DELETE SET NULL,
    turn_id             uuid        REFERENCES interview_turns(id) ON DELETE SET NULL,
    artifact_id         uuid        REFERENCES media_artifacts(id) ON DELETE SET NULL,
    competency          text        NOT NULL,
    coverage            text        NOT NULL CHECK (coverage IN ('observed', 'insufficient')),
    finding             text        NOT NULL,
    next_step           text        NOT NULL,
    evidence_text       text,
    evidence_start_ms   integer     CHECK (evidence_start_ms IS NULL OR evidence_start_ms >= 0),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_items_report ON evaluation_items(report_id);

COMMIT;
