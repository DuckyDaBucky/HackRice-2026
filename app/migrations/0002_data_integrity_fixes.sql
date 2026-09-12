-- 0002_data_integrity_fixes.sql
--
-- Follow-up to 0001_interview_practice_slice.sql, addressing gaps found in
-- automated PR review (see docs/18-data-model-slice.md's changelog note
-- for the full list). The 0001 tables were empty in the DEV environment
-- this was applied against, so no backfill/dedup step was needed here --
-- if this runs against a database with existing rows, resolve duplicates
-- per an explicit policy before applying the UNIQUE constraints below.
--
-- Apply by hand:
--   psql "$DATABASE_URL" -f app/migrations/0002_data_integrity_fixes.sql

BEGIN;

-- One attempt per (session, question): a regular index allowed duplicate
-- or concurrent inserts for the same pair to reach the review query as
-- multiple clips, which contradicts the one-attempt-per-question model.
DROP INDEX IF EXISTS idx_answer_attempts_session_question;
ALTER TABLE answer_attempts
    ADD CONSTRAINT answer_attempts_session_question_key UNIQUE (session_id, question_id);

-- One question per (mode, sequence): otherwise a pack has no defined
-- ordering once two questions share a position.
DROP INDEX IF EXISTS idx_questions_mode_sequence;
ALTER TABLE questions
    ADD CONSTRAINT questions_mode_sequence_key UNIQUE (mode, sequence);

-- Enforce that an answer_attempt's session and question agree on mode.
-- Requires carrying mode onto answer_attempts and switching its foreign
-- keys to composite (id, mode) references, since Postgres has no
-- cross-table CHECK constraint.
ALTER TABLE interview_sessions
    ADD CONSTRAINT interview_sessions_id_mode_key UNIQUE (id, mode);
ALTER TABLE questions
    ADD CONSTRAINT questions_id_mode_key UNIQUE (id, mode);

ALTER TABLE answer_attempts ADD COLUMN mode text;
UPDATE answer_attempts aa
    SET mode = s.mode
    FROM interview_sessions s
    WHERE s.id = aa.session_id AND aa.mode IS NULL;
ALTER TABLE answer_attempts
    ALTER COLUMN mode SET NOT NULL,
    ADD CONSTRAINT answer_attempts_mode_check CHECK (mode IN ('technical', 'behavioral'));

ALTER TABLE answer_attempts DROP CONSTRAINT answer_attempts_session_id_fkey;
ALTER TABLE answer_attempts DROP CONSTRAINT answer_attempts_question_id_fkey;
ALTER TABLE answer_attempts
    ADD CONSTRAINT answer_attempts_session_mode_fkey
        FOREIGN KEY (session_id, mode) REFERENCES interview_sessions (id, mode) ON DELETE CASCADE,
    ADD CONSTRAINT answer_attempts_question_mode_fkey
        FOREIGN KEY (question_id, mode) REFERENCES questions (id, mode);

-- updated_at columns had a DEFAULT but nothing ever advanced them past
-- creation time on later UPDATEs.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_interview_sessions_updated_at
    BEFORE UPDATE ON interview_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_answer_attempts_updated_at
    BEFORE UPDATE ON answer_attempts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
