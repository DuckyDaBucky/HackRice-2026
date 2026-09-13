"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  candidacies,
  hiringJobs,
  hiringResumes,
  hiringSessionBindings,
  organizations,
} from "@/lib/db/schema";
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

  await orm
    .update(organizations)
    .set({ displayName: input.companyName.trim() || "Demo Company", updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

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
  const rows = await orm
    .select({ extractedText: hiringResumes.extractedText })
    .from(candidacies)
    .innerJoin(hiringResumes, eq(hiringResumes.id, candidacies.resumeId))
    .where(and(eq(candidacies.id, candidacyId), eq(candidacies.organizationId, organizationId)))
    .limit(1);
  const text = rows[0]?.extractedText;
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

  const orgRows = await orm
    .select({ displayName: organizations.displayName })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const candidacyRows = await orm
    .select({
      confirmedName: candidacies.confirmedName,
      confirmedEmail: candidacies.confirmedEmail,
      jobTitle: hiringJobs.title,
    })
    .from(candidacies)
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .where(eq(candidacies.id, candidacyId))
    .limit(1);
  const row = candidacyRows[0];

  const issued = await issueInvitation({
    organizationId,
    candidacyId,
    packRevision: approved.revision,
    appOrigin,
    recruiterContact: row?.confirmedEmail ?? "",
  });

  const message = buildInvitationMessage({
    organizationName: orgRows[0]?.displayName ?? "Organization",
    jobTitle: row?.jobTitle ?? "Role",
    candidateName: row?.confirmedName ?? "Candidate",
    durationMinutes: 20,
    deadlineAt: issued.deadlineAt,
    invitationUrl: issued.invitationUrl,
    recruiterContact: row?.confirmedEmail ?? "",
  });

  return { ...issued, message };
}

export async function hrLiveFindSession(organizationId: string, candidacyId: string) {
  requireHiringEnabled();
  const rows = await orm
    .select({
      interviewSessionId: hiringSessionBindings.interviewSessionId,
      status: candidacies.status,
    })
    .from(hiringSessionBindings)
    .innerJoin(candidacies, eq(candidacies.id, hiringSessionBindings.candidacyId))
    .where(
      and(
        eq(hiringSessionBindings.candidacyId, candidacyId),
        eq(candidacies.organizationId, organizationId),
      ),
    )
    .limit(1);
  const row = rows[0];
  // Callers (HrLiveDemo) consume snake_case keys; map camelCase selects back.
  return row ? { interview_session_id: row.interviewSessionId, status: row.status } : null;
}
