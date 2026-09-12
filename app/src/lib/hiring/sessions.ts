import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  candidacies,
  hiringJobs,
  hiringSessionBindings,
  interviewPlanQuestions,
  interviewSessionConfigs,
  interviewSessions,
  mediaArtifacts,
  organizations,
} from "@/lib/db/schema";
import type { ApprovedQuestion } from "./contracts";
import { DEFAULT_HIRING_POLICY } from "./contracts";
import { getLatestApprovedPack } from "./questions";
import { enqueueSolanaAction, requireFinalizedSolanaAction } from "@/lib/solana/outbox";

export async function createHiringInterviewSession(params: {
  candidacyId: string;
  invitationId: string;
  clerkUserId: string;
}) {
  const candidacyRows = await orm
    .select({
      status: candidacies.status,
      job_title: hiringJobs.title,
      org_name: organizations.displayName,
      time_budget_seconds: hiringJobs.timeBudgetSeconds,
    })
    .from(candidacies)
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .innerJoin(organizations, eq(organizations.id, candidacies.organizationId))
    .where(
      and(
        eq(candidacies.id, params.candidacyId),
        eq(candidacies.clerkUserId, params.clerkUserId),
        inArray(candidacies.status, ["verified", "interview_in_progress"]),
      ),
    )
    .limit(1);
  const row = candidacyRows[0];
  if (!row) throw new Error("Interview access is not available.");

  const pack = await getLatestApprovedPack(params.candidacyId);
  if (!pack) throw new Error("Approved question pack not found.");

  const existing = await orm
    .select({ interviewSessionId: hiringSessionBindings.interviewSessionId })
    .from(hiringSessionBindings)
    .where(eq(hiringSessionBindings.candidacyId, params.candidacyId))
    .limit(1);
  if (existing[0]) return existing[0].interviewSessionId;

  const solanaKey = `activate:${params.invitationId}`;
  try {
    await requireFinalizedSolanaAction(`attest_identity:${params.invitationId}`);
  } catch {
    // Allow session creation when solana not yet finalized but verification is complete in DB.
    if (row.status !== "verified") throw new Error("Identity verification must complete before the interview.");
  }

  const sessionId = randomUUID();
  const questions = pack.questions as ApprovedQuestion[];

  await orm.transaction(async (tx) => {
    await tx.insert(interviewSessions).values({
      id: sessionId,
      clerkUserId: params.clerkUserId,
      mode: "behavioral",
      status: "planned",
      sessionMode: "hiring_recorded",
      activeConfigRevision: 1,
    });
    await tx.insert(interviewSessionConfigs).values({
      sessionId,
      revision: 1,
      contentTypes: ["behavioral", "technical_concepts"],
      targetRole: row.job_title,
      seniority: "mid_level",
      focusArea: row.org_name,
      timeBudgetSeconds: row.time_budget_seconds ?? 1200,
      voiceId: null,
      mood: "neutral",
    });
    for (const q of questions) {
      await tx.insert(interviewPlanQuestions).values({
        sessionId,
        configRevision: 1,
        position: q.position,
        contentType: "behavioral",
        prompt: q.prompt,
        intent: { competency: q.competency, category: q.category, evidence: q.profileEvidence },
        maxFollowUps: 0,
        status: "pending",
      });
    }
    await tx.insert(hiringSessionBindings).values({
      interviewSessionId: sessionId,
      candidacyId: params.candidacyId,
      invitationId: params.invitationId,
      packRevision: pack.revision,
      policy: DEFAULT_HIRING_POLICY,
    });
    await tx
      .update(candidacies)
      .set({ status: "interview_in_progress", updatedAt: new Date() })
      .where(eq(candidacies.id, params.candidacyId));
  });

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
  const binding = await orm
    .select({ candidacy_id: candidacies.id })
    .from(hiringSessionBindings)
    .innerJoin(candidacies, eq(candidacies.id, hiringSessionBindings.candidacyId))
    .where(
      and(
        eq(hiringSessionBindings.interviewSessionId, sessionId),
        eq(candidacies.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  const row = binding[0];
  if (!row) throw new Error("Session not found.");

  await orm.transaction(async (tx) => {
    await tx
      .update(interviewSessions)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(interviewSessions.id, sessionId));
    await tx
      .update(candidacies)
      .set({
        status: "processing",
        deleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(candidacies.id, row.candidacy_id));
  });

  const { enqueueProcessingJob } = await import("@/lib/processing/worker");
  const artifacts = await orm
    .select({ id: mediaArtifacts.id })
    .from(mediaArtifacts)
    .where(
      and(
        eq(mediaArtifacts.sessionId, sessionId),
        eq(mediaArtifacts.uploadStatus, "uploaded"),
      ),
    );
  for (const artifact of artifacts) {
    await enqueueProcessingJob({ jobType: "transcription", targetId: artifact.id, targetKind: "artifact" });
  }
  await enqueueProcessingJob({ jobType: "evaluation", targetId: sessionId, targetKind: "session" });
  await enqueueSolanaAction({
    action: "record_completion",
    candidacyId: row.candidacy_id,
    payload: { sessionId },
  });
}
