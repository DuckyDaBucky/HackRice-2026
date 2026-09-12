"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireHiringEnabled } from "@/lib/hiring/config";
import { provisionOrganization, requireOrgMembership } from "@/lib/hiring/access";
import { resolveHiringClerkOrgId } from "@/lib/hiring/superadmin";
import { createJob } from "@/lib/hiring/jobs-service";
import {
  createCandidacyDraft,
  confirmCandidateIdentity,
  saveHiringResumeText,
  attachParsedResumeProfile,
  uploadHiringResume,
} from "@/lib/hiring/candidacies";
import {
  generateCandidateQuestions,
  approveQuestionPack,
  type InterviewTemplate,
} from "@/lib/hiring/questions";
import { issueInvitation, buildInvitationMessage } from "@/lib/hiring/invitations";
import { parseResume } from "@/lib/workbench/parser";
import type { ApprovedQuestion } from "@/lib/hiring/contracts";

export async function hrLiveCreateSession(input: {
  companyName: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
}) {
  requireHiringEnabled();
  const { userId } = await auth();
  const clerkOrgId = await resolveHiringClerkOrgId();
  if (!userId || !clerkOrgId) throw new Error("Sign in to use the HR live demo.");

  await requireOrgMembership(clerkOrgId);
  const organizationId = await provisionOrganization({
    clerkOrgId,
    displayName: input.companyName.trim() || "Demo Company",
  });
  if (!organizationId) throw new Error("Could not provision organization.");

  await db.query(`UPDATE organizations SET display_name = $2, updated_at = now() WHERE id = $1`, [
    organizationId,
    input.companyName.trim() || "Demo Company",
  ]);

  const jobId = await createJob({
    organizationId,
    title: input.jobTitle.trim() || "Open Role",
    description: `Live demo interview for ${input.jobTitle.trim()}`,
    roleFamily: "engineering",
    specialty: "general",
    createdByClerkUserId: userId,
  });
  if (!jobId) throw new Error("Could not create job.");

  const candidacyId = await createCandidacyDraft({ organizationId, jobId });
  if (!candidacyId) throw new Error("Could not create candidacy.");

  await confirmCandidateIdentity({
    organizationId,
    candidacyId,
    confirmedName: input.candidateName.trim(),
    confirmedEmail: input.candidateEmail.trim(),
  });

  return { organizationId, jobId, candidacyId };
}

export async function hrLiveSaveResumeText(
  organizationId: string,
  candidacyId: string,
  text: string,
) {
  requireHiringEnabled();
  return saveHiringResumeText({ organizationId, candidacyId, text });
}

export async function hrLiveParseResume(organizationId: string, candidacyId: string) {
  requireHiringEnabled();
  const row = await db.query<{ extracted_text: string }>(
    `SELECT r.extracted_text FROM candidacies c
     JOIN hiring_resumes r ON r.id = c.resume_id
     WHERE c.id = $1 AND c.organization_id = $2`,
    [candidacyId, organizationId],
  );
  const text = row.rows[0]?.extracted_text;
  if (!text) throw new Error("Paste or upload a resume first.");

  try {
    const { profile } = await parseResume(text);
    await attachParsedResumeProfile({ organizationId, candidacyId, profile });
    return { profile, parsed: true as const };
  } catch (error) {
    const snippet = text.slice(0, 240);
    const fallback = {
      experienceLevel: "unknown",
      experienceReason: "Live demo fallback — AI parser unavailable",
      sections: [{ title: "Experience", items: [snippet], evidence: [snippet] }],
      projects: [{ id: "project-1", name: "Recent work", description: snippet, evidence: [snippet] }],
      skills: [],
      warnings: ["Used fallback profile because AI parsing failed on stage."],
    };
    await attachParsedResumeProfile({ organizationId, candidacyId, profile: fallback });
    return {
      profile: fallback,
      parsed: false as const,
      error: error instanceof Error ? error.message : "Parser failed",
    };
  }
}

export async function hrLiveUploadResume(
  organizationId: string,
  candidacyId: string,
  formData: FormData,
) {
  requireHiringEnabled();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose a resume file.");
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadHiringResume({
    organizationId,
    candidacyId,
    buffer,
    filename: file.name,
  });
}

export async function hrLiveGenerateQuestions(
  organizationId: string,
  candidacyId: string,
  interviewTemplate: InterviewTemplate,
) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return generateCandidateQuestions({
    organizationId,
    candidacyId,
    clerkUserId: userId,
    interviewTemplate,
  });
}

export async function hrLiveApproveAndInvite(
  organizationId: string,
  candidacyId: string,
  questions: ApprovedQuestion[],
  appOrigin: string,
) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");

  const approved = await approveQuestionPack({
    organizationId,
    candidacyId,
    questions,
    approvedByClerkUserId: userId,
  });

  const org = await db.query<{ display_name: string }>(
    `SELECT display_name FROM organizations WHERE id = $1`,
    [organizationId],
  );
  const candidacy = await db.query<{ confirmed_name: string; job_title: string; confirmed_email: string }>(
    `SELECT c.confirmed_name, c.confirmed_email, j.title AS job_title
     FROM candidacies c JOIN hiring_jobs j ON j.id = c.job_id
     WHERE c.id = $1`,
    [candidacyId],
  );
  const row = candidacy.rows[0];

  const issued = await issueInvitation({
    organizationId,
    candidacyId,
    packRevision: approved.revision,
    appOrigin,
    recruiterContact: row?.confirmed_email ?? "",
  });

  const message = buildInvitationMessage({
    organizationName: org.rows[0]?.display_name ?? "Organization",
    jobTitle: row?.job_title ?? "Role",
    candidateName: row?.confirmed_name ?? "Candidate",
    durationMinutes: 20,
    deadlineAt: issued.deadlineAt,
    invitationUrl: issued.invitationUrl,
    recruiterContact: row?.confirmed_email ?? "",
  });

  return { ...issued, message };
}

export async function hrLiveFindSession(organizationId: string, candidacyId: string) {
  requireHiringEnabled();
  const binding = await db.query<{ interview_session_id: string; status: string }>(
    `SELECT b.interview_session_id, c.status
     FROM hiring_session_bindings b
     JOIN candidacies c ON c.id = b.candidacy_id
     WHERE b.candidacy_id = $1 AND c.organization_id = $2`,
    [candidacyId, organizationId],
  );
  return binding.rows[0] ?? null;
}
