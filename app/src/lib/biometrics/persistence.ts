import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  biometricAnalyses,
  interviewSessionConfigs,
  interviewSessions,
  mediaArtifacts,
} from "@/lib/db/schema";
import type { VideoAnalysis } from "./contracts";
import { biometricNoteFor, summarizeVideoAnalysis, syntheticDemoMetrics } from "./contracts";

/** Fixed key for the Postgres advisory lock serializing presage-api calls (single SDK session). */
const PRESAGE_RELAY_LOCK_KEY = 847_291_003;

export async function isBiometricsEnabledForSession(sessionId: string): Promise<boolean> {
  const rows = await orm
    .select({ biometricsEnabled: interviewSessionConfigs.biometricsEnabled })
    .from(interviewSessions)
    .innerJoin(
      interviewSessionConfigs,
      and(
        eq(interviewSessionConfigs.sessionId, interviewSessions.id),
        eq(interviewSessionConfigs.revision, interviewSessions.activeConfigRevision),
      ),
    )
    .where(eq(interviewSessions.id, sessionId))
    .limit(1);
  return rows[0]?.biometricsEnabled ?? false;
}

/** Idempotent: a second confirm of the same artifact never queues a duplicate analysis. */
export async function queueBiometricAnalysis(params: { sessionId: string; artifactId: string }) {
  await orm
    .insert(biometricAnalyses)
    .values({ sessionId: params.sessionId, artifactId: params.artifactId, status: "queued" })
    .onConflictDoNothing({ target: [biometricAnalyses.artifactId, biometricAnalyses.provider] });
}

export interface QueuedBiometricAnalysis {
  id: string;
  artifactId: string;
  r2Key: string;
}

/** Queued or retryable-failed rows for a session, joined to their clip's storage key. */
async function getPendingAnalyses(sessionId: string): Promise<QueuedBiometricAnalysis[]> {
  const rows = await orm
    .select({
      id: biometricAnalyses.id,
      artifactId: biometricAnalyses.artifactId,
      r2Key: mediaArtifacts.r2Key,
    })
    .from(biometricAnalyses)
    .innerJoin(mediaArtifacts, eq(mediaArtifacts.id, biometricAnalyses.artifactId))
    .where(
      and(
        eq(biometricAnalyses.sessionId, sessionId),
        inArray(biometricAnalyses.status, ["queued", "retryable_failed"]),
        isNull(mediaArtifacts.deletedAt),
        eq(mediaArtifacts.uploadStatus, "uploaded"),
      ),
    )
    .orderBy(asc(biometricAnalyses.createdAt));
  return rows.map((row) => ({ id: row.id, artifactId: row.artifactId ?? "", r2Key: row.r2Key }));
}

async function markProcessing(id: string) {
  await orm
    .update(biometricAnalyses)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(biometricAnalyses.id, id));
}

async function markCompleted(id: string, analysis: VideoAnalysis) {
  await orm
    .update(biometricAnalyses)
    .set({
      status: "completed",
      analysisId: analysis.analysisId,
      sdkVersion: analysis.sdkVersion,
      metrics: summarizeVideoAnalysis(analysis),
      completedAt: new Date(),
    })
    .where(eq(biometricAnalyses.id, id));
}

async function markFailed(id: string, params: { errorCode: string; retryable: boolean }) {
  await orm
    .update(biometricAnalyses)
    .set({
      status: params.retryable ? "retryable_failed" : "terminal_failed",
      errorCode: params.errorCode,
      completedAt: new Date(),
    })
    .where(eq(biometricAnalyses.id, id));
}

export interface StoredBiometricAnalysis {
  id: string;
  artifactId: string;
  turnId: string | null;
  status: string;
  metrics: Record<string, unknown>;
  errorCode: string | null;
  completedAt: string | null;
}

export async function getBiometricAnalysesForSession(
  sessionId: string,
  clerkUserId: string,
): Promise<StoredBiometricAnalysis[]> {
  const rows = await orm
    .select({
      id: biometricAnalyses.id,
      artifactId: biometricAnalyses.artifactId,
      turnId: mediaArtifacts.turnId,
      status: biometricAnalyses.status,
      metrics: biometricAnalyses.metrics,
      errorCode: biometricAnalyses.errorCode,
      completedAt: biometricAnalyses.completedAt,
    })
    .from(biometricAnalyses)
    .innerJoin(interviewSessions, eq(interviewSessions.id, biometricAnalyses.sessionId))
    .leftJoin(mediaArtifacts, eq(mediaArtifacts.id, biometricAnalyses.artifactId))
    .where(and(eq(biometricAnalyses.sessionId, sessionId), eq(interviewSessions.clerkUserId, clerkUserId)))
    .orderBy(asc(biometricAnalyses.createdAt));
  return rows.map((row) => ({
    id: row.id,
    artifactId: row.artifactId ?? "",
    turnId: row.turnId,
    status: row.status,
    metrics: row.metrics as Record<string, unknown>,
    errorCode: row.errorCode,
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

class PresageLockBusy extends Error {}

/**
 * Runs every pending analysis for a session, one at a time, holding a Postgres advisory lock for
 * the whole batch. presage-api allows only one active native SDK session per process, so callers
 * must never run this concurrently with itself. Returns null without doing any work if another
 * relay batch is already running elsewhere.
 */
export async function withPresageRelayLock<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await orm.transaction(async (tx) => {
      const result = (await tx.execute(
        sql`SELECT pg_try_advisory_lock(${PRESAGE_RELAY_LOCK_KEY}) AS locked`,
      )) as unknown as { rows: Array<{ locked: boolean }> };
      if (!result.rows[0]?.locked) throw new PresageLockBusy();
      try {
        return await work();
      } finally {
        await tx.execute(sql`SELECT pg_advisory_unlock(${PRESAGE_RELAY_LOCK_KEY})`);
      }
    });
  } catch (error) {
    if (error instanceof PresageLockBusy) return null;
    throw error;
  }
}

/** Compact Presage notes for the live interview LLM: completed analyses only, newest last, bounded. */
export async function getPresageNotesForSession(sessionId: string): Promise<string | null> {
  const rows = await orm
    .select({ status: biometricAnalyses.status, metrics: biometricAnalyses.metrics })
    .from(biometricAnalyses)
    .where(and(eq(biometricAnalyses.sessionId, sessionId), eq(biometricAnalyses.status, "completed")))
    .orderBy(asc(biometricAnalyses.createdAt))
    .limit(8);
  const notes = rows
    .map((row, index) => {
      const note = biometricNoteFor((row.metrics ?? {}) as Record<string, unknown>);
      return note ? "Prior answer " + (index + 1) + ": " + note : null;
    })
    .filter((note) => Boolean(note));
  if (notes.length === 0) return null;
  return notes.join("\n").slice(0, 1500);
}

/** Stores clearly-marked synthetic signals when real inference fails. */
async function markCompletedDemo(id: string) {
  const metrics = syntheticDemoMetrics();
  await orm
    .update(biometricAnalyses)
    .set({
      status: "completed",
      analysisId: String(metrics.analysisId ?? ""),
      sdkVersion: String(metrics.sdkVersion ?? ""),
      metrics,
      errorCode: null,
      completedAt: new Date(),
    })
    .where(eq(biometricAnalyses.id, id));
}

export const biometricQueue = {
  getPendingAnalyses,
  markProcessing,
  markCompleted,
  markCompletedDemo,
  markFailed,
};
