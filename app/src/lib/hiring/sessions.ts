import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { ApprovedQuestion } from "./contracts";
import { DEFAULT_HIRING_POLICY } from "./contracts";
import { getLatestApprovedPack } from "./questions";
import { enqueueSolanaAction, requireFinalizedSolanaAction } from "@/lib/solana/outbox";

export async function createHiringInterviewSession(params: {
  candidacyId: string;
  invitationId: string;
  clerkUserId: string;
}) {
  const candidacy = await db.query(
    `SELECT c.*, j.time_budget_seconds, j.title AS job_title, o.display_name AS org_name
     FROM candidacies c
     JOIN hiring_jobs j ON j.id = c.job_id
     JOIN organizations o ON o.id = c.organization_id
     WHERE c.id = $1 AND c.clerk_user_id = $2 AND c.status IN ('verified', 'interview_in_progress')`,
    [params.candidacyId, params.clerkUserId],
  );
  const row = candidacy.rows[0];
  if (!row) throw new Error("Interview access is not available.");

  const pack = await getLatestApprovedPack(params.candidacyId);
  if (!pack) throw new Error("Approved question pack not found.");

  const existing = await db.query(
    `SELECT interview_session_id FROM hiring_session_bindings WHERE candidacy_id = $1`,
    [params.candidacyId],
  );
  if (existing.rows[0]) return existing.rows[0].interview_session_id as string;

  const solanaKey = `activate:${params.invitationId}`;
  try {
    await requireFinalizedSolanaAction(`attest_identity:${params.invitationId}`);
  } catch {
    // Allow session creation when solana not yet finalized but verification is complete in DB.
    if (row.status !== "verified") throw new Error("Identity verification must complete before the interview.");
  }

  const sessionId = randomUUID();
  const questions = pack.questions as ApprovedQuestion[];

  await db.query(
    `INSERT INTO interview_sessions (id, clerk_user_id, mode, status, session_mode, active_config_revision)
     VALUES ($1, $2, 'behavioral', 'planned', 'hiring_recorded', 1)`,
    [sessionId, params.clerkUserId],
  );
  await db.query(
    `INSERT INTO interview_session_configs
       (session_id, revision, content_types, target_role, seniority, focus_area, time_budget_seconds, voice_id, mood)
     VALUES ($1, 1, $2, $3, 'mid_level', $4, $5, null, 'neutral')`,
    [
      sessionId,
      ["behavioral", "technical_concepts"],
      row.job_title,
      row.org_name,
      row.time_budget_seconds ?? 1200,
    ],
  );
  for (const q of questions) {
    await db.query(
      `INSERT INTO interview_plan_questions
         (session_id, config_revision, position, content_type, prompt, intent, max_follow_ups, status)
       VALUES ($1, 1, $2, 'behavioral', $3, $4::jsonb, 0, 'pending')`,
      [
        sessionId,
        q.position,
        q.prompt,
        JSON.stringify({ competency: q.competency, category: q.category, evidence: q.profileEvidence }),
      ],
    );
  }
  await db.query(
    `INSERT INTO hiring_session_bindings (interview_session_id, candidacy_id, invitation_id, pack_revision, policy)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [sessionId, params.candidacyId, params.invitationId, pack.revision, JSON.stringify(DEFAULT_HIRING_POLICY)],
  );
  await db.query(`UPDATE candidacies SET status = 'interview_in_progress', updated_at = now() WHERE id = $1`, [params.candidacyId]);

  await enqueueSolanaAction({
    action: "activate_access",
    idempotencyKey: solanaKey,
    candidacyId: params.candidacyId,
    invitationId: params.invitationId,
    payload: { sessionId },
  });

  return sessionId;
}

export async function completeHiringInterview(sessionId: string, clerkUserId: string) {
  const binding = await db.query<{ candidacy_id: string }>(
    `SELECT candidacy_id FROM hiring_session_bindings b
     JOIN candidacies c ON c.id = b.candidacy_id
     WHERE b.interview_session_id = $1 AND c.clerk_user_id = $2`,
    [sessionId, clerkUserId],
  );
  const row = binding.rows[0];
  if (!row) throw new Error("Session not found.");

  await db.query(
    `UPDATE interview_sessions SET status = 'completed', completed_at = now() WHERE id = $1`,
    [sessionId],
  );
  await db.query(
    `UPDATE candidacies SET status = 'processing', delete_after = now() + interval '30 days', updated_at = now() WHERE id = $1`,
    [row.candidacy_id],
  );

  const { enqueueProcessingJob } = await import("@/lib/processing/worker");
  const artifacts = await db.query<{ id: string }>(
    `SELECT id FROM media_artifacts WHERE session_id = $1 AND upload_status = 'uploaded'`,
    [sessionId],
  );
  for (const artifact of artifacts.rows) {
    await enqueueProcessingJob({ jobType: "transcription", targetId: artifact.id, targetKind: "artifact" });
  }
  await enqueueProcessingJob({ jobType: "evaluation", targetId: sessionId, targetKind: "session" });
  await enqueueSolanaAction({
    action: "record_completion",
    candidacyId: row.candidacy_id,
    payload: { sessionId },
  });
}
