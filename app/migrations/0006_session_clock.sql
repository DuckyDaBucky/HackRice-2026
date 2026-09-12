-- 0006_session_clock.sql
--
-- Preserve active interview time across pause, leave, and resume. Wall-clock
-- time while a candidate is away must never consume their selected budget.

BEGIN;

ALTER TABLE interview_sessions
    ADD COLUMN IF NOT EXISTS elapsed_active_ms bigint NOT NULL DEFAULT 0
        CHECK (elapsed_active_ms >= 0),
    ADD COLUMN IF NOT EXISTS active_started_at timestamptz;

-- Existing live sessions predate the durable clock. Start timing from this
-- migration rather than inventing an inaccurate elapsed value.
UPDATE interview_sessions
SET active_started_at = now()
WHERE status = 'in_progress' AND active_started_at IS NULL;

COMMIT;
