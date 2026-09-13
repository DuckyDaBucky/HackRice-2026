"use server";

import { auth } from "@clerk/nextjs/server";
import { requireHiringEnabled } from "@/lib/hiring/config";
import { provisionOrganization, requireOrgMembership, getProvisionedOrganization } from "@/lib/hiring/access";
import { createJob, listJobs, getJob } from "@/lib/hiring/jobs-service";
import {
  createCandidacyDraft,
  confirmCandidateIdentity,
  getCandidacy,
} from "@/lib/hiring/candidacies";
import { generateCandidateQuestions, saveDraftQuestions, approveQuestionPack, getLatestApprovedPack } from "@/lib/hiring/questions";
import { issueInvitation, buildInvitationMessage, revokeInvitation } from "@/lib/hiring/invitations";
import { getHrReport, updatePrivateNotes, releaseReportSections, getHrAnswerGuide } from "@/lib/hiring/reports";
import type { ApprovedQuestion, ReportReleaseMask } from "@/lib/hiring/contracts";

export async function setupOrganization(clerkOrgId: string, displayName: string) {
  requireHiringEnabled();
  await requireOrgMembership(clerkOrgId);
  return provisionOrganization({ clerkOrgId, displayName });
}

export async function hrCreateJob(organizationId: string, input: {
  title: string;
  description?: string;
  roleFamily: string;
  specialty?: string;
}) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return createJob({ organizationId, ...input, createdByClerkUserId: userId });
}

export async function hrListJobs(organizationId: string) {
  requireHiringEnabled();
  return listJobs(organizationId);
}

export async function hrGetJob(organizationId: string, jobId: string) {
  requireHiringEnabled();
  return getJob(jobId, organizationId);
}

export async function hrCreateCandidate(organizationId: string, jobId: string) {
  requireHiringEnabled();
  return createCandidacyDraft({ organizationId, jobId });
}

export async function hrGetCandidate(organizationId: string, candidacyId: string) {
  requireHiringEnabled();
  return getCandidacy(candidacyId, organizationId);
}

export async function hrConfirmCandidate(organizationId: string, candidacyId: string, name: string, email: string) {
  requireHiringEnabled();
  await confirmCandidateIdentity({ organizationId, candidacyId, confirmedName: name, confirmedEmail: email });
}

export async function hrGenerateQuestions(organizationId: string, candidacyId: string) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return generateCandidateQuestions({ organizationId, candidacyId, clerkUserId: userId });
}

export async function hrSaveQuestions(organizationId: string, candidacyId: string, questions: ApprovedQuestion[]) {
  requireHiringEnabled();
  return saveDraftQuestions({ organizationId, candidacyId, questions });
}

export async function hrApproveQuestions(organizationId: string, candidacyId: string, questions: ApprovedQuestion[]) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return approveQuestionPack({ organizationId, candidacyId, questions, approvedByClerkUserId: userId });
}

export async function hrIssueInvitation(organizationId: string, candidacyId: string, opts: {
  deadlineDays?: number;
  recruiterContact?: string;
  appOrigin: string;
}) {
  requireHiringEnabled();
  const pack = await getLatestApprovedPack(candidacyId);
  if (!pack) throw new Error("Approve questions before issuing an invitation.");
  const candidacy = await getCandidacy(candidacyId, organizationId);
  const issued = await issueInvitation({
    organizationId,
    candidacyId,
    packRevision: pack.revision,
    ...opts,
  });
  const message = buildInvitationMessage({
    organizationName: "Your organization",
    jobTitle: candidacy?.job_title ?? "Role",
    candidateName: candidacy?.confirmed_name ?? "there",
    durationMinutes: 20,
    deadlineAt: issued.deadlineAt,
    invitationUrl: issued.invitationUrl,
    recruiterContact: opts.recruiterContact ?? "",
  });
  return { ...issued, message };
}

export async function hrRevokeInvitation(organizationId: string, invitationId: string) {
  requireHiringEnabled();
  await revokeInvitation({ organizationId, invitationId });
}

export async function hrGetReport(organizationId: string, sessionId: string) {
  requireHiringEnabled();
  return getHrReport(sessionId, organizationId);
}

export async function hrGetAnswerGuide(organizationId: string, sessionId: string) {
  requireHiringEnabled();
  return getHrAnswerGuide(sessionId, organizationId);
}

export async function hrUpdateNotes(organizationId: string, sessionId: string, notes: string) {
  requireHiringEnabled();
  await updatePrivateNotes(sessionId, organizationId, notes);
}

export async function hrReleaseReport(organizationId: string, sessionId: string, mask: ReportReleaseMask) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  await releaseReportSections({ sessionId, organizationId, releasedByClerkUserId: userId, mask });
}

export async function hrGetOrganization(clerkOrgId: string) {
  requireHiringEnabled();
  return getProvisionedOrganization(clerkOrgId);
}
