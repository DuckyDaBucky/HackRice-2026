import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  candidacies,
  hiringJobs,
  hiringSessionBindings,
  reportReleases,
  reportRevisions,
  verificationAttempts,
} from "@/lib/db/schema";
import { requireOrgAccess } from "./access";
import type { ReportReleaseMask } from "./contracts";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

export async function getHrReport(sessionId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const rows = await orm
    .select({
      id: reportRevisions.id,
      session_id: reportRevisions.sessionId,
      candidacy_id: reportRevisions.candidacyId,
      revision: reportRevisions.revision,
      revision_commitment: reportRevisions.revisionCommitment,
      status: reportRevisions.status,
      summary: reportRevisions.summary,
      private_notes: reportRevisions.privateNotes,
      generated_at: reportRevisions.generatedAt,
      created_at: reportRevisions.createdAt,
      confirmed_name: candidacies.confirmedName,
      confirmed_email: candidacies.confirmedEmail,
      job_title: hiringJobs.title,
      verification_status: verificationAttempts.status,
      name_match: verificationAttempts.nameMatch,
    })
    .from(reportRevisions)
    .innerJoin(candidacies, eq(candidacies.id, reportRevisions.candidacyId))
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .leftJoin(verificationAttempts, eq(verificationAttempts.candidacyId, candidacies.id))
    .where(
      and(
        eq(reportRevisions.sessionId, sessionId),
        eq(candidacies.organizationId, organizationId),
      ),
    )
    .orderBy(desc(reportRevisions.revision))
    .limit(1);
  return rows[0] ?? null;
}

export async function updatePrivateNotes(sessionId: string, organizationId: string, notes: string) {
  await requireOrgAccess(organizationId);
  await orm
    .update(reportRevisions)
    .set({ privateNotes: notes })
    .where(
      and(
        eq(reportRevisions.sessionId, sessionId),
        inArray(
          reportRevisions.candidacyId,
          orm
            .select({ id: candidacies.id })
            .from(candidacies)
            .where(eq(candidacies.organizationId, organizationId)),
        ),
      ),
    );
}

export async function releaseReportSections(params: {
  sessionId: string;
  organizationId: string;
  releasedByClerkUserId: string;
  mask: ReportReleaseMask;
}) {
  await requireOrgAccess(params.organizationId);
  const report = await getHrReport(params.sessionId, params.organizationId);
  if (!report) throw new Error("Report not found.");

  await orm.transaction(async (tx) => {
    await tx
      .update(reportReleases)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(reportReleases.reportRevisionId, report.id),
          isNull(reportReleases.revokedAt),
        ),
      );

    await tx.insert(reportReleases).values({
      reportRevisionId: report.id,
      releaseSummary: params.mask.summary,
      releaseRubric: params.mask.rubric,
      releasePerQuestion: params.mask.perQuestion,
      releaseTranscript: params.mask.transcript,
      releaseRecordings: params.mask.recordings,
      releasedByClerkUserId: params.releasedByClerkUserId,
    });
  });

  await enqueueSolanaAction({
    action: "update_report_permissions",
    organizationId: params.organizationId,
    candidacyId: report.candidacy_id,
    payload: { sessionId: params.sessionId, mask: params.mask },
  });
}

export async function getCandidateVisibleReport(sessionId: string, clerkUserId: string) {
  const bindings = await orm
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
  if (!bindings[0]) return null;

  const revisions = await orm
    .select()
    .from(reportRevisions)
    .where(eq(reportRevisions.sessionId, sessionId))
    .orderBy(desc(reportRevisions.revision))
    .limit(1);
  const row = revisions[0];
  if (!row) return null;

  const releases = await orm
    .select()
    .from(reportReleases)
    .where(
      and(
        eq(reportReleases.reportRevisionId, row.id),
        isNull(reportReleases.revokedAt),
      ),
    )
    .orderBy(desc(reportReleases.releasedAt))
    .limit(1);
  const release = releases[0] ?? null;
  if (!release) {
    // A revision with releases that are all revoked must read as unshared,
    // not as an empty report. No releases at all keeps the legacy empty shape.
    const anyRelease = await orm
      .select({ id: reportReleases.id })
      .from(reportReleases)
      .where(eq(reportReleases.reportRevisionId, row.id))
      .limit(1);
    if (anyRelease.length) return null;
  }

  const summary = row.summary as Record<string, unknown>;
  const filtered: Record<string, unknown> = { sessionId };

  if (release?.releaseSummary) filtered.summary = summary;
  if (release?.releaseRubric) filtered.rubric = (summary.items as unknown[])?.filter((i) => (i as { rating?: number }).rating != null);
  if (release?.releasePerQuestion) filtered.perQuestion = summary.items;
  if (release?.releaseTranscript) filtered.transcripts = "available";
  if (release?.releaseRecordings) filtered.recordings = "available";

  return filtered;
}

export function buildFeedbackAvailableMessage(params: {
  candidateName: string;
  organizationName: string;
  feedbackUrl: string;
}) {
  return `Hi ${params.candidateName},

${params.organizationName} has shared interview feedback with you.

View your permitted feedback here: ${params.feedbackUrl}

Sign in with the email address your recruiter confirmed.`;
}
