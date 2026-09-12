-- 0008_biometric_analysis_queue.sql
--
-- One presage-api analysis per artifact/provider pair, so re-confirming an
-- upload or retrying never queues a duplicate analysis.

BEGIN;

ALTER TABLE biometric_analyses
    ADD CONSTRAINT biometric_analyses_artifact_provider_key UNIQUE (artifact_id, provider);

COMMIT;
