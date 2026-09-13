-- 0012_biometric_queue_null_fix.sql
--
-- 0009's UNIQUE(artifact_id, provider) does not dedupe NULL artifact_id rows
-- in Postgres (NULL <> NULL), so retries with a null artifact could queue
-- duplicates. Replace with a partial unique index that only applies when
-- artifact_id IS NOT NULL. Idempotent / rerunnable.

BEGIN;

ALTER TABLE biometric_analyses
    DROP CONSTRAINT IF EXISTS biometric_analyses_artifact_provider_key;

CREATE UNIQUE INDEX IF NOT EXISTS biometric_analyses_artifact_provider_key
    ON biometric_analyses (artifact_id, provider)
    WHERE artifact_id IS NOT NULL;

COMMIT;
