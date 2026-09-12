-- 0010_chess_style_report_findings.sql
--
-- Replaces the competency-grouped report_findings shape with a chess.com-style
-- move review: one verdict per answered turn (blunder/mistake/inaccuracy/good/
-- best/insufficient_evidence), each with an explanation of why and an
-- optional improvement. No production data depends on the prior shape yet.

BEGIN;

DROP TABLE IF EXISTS report_findings;

CREATE TABLE report_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    generation_id uuid NOT NULL REFERENCES ai_generations(id) ON DELETE CASCADE,
    turn_id uuid NOT NULL REFERENCES interview_turns(id) ON DELETE CASCADE,
    verdict text NOT NULL
        CHECK (verdict IN ('blunder', 'mistake', 'inaccuracy', 'good', 'best', 'insufficient_evidence')),
    explanation text NOT NULL,
    improvement text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_findings_session_idx ON report_findings (session_id, created_at DESC);
CREATE INDEX report_findings_generation_idx ON report_findings (generation_id);
CREATE UNIQUE INDEX report_findings_generation_turn_key ON report_findings (generation_id, turn_id);

COMMIT;
