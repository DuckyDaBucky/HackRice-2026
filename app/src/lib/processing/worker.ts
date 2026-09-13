import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  audioTranscripts,
  candidacies,
  hiringSessionBindings,
  interviewPlanQuestions,
  interviewTurns,
  mediaArtifacts,
  processingJobs,
  reportRevisions,
} from "@/lib/db/schema";
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
  await orm.insert(processingJobs).values({
    jobType: params.jobType,
    targetId: params.targetId,
    targetKind: params.targetKind,
    payload: params.payload ?? {},
  });
}

export async function runProcessingWorker(limit = 5) {
  const owner = randomUUID();
  // Lease claim stays atomic: candidate selection (SKIP LOCKED) and the lease
  // UPDATE run inside a single transaction while holding the row locks.
  const leased = await orm.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: processingJobs.id })
      .from(processingJobs)
      .where(and(eq(processingJobs.status, "queued"), lte(processingJobs.nextRunAt, new Date())))
      .orderBy(asc(processingJobs.nextRunAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (candidates.length === 0) return [];
    return tx
      .update(processingJobs)
      .set({
        status: "leased",
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000),
        attempts: sql`${processingJobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          processingJobs.id,
          candidates.map((candidate) => candidate.id),
        ),
      )
      .returning();
  });

  for (const job of leased) {
    try {
      if (job.jobType === "transcription") await processTranscription(job.targetId);
      else if (job.jobType === "evaluation") await processEvaluation(job.targetId);
      else if (job.jobType === "solana_reconcile") await processSolanaOutboxBatch(10);
      else if (job.jobType === "retention") await processRetention(job.targetId);
      await orm
        .update(processingJobs)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const terminal = job.attempts >= 5;
      await orm
        .update(processingJobs)
        .set({
          status: terminal ? "terminal_failed" : "retryable_failed",
          lastError: message,
          nextRunAt: new Date(Date.now() + 5 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, job.id));
    }
  }
  return leased.length;
}

async function processTranscription(artifactId: string) {
  const rows = await orm
    .select({
      r2Key: mediaArtifacts.r2Key,
      mimeType: mediaArtifacts.mimeType,
      turnId: mediaArtifacts.turnId,
    })
    .from(mediaArtifacts)
    .where(and(eq(mediaArtifacts.id, artifactId), eq(mediaArtifacts.uploadStatus, "uploaded")))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Artifact not found.");

  await orm
    .insert(audioTranscripts)
    .values({
      artifactId,
      turnId: row.turnId,
      provider: "elevenlabs_scribe",
      status: "processing",
    })
    .onConflictDoUpdate({
      target: [audioTranscripts.artifactId, audioTranscripts.provider],
      set: { status: "processing", startedAt: new Date() },
    });

  const url = await createPlaybackUrl(row.r2Key);
  const audioResponse = await fetch(url);
  if (!audioResponse.ok) throw new Error("Could not fetch recording for transcription.");
  const buffer = Buffer.from(await audioResponse.arrayBuffer());
  const { fullText, segments } = await transcribeWithScribe({ audioBuffer: buffer, mimeType: row.mimeType });

  await orm
    .update(audioTranscripts)
    .set({ status: "completed", fullText, segments, completedAt: new Date() })
    .where(
      and(
        eq(audioTranscripts.artifactId, artifactId),
        eq(audioTranscripts.provider, "elevenlabs_scribe"),
      ),
    );
}

async function processEvaluation(sessionId: string) {
  const bindingRows = await orm
    .select({
      candidacyId: hiringSessionBindings.candidacyId,
      clerkUserId: candidacies.clerkUserId,
    })
    .from(hiringSessionBindings)
    .innerJoin(candidacies, eq(candidacies.id, hiringSessionBindings.candidacyId))
    .where(eq(hiringSessionBindings.interviewSessionId, sessionId))
    .limit(1);
  const hire = bindingRows[0];
  const userId = hire?.clerkUserId ?? "system";

  // The original LATERAL query picked the latest candidate answer per plan
  // question, its uploaded artifact, and the completed scribe transcript.
  // Reassembled here in JS over small indexed reads (same pattern as
  // ensureEvidenceLinkedReport), yielding one row per plan question.
  const planRows = await orm
    .select({
      id: interviewPlanQuestions.id,
      prompt: interviewPlanQuestions.prompt,
      contentType: interviewPlanQuestions.contentType,
    })
    .from(interviewPlanQuestions)
    .where(and(eq(interviewPlanQuestions.sessionId, sessionId), isNull(interviewPlanQuestions.deletedAt)))
    .orderBy(asc(interviewPlanQuestions.position));
  const answerRows = await orm
    .select({
      id: interviewTurns.id,
      planQuestionId: interviewTurns.planQuestionId,
      sequence: interviewTurns.sequence,
    })
    .from(interviewTurns)
    .where(
      and(
        eq(interviewTurns.sessionId, sessionId),
        eq(interviewTurns.kind, "candidate_answer"),
        isNull(interviewTurns.deletedAt),
      ),
    )
    .orderBy(desc(interviewTurns.sequence));
  const latestAnswerByQuestion = new Map<string, string>();
  for (const answer of answerRows) {
    if (answer.planQuestionId && !latestAnswerByQuestion.has(answer.planQuestionId)) {
      latestAnswerByQuestion.set(answer.planQuestionId, answer.id);
    }
  }
  const turnIds = [...latestAnswerByQuestion.values()];
  const artifactByTurn = new Map<string, string>();
  if (turnIds.length > 0) {
    const artifactRows = await orm
      .select({
        id: mediaArtifacts.id,
        turnId: mediaArtifacts.turnId,
      })
      .from(mediaArtifacts)
      .where(and(inArray(mediaArtifacts.turnId, turnIds), eq(mediaArtifacts.uploadStatus, "uploaded")))
      .orderBy(sql`${mediaArtifacts.uploadedAt} DESC NULLS LAST`);
    for (const artifact of artifactRows) {
      if (artifact.turnId && !artifactByTurn.has(artifact.turnId)) {
        artifactByTurn.set(artifact.turnId, artifact.id);
      }
    }
  }
  const artifactIds = [...artifactByTurn.values()];
  const transcriptByArtifact = new Map<string, string>();
  if (artifactIds.length > 0) {
    const transcriptRows = await orm
      .select({
        artifactId: audioTranscripts.artifactId,
        fullText: audioTranscripts.fullText,
      })
      .from(audioTranscripts)
      .where(
        and(
          inArray(audioTranscripts.artifactId, artifactIds),
          eq(audioTranscripts.provider, "elevenlabs_scribe"),
          eq(audioTranscripts.status, "completed"),
        ),
      );
    for (const transcript of transcriptRows) {
      if (transcript.fullText && !transcriptByArtifact.has(transcript.artifactId)) {
        transcriptByArtifact.set(transcript.artifactId, transcript.fullText);
      }
    }
  }
  const evidence = planRows.map((question) => {
    const turnId = latestAnswerByQuestion.get(question.id) ?? null;
    const artifactId = turnId ? (artifactByTurn.get(turnId) ?? null) : null;
    return {
      planQuestionId: question.id,
      prompt: question.prompt,
      contentType: question.contentType,
      turnId,
      artifactId,
      fullText: artifactId ? (transcriptByArtifact.get(artifactId) ?? null) : null,
    };
  });

  const revisionRows = await orm
    .select({ next: sql<number>`coalesce(max(${reportRevisions.revision}), 0) + 1` })
    .from(reportRevisions)
    .where(eq(reportRevisions.sessionId, sessionId));
  const revision = revisionRows[0]?.next ?? 1;
  const items: Array<Record<string, unknown>> = [];

  for (const row of evidence) {
    const answer = row.fullText?.trim() ?? "";
    if (answer.length < 10) {
      items.push({
        planQuestionId: row.planQuestionId,
        competency: row.contentType,
        coverage: "insufficient",
        finding: "Insufficient transcript evidence for scoring.",
        rating: null,
      });
      continue;
    }
    try {
      const evaluation = await evaluateAnswer(userId, {
        question: {
          id: row.planQuestionId,
          prompt: row.prompt,
          competency: row.contentType,
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
          planQuestionId: row.planQuestionId,
          turnId: row.turnId,
          artifactId: row.artifactId,
          competency: dim.dimension,
          coverage: dim.rating === null ? "insufficient" : "observed",
          finding: dim.rationale,
          rating: dim.rating,
          evidenceText: dim.evidence[0] ?? null,
        });
      }
    } catch {
      items.push({
        planQuestionId: row.planQuestionId,
        competency: row.contentType,
        coverage: "insufficient",
        finding: "Evaluation failed for this answer; retry processing.",
        rating: null,
      });
    }
  }

  const summary = { items, answeredCount: evidence.filter((r) => r.fullText).length };
  const commitment = opaqueCommitment(summary);
  const candidacyId = hire?.candidacyId;
  if (!candidacyId) throw new Error("Hiring binding not found for session.");
  const reportRows = await orm
    .insert(reportRevisions)
    .values({
      sessionId,
      candidacyId,
      revision,
      revisionCommitment: commitment,
      status: "completed",
      summary,
      generatedAt: new Date(),
    })
    .returning({ id: reportRevisions.id });

  await orm
    .update(candidacies)
    .set({ status: "report_ready", updatedAt: new Date() })
    .where(eq(candidacies.id, candidacyId));
  await enqueueSolanaAction({
    action: "register_report_revision",
    candidacyId,
    expectedRevision: revision,
    payload: { sessionId, revision, commitment },
  });
  return reportRows[0]?.id;
}

async function processRetention(candidacyId: string) {
  await orm
    .update(candidacies)
    .set({
      status: "deleted",
      confirmedName: "[deleted]",
      confirmedEmail: "[deleted]",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(candidacies.id, candidacyId),
        isNotNull(candidacies.deleteAfter),
        lte(candidacies.deleteAfter, new Date()),
      ),
    );
}
