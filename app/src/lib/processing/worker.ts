import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { transcribeWithScribe } from "@/lib/transcription/scribe";
import { evaluateAnswer } from "@/lib/workbench/ai/service";
import { createPlaybackUrl } from "@/lib/storage/r2";
import { enqueueSolanaAction, processSolanaOutboxBatch } from "@/lib/solana/outbox";
import { opaqueCommitment } from "@/lib/hiring/crypto";

const LEASE_SECONDS = 120;

export async function enqueueProcessingJob(params: {
  jobType: "transcription" | "evaluation" | "solana_reconcile" | "retention";
  targetId: string;
  targetKind: string;
  payload?: Record<string, unknown>;
}) {
  await db.query(
    `INSERT INTO processing_jobs (job_type, target_id, target_kind, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [params.jobType, params.targetId, params.targetKind, JSON.stringify(params.payload ?? {})],
  );
}

export async function runProcessingWorker(limit = 5) {
  const owner = randomUUID();
  const leased = await db.query(
    `UPDATE processing_jobs
     SET status = 'leased', lease_owner = $1, lease_expires_at = now() + ($2 || ' seconds')::interval, attempts = attempts + 1, updated_at = now()
     WHERE id IN (
       SELECT id FROM processing_jobs
       WHERE status = 'queued' AND next_run_at <= now()
       ORDER BY next_run_at ASC LIMIT $3
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [owner, String(LEASE_SECONDS), limit],
  );

  for (const job of leased.rows) {
    try {
      if (job.job_type === "transcription") await processTranscription(job.target_id);
      else if (job.job_type === "evaluation") await processEvaluation(job.target_id);
      else if (job.job_type === "solana_reconcile") await processSolanaOutboxBatch(10);
      else if (job.job_type === "retention") await processRetention(job.target_id);
      await db.query(`UPDATE processing_jobs SET status = 'completed', updated_at = now() WHERE id = $1`, [job.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const terminal = job.attempts >= 5;
      await db.query(
        `UPDATE processing_jobs SET status = $2, last_error = $3, next_run_at = now() + interval '5 minutes', updated_at = now() WHERE id = $1`,
        [job.id, terminal ? "terminal_failed" : "retryable_failed", message],
      );
    }
  }
  return leased.rowCount;
}

async function processTranscription(artifactId: string) {
  const artifact = await db.query<{ r2_key: string; mime_type: string; session_id: string; turn_id: string | null }>(
    `SELECT r2_key, mime_type, session_id, turn_id FROM media_artifacts WHERE id = $1 AND upload_status = 'uploaded'`,
    [artifactId],
  );
  const row = artifact.rows[0];
  if (!row) throw new Error("Artifact not found.");

  await db.query(
    `INSERT INTO audio_transcripts (artifact_id, turn_id, provider, status)
     VALUES ($1, $2, 'elevenlabs_scribe', 'processing')
     ON CONFLICT (artifact_id, provider) DO UPDATE SET status = 'processing', started_at = now()`,
    [artifactId, row.turn_id],
  );

  const url = await createPlaybackUrl(row.r2_key);
  const audioResponse = await fetch(url);
  if (!audioResponse.ok) throw new Error("Could not fetch recording for transcription.");
  const buffer = Buffer.from(await audioResponse.arrayBuffer());
  const { fullText, segments } = await transcribeWithScribe({ audioBuffer: buffer, mimeType: row.mime_type });

  await db.query(
    `UPDATE audio_transcripts SET status = 'completed', full_text = $3, segments = $4::jsonb, completed_at = now()
     WHERE artifact_id = $1 AND provider = 'elevenlabs_scribe'`,
    [artifactId, row.turn_id, fullText, JSON.stringify(segments)],
  );
}

async function processEvaluation(sessionId: string) {
  const binding = await db.query<{ candidacy_id: string; clerk_user_id: string | null }>(
    `SELECT b.candidacy_id, c.clerk_user_id
     FROM hiring_session_bindings b JOIN candidacies c ON c.id = b.candidacy_id
     WHERE b.interview_session_id = $1`,
    [sessionId],
  );
  const hire = binding.rows[0];
  const userId = hire?.clerk_user_id ?? "system";

  const evidence = await db.query(
    `SELECT q.id AS plan_question_id, q.prompt, q.content_type, t.id AS turn_id, a.id AS artifact_id, tr.full_text
     FROM interview_plan_questions q
     LEFT JOIN LATERAL (
       SELECT t.id FROM interview_turns t WHERE t.plan_question_id = q.id AND t.kind = 'candidate_answer' AND t.deleted_at IS NULL ORDER BY t.sequence DESC LIMIT 1
     ) t ON true
     LEFT JOIN media_artifacts a ON a.turn_id = t.id AND a.upload_status = 'uploaded'
     LEFT JOIN audio_transcripts tr ON tr.artifact_id = a.id AND tr.provider = 'elevenlabs_scribe' AND tr.status = 'completed'
     WHERE q.session_id = $1 AND q.deleted_at IS NULL ORDER BY q.position`,
    [sessionId],
  );

  const revisionResult = await db.query<{ next: number }>(
    `SELECT coalesce(max(revision), 0) + 1 AS next FROM report_revisions WHERE session_id = $1`,
    [sessionId],
  );
  const revision = revisionResult.rows[0]?.next ?? 1;
  const items: Array<Record<string, unknown>> = [];

  for (const row of evidence.rows) {
    const answer = row.full_text?.trim() ?? "";
    if (answer.length < 10) {
      items.push({
        planQuestionId: row.plan_question_id,
        competency: row.content_type,
        coverage: "insufficient",
        finding: "Insufficient transcript evidence for scoring.",
        rating: null,
      });
      continue;
    }
    try {
      const evaluation = await evaluateAnswer(userId, {
        question: {
          id: row.plan_question_id,
          prompt: row.prompt,
          competency: row.content_type,
          category: "behavioral",
          intent: row.prompt,
          profileEvidence: [],
          projectId: null,
          sourceQuestionId: null,
          strongAnswerIndicators: ["Provides a concrete example"],
          origin: "gemini-generated" as const,
          sourceIds: [],
          datasetVersion: null,
        },
        answer,
        context: {
          useMemory: false,
          target: { familyId: "software-engineer", specialtyId: "", level: "unknown", technologies: [], description: "" },
        },
      });
      for (const dim of evaluation.evaluation.dimensions) {
        items.push({
          planQuestionId: row.plan_question_id,
          turnId: row.turn_id,
          artifactId: row.artifact_id,
          competency: dim.dimension,
          coverage: dim.rating === null ? "insufficient" : "observed",
          finding: dim.rationale,
          rating: dim.rating,
          evidenceText: dim.evidence[0] ?? null,
        });
      }
    } catch {
      items.push({
        planQuestionId: row.plan_question_id,
        competency: row.content_type,
        coverage: "insufficient",
        finding: "Evaluation failed for this answer; retry processing.",
        rating: null,
      });
    }
  }

  const summary = { items, answeredCount: evidence.rows.filter((r) => r.full_text).length };
  const commitment = opaqueCommitment(summary);
  const reportResult = await db.query<{ id: string }>(
    `INSERT INTO report_revisions (session_id, candidacy_id, revision, revision_commitment, status, summary, generated_at)
     VALUES ($1, $2, $3, $4, 'completed', $5::jsonb, now()) RETURNING id`,
    [sessionId, hire?.candidacy_id, revision, commitment, JSON.stringify(summary)],
  );

  if (hire?.candidacy_id) {
    await db.query(`UPDATE candidacies SET status = 'report_ready', updated_at = now() WHERE id = $1`, [hire.candidacy_id]);
    await enqueueSolanaAction({
      action: "register_report_revision",
      candidacyId: hire.candidacy_id,
      expectedRevision: revision,
      payload: { sessionId, revision, commitment },
    });
  }
  return reportResult.rows[0]?.id;
}

async function processRetention(candidacyId: string) {
  await db.query(
    `UPDATE candidacies SET status = 'deleted', confirmed_name = '[deleted]', confirmed_email = '[deleted]', updated_at = now()
     WHERE id = $1 AND delete_after IS NOT NULL AND delete_after <= now()`,
    [candidacyId],
  );
}
