import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, hiringJobs, hiringResumes } from "@/lib/db/schema";
import type { Resume } from "@/lib/workbench/schemas";
import { extractResume } from "@/lib/workbench/extraction";
import { classifyExperience } from "@/lib/workbench/experience";
import { requireOrgAccess } from "./access";
import { createUploadUrl } from "@/lib/storage/r2";

export async function createCandidacyDraft(params: {
  organizationId: string;
  jobId: string;
}) {
  await requireOrgAccess(params.organizationId);
  const rows = await orm
    .insert(candidacies)
    .values({
      organizationId: params.organizationId,
      jobId: params.jobId,
      confirmedName: "",
      confirmedEmail: "",
      status: "draft",
    })
    .returning({ id: candidacies.id });
  return rows[0]?.id;
}

export async function uploadHiringResume(params: {
  organizationId: string;
  candidacyId: string;
  buffer: Buffer;
  filename: string;
}) {
  await requireOrgAccess(params.organizationId);
  const { text } = await extractResume(params.buffer, params.filename);
  const resumeId = randomUUID();
  const r2Key = `hiring/${params.organizationId}/${params.candidacyId}/${resumeId}`;
  const uploadUrl = await createUploadUrl(r2Key, "application/octet-stream");

  await orm.transaction(async (tx) => {
    await tx.insert(hiringResumes).values({
      id: resumeId,
      organizationId: params.organizationId,
      candidacyId: params.candidacyId,
      originalFilename: params.filename,
      r2Key,
      extractedText: text,
      structuredFacts: {},
    });
    await tx
      .update(candidacies)
      .set({
        resumeId,
        resumeVersion: 1,
        status: "questions_pending",
        updatedAt: new Date(),
      })
      .where(eq(candidacies.id, params.candidacyId));
  });
  return { resumeId, uploadUrl, extractedText: text };
}

export async function saveHiringResumeText(params: {
  organizationId: string;
  candidacyId: string;
  text: string;
  structuredFacts?: Record<string, unknown>;
}) {
  await requireOrgAccess(params.organizationId);
  const text = params.text.trim();
  if (text.length < 40) throw new Error("Paste at least a few lines of resume text.");

  const resumeId = randomUUID();
  await orm.transaction(async (tx) => {
    await tx.insert(hiringResumes).values({
      id: resumeId,
      organizationId: params.organizationId,
      candidacyId: params.candidacyId,
      originalFilename: "pasted-resume.txt",
      r2Key: `hiring/${params.organizationId}/${params.candidacyId}/${resumeId}`,
      extractedText: text,
      structuredFacts: params.structuredFacts ?? {},
    });
    await tx
      .update(candidacies)
      .set({
        resumeId,
        resumeVersion: 1,
        status: "questions_pending",
        updatedAt: new Date(),
      })
      .where(eq(candidacies.id, params.candidacyId));
  });
  return { resumeId, extractedText: text };
}

export async function attachParsedResumeProfile(params: {
  organizationId: string;
  candidacyId: string;
  profile: Record<string, unknown>;
}) {
  await requireOrgAccess(params.organizationId);
  const candidacy = await getCandidacy(params.candidacyId, params.organizationId);
  if (!candidacy?.resume_id) throw new Error("Upload or paste a resume first.");
  await orm
    .update(hiringResumes)
    .set({ structuredFacts: params.profile })
    .where(eq(hiringResumes.id, candidacy.resume_id));
}

export async function confirmCandidateIdentity(params: {
  organizationId: string;
  candidacyId: string;
  confirmedName: string;
  confirmedEmail: string;
}) {
  await requireOrgAccess(params.organizationId);
  const email = params.confirmedEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("A valid email address is required.");
  if (!params.confirmedName.trim()) throw new Error("Candidate name is required.");

  await orm
    .update(candidacies)
    .set({
      confirmedName: params.confirmedName.trim(),
      confirmedEmail: email,
      status: "questions_pending",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(candidacies.id, params.candidacyId),
        eq(candidacies.organizationId, params.organizationId),
      ),
    );
}

export async function getCandidacy(candidacyId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const rows = await orm
    .select({
      id: candidacies.id,
      organization_id: candidacies.organizationId,
      job_id: candidacies.jobId,
      confirmed_name: candidacies.confirmedName,
      confirmed_email: candidacies.confirmedEmail,
      resume_id: candidacies.resumeId,
      resume_version: candidacies.resumeVersion,
      clerk_user_id: candidacies.clerkUserId,
      status: candidacies.status,
      delete_after: candidacies.deleteAfter,
      created_at: candidacies.createdAt,
      updated_at: candidacies.updatedAt,
      job_title: hiringJobs.title,
      extracted_text: hiringResumes.extractedText,
      structured_facts: hiringResumes.structuredFacts,
    })
    .from(candidacies)
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .leftJoin(hiringResumes, eq(hiringResumes.id, candidacies.resumeId))
    .where(
      and(
        eq(candidacies.id, candidacyId),
        eq(candidacies.organizationId, organizationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function classifyCandidacyExperience(candidacyId: string, organizationId: string) {
  const candidacy = await getCandidacy(candidacyId, organizationId);
  if (!candidacy?.structured_facts && !candidacy?.extracted_text) {
    throw new Error("Resume must be uploaded before classification.");
  }
  const profile = (candidacy.structured_facts ?? {
    sections: [],
    projects: [],
    skills: [],
    warnings: [],
  }) as Resume;
  const classification = await classifyExperience(profile);
  await orm
    .update(hiringResumes)
    .set({
      structuredFacts: sql`${hiringResumes.structuredFacts} || ${JSON.stringify({ experienceClassification: classification })}::jsonb`,
    })
    .where(eq(hiringResumes.id, candidacy.resume_id as string));
  return classification;
}
