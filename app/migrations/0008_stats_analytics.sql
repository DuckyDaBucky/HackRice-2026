-- 0007_stats_analytics.sql
--
-- Adds the data model for the post-interview stats page: structured report
-- findings (evidence-linked strengths/gaps) and presage-api biometric
-- analysis output. Additive only; no existing table is altered destructively.

BEGIN;

ALTER TABLE interview_session_configs
    ADD COLUMN IF NOT EXISTS biometrics_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS report_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    generation_id uuid NOT NULL REFERENCES ai_generations(id) ON DELETE CASCADE,
    competency_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('strength', 'gap', 'insufficient_evidence')),
    finding text NOT NULL,
    improvement text,
    evidence_turn_ids uuid[] NOT NULL DEFAULT '{}',
    evidence_start_ms integer CHECK (evidence_start_ms IS NULL OR evidence_start_ms >= 0),
    evidence_end_ms integer CHECK (evidence_end_ms IS NULL OR evidence_end_ms >= 0),
    confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_findings_session_idx ON report_findings (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS report_findings_generation_idx ON report_findings (generation_id);

CREATE TABLE IF NOT EXISTS biometric_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    artifact_id uuid REFERENCES media_artifacts(id) ON DELETE SET NULL,
    provider text NOT NULL DEFAULT 'presage_smartspectra',
    status text NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'queued', 'processing', 'completed', 'retryable_failed', 'terminal_failed')),
    analysis_id text,
    sdk_version text,
    metrics jsonb NOT NULL DEFAULT '{}',
    error_code text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS biometric_analyses_session_idx ON biometric_analyses (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biometric_analyses_artifact_idx ON biometric_analyses (artifact_id);

COMMIT;
