import "server-only";
import { db } from "@/lib/db";
import { requireOrgAccess } from "./access";
import type { ApprovedQuestion, ReportReleaseMask } from "./contracts";
import { buildAnswerGuide, type AnswerGuideEntry } from "./answer-guide";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

export async function getHrReport(sessionId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const result = await db.query(
    `SELECT rr.*, c.confirmed_name, c.confirmed_email, j.title AS job_title,
            v.status AS verification_status, v.name_match
     FROM report_revisions rr
     JOIN candidacies c ON c.id = rr.candidacy_id
     JOIN hiring_jobs j ON j.id = c.job_id
     LEFT JOIN verification_attempts v ON v.candidacy_id = c.id
     WHERE rr.session_id = $1 AND c.organization_id = $2
     ORDER BY rr.revision DESC LIMIT 1`,
    [sessionId, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function updatePrivateNotes(sessionId: string, organizationId: string, notes: string) {
  await requireOrgAccess(organizationId);
  await db.query(
    `UPDATE report_revisions rr SET private_notes = $3
     FROM candidacies c
     WHERE rr.session_id = $1 AND rr.candidacy_id = c.id AND c.organization_id = $2`,
    [sessionId, organizationId, notes],
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

  await db.query(
    `UPDATE report_releases SET revoked_at = now()
     WHERE report_revision_id = $1 AND revoked_at IS NULL`,
    [report.id],
  );

  await db.query(
    `INSERT INTO report_releases
       (report_revision_id, release_summary, release_rubric, release_per_question, release_transcript, release_recordings, released_by_clerk_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      report.id,
      params.mask.summary,
      params.mask.rubric,
      params.mask.perQuestion,
      params.mask.transcript,
      params.mask.recordings,
      params.releasedByClerkUserId,
    ],
  );

  await enqueueSolanaAction({
    action: "update_report_permissions",
    organizationId: params.organizationId,
    candidacyId: report.candidacy_id,
    payload: { sessionId: params.sessionId, mask: params.mask },
  });
}

export async function getCandidateVisibleReport(sessionId: string, clerkUserId: string) {
  const binding = await db.query(
    `SELECT c.id AS candidacy_id FROM hiring_session_bindings b
     JOIN candidacies c ON c.id = b.candidacy_id
     WHERE b.interview_session_id = $1 AND c.clerk_user_id = $2`,
    [sessionId, clerkUserId],
  );
  if (!binding.rows[0]) return null;

  const report = await db.query(
    `SELECT rr.*, rel.*
     FROM report_revisions rr
     LEFT JOIN LATERAL (
        SELECT * FROM report_releases r WHERE r.report_revision_id = rr.id AND r.revoked_at IS NULL ORDER BY r.released_at DESC LIMIT 1
     ) rel ON true
     WHERE rr.session_id = $1 ORDER BY rr.revision DESC LIMIT 1`,
    [sessionId],
  );
  const row = report.rows[0];
  if (!row || row.revoked_at) return null;

  const summary = row.summary as Record<string, unknown>;
  const filtered: Record<string, unknown> = { sessionId };

  if (row.release_summary) filtered.summary = summary;
  if (row.release_rubric) filtered.rubric = (summary.items as unknown[])?.filter((i) => (i as { rating?: number }).rating != null);
  if (row.release_per_question) filtered.perQuestion = summary.items;
  if (row.release_transcript) filtered.transcripts = "available";
  if (row.release_recordings) filtered.recordings = "available";

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

/**
 * HR-only answer guide: approved pack expectations joined to the frozen
 * plan and latest evaluation items. Never exposed to candidates —
 * `getCandidateVisibleReport` selects no pack metadata.
 */
export async function getHrAnswerGuide(
  sessionId: string,
  organizationId: string,
): Promise<AnswerGuideEntry[]> {
  await requireOrgAccess(organizationId);

  const binding = await db.query<{ candidacy_id: string }>(
    `SELECT b.candidacy_id FROM hiring_session_bindings b
     JOIN candidacies c ON c.id = b.candidacy_id
     WHERE b.interview_session_id = $1 AND c.organization_id = $2`,
    [sessionId, organizationId],
  );
  const candidacyId = binding.rows[0]?.candidacy_id;
  if (!candidacyId) return [];

  const pack = await db.query<{ questions: unknown }>(
    `SELECT questions FROM approved_question_packs
     WHERE candidacy_id = $1 ORDER BY revision DESC LIMIT 1`,
    [candidacyId],
  );
  const rawQuestions = pack.rows[0]?.questions;
  const packQuestions: ApprovedQuestion[] = Array.isArray(rawQuestions) ? (rawQuestions as ApprovedQuestion[]) : [];

  const plan = await db.query<{ id: string; position: number; prompt: string }>(
    `SELECT id, position, prompt FROM interview_plan_questions
     WHERE session_id = $1 AND deleted_at IS NULL ORDER BY position`,
    [sessionId],
  );

  const report = await db.query<{ summary: unknown }>(
    `SELECT summary FROM report_revisions
     WHERE session_id = $1 AND candidacy_id = $2 ORDER BY revision DESC LIMIT 1`,
    [sessionId, candidacyId],
  );
  const summary = report.rows[0]?.summary as { items?: Array<Record<string, unknown>> } | undefined;

  return buildAnswerGuide(packQuestions, plan.rows, summary?.items ?? []);
}
