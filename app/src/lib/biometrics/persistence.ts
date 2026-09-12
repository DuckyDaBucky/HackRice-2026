import "server-only";
import { db } from "@/lib/db";
import type { VideoAnalysis } from "./contracts";
import { summarizeVideoAnalysis } from "./contracts";

/** Fixed key for the Postgres advisory lock serializing presage-api calls (single SDK session). */
const PRESAGE_RELAY_LOCK_KEY = 847_291_003;

export async function isBiometricsEnabledForSession(sessionId: string): Promise<boolean> {
  const result = await db.query<{ biometrics_enabled: boolean }>(
    `SELECT c.biometrics_enabled
     FROM interview_sessions s
     JOIN interview_session_configs c ON c.session_id = s.id AND c.revision = s.active_config_revision
     WHERE s.id = $1`,
    [sessionId],
  );
  return result.rows[0]?.biometrics_enabled ?? false;
}

/** Idempotent: a second confirm of the same artifact never queues a duplicate analysis. */
export async function queueBiometricAnalysis(params: { sessionId: string; artifactId: string }) {
  await db.query(
    `INSERT INTO biometric_analyses (session_id, artifact_id, status)
     VALUES ($1, $2, 'queued')
     ON CONFLICT (artifact_id, provider) DO NOTHING`,
    [params.sessionId, params.artifactId],
  );
}

export interface QueuedBiometricAnalysis {
  id: string;
  artifactId: string;
  r2Key: string;
}

/** Queued or retryable-failed rows for a session, joined to their clip's storage key. */
async function getPendingAnalyses(sessionId: string): Promise<QueuedBiometricAnalysis[]> {
  const result = await db.query<{ id: string; artifact_id: string; r2_key: string }>(
    `SELECT b.id, b.artifact_id, ma.r2_key
     FROM biometric_analyses b
     JOIN media_artifacts ma ON ma.id = b.artifact_id
     WHERE b.session_id = $1 AND b.status IN ('queued', 'retryable_failed')
       AND ma.deleted_at IS NULL AND ma.upload_status = 'uploaded'
     ORDER BY b.created_at ASC`,
    [sessionId],
  );
  return result.rows.map((row) => ({ id: row.id, artifactId: row.artifact_id, r2Key: row.r2_key }));
}

async function markProcessing(id: string) {
  await db.query(
    `UPDATE biometric_analyses SET status = 'processing', started_at = now() WHERE id = $1`,
    [id],
  );
}

async function markCompleted(id: string, analysis: VideoAnalysis) {
  await db.query(
    `UPDATE biometric_analyses
     SET status = 'completed', analysis_id = $2, sdk_version = $3, metrics = $4::jsonb, completed_at = now()
     WHERE id = $1`,
    [id, analysis.analysisId, analysis.sdkVersion, JSON.stringify(summarizeVideoAnalysis(analysis))],
  );
}

async function markFailed(id: string, params: { errorCode: string; retryable: boolean }) {
  await db.query(
    `UPDATE biometric_analyses
     SET status = $2, error_code = $3, completed_at = now()
     WHERE id = $1`,
    [id, params.retryable ? "retryable_failed" : "terminal_failed", params.errorCode],
  );
}

export interface StoredBiometricAnalysis {
  id: string;
  status: string;
  metrics: Record<string, unknown>;
  completedAt: string | null;
}

export async function getBiometricAnalysesForSession(
  sessionId: string,
  clerkUserId: string,
): Promise<StoredBiometricAnalysis[]> {
  const result = await db.query<{
    id: string;
    status: string;
    metrics: Record<string, unknown>;
    completed_at: Date | null;
  }>(
    `SELECT b.id, b.status, b.metrics, b.completed_at
     FROM biometric_analyses b
     JOIN interview_sessions s ON s.id = b.session_id
     WHERE b.session_id = $1 AND s.clerk_user_id = $2
     ORDER BY b.created_at ASC`,
    [sessionId, clerkUserId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    metrics: row.metrics,
    completedAt: row.completed_at?.toISOString() ?? null,
  }));
}

/**
 * Runs every pending analysis for a session, one at a time, holding a Postgres advisory lock for
 * the whole batch. presage-api allows only one active native SDK session per process, so callers
 * must never run this concurrently with itself.
 */
export async function withPresageRelayLock<T>(work: () => Promise<T>): Promise<T | null> {
  const client = await db.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [PRESAGE_RELAY_LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) return null;
    try {
      return await work();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [PRESAGE_RELAY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

export const biometricQueue = {
  getPendingAnalyses,
  markProcessing,
  markCompleted,
  markFailed,
};
