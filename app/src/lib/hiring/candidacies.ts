import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { extractResume } from "@/lib/workbench/extraction";
import { classifyExperience } from "@/lib/workbench/experience";
import { requireOrgAccess } from "./access";
import { createUploadUrl } from "@/lib/storage/r2";

export async function createCandidacyDraft(params: {
  organizationId: string;
  jobId: string;
}) {
  await requireOrgAccess(params.organizationId);
  const result = await db.query<{ id: string }>(
    `INSERT INTO candidacies (organization_id, job_id, confirmed_name, confirmed_email, status)
     VALUES ($1, $2, '', '', 'draft')
     RETURNING id`,
    [params.organizationId, params.jobId],
  );
  return result.rows[0]?.id;
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

  await db.query(
    `INSERT INTO hiring_resumes
       (id, organization_id, candidacy_id, original_filename, r2_key, extracted_text, structured_facts)
     VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
    [resumeId, params.organizationId, params.candidacyId, params.filename, r2Key, text],
  );
  await db.query(
    `UPDATE candidacies SET resume_id = $2, resume_version = 1, status = 'questions_pending', updated_at = now()
     WHERE id = $1`,
    [params.candidacyId, resumeId],
  );
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
  await db.query(
    `INSERT INTO hiring_resumes
       (id, organization_id, candidacy_id, original_filename, r2_key, extracted_text, structured_facts)
     VALUES ($1, $2, $3, 'pasted-resume.txt', $4, $5, $6::jsonb)`,
    [
      resumeId,
      params.organizationId,
      params.candidacyId,
      `hiring/${params.organizationId}/${params.candidacyId}/${resumeId}`,
      text,
      JSON.stringify(params.structuredFacts ?? {}),
    ],
  );
  await db.query(
    `UPDATE candidacies SET resume_id = $2, resume_version = 1, status = 'questions_pending', updated_at = now()
     WHERE id = $1`,
    [params.candidacyId, resumeId],
  );
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
  await db.query(
    `UPDATE hiring_resumes SET structured_facts = $2::jsonb WHERE id = $1`,
    [candidacy.resume_id, JSON.stringify(params.profile)],
  );
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

  await db.query(
    `UPDATE candidacies
     SET confirmed_name = $3, confirmed_email = $4, status = 'questions_pending', updated_at = now()
     WHERE id = $1 AND organization_id = $2`,
    [params.candidacyId, params.organizationId, params.confirmedName.trim(), email],
  );
}

export async function getCandidacy(candidacyId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const result = await db.query(
    `SELECT c.*, j.title AS job_title, r.extracted_text, r.structured_facts
     FROM candidacies c
     JOIN hiring_jobs j ON j.id = c.job_id
     LEFT JOIN hiring_resumes r ON r.id = c.resume_id
     WHERE c.id = $1 AND c.organization_id = $2`,
    [candidacyId, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function classifyCandidacyExperience(candidacyId: string, organizationId: string) {
  const candidacy = await getCandidacy(candidacyId, organizationId);
  if (!candidacy?.structured_facts && !candidacy?.extracted_text) {
    throw new Error("Resume must be uploaded before classification.");
  }
  const profile = candidacy.structured_facts ?? { sections: [], projects: [], skills: [], warnings: [] };
  const classification = await classifyExperience(profile);
  await db.query(
    `UPDATE hiring_resumes SET structured_facts = structured_facts || $2::jsonb
     WHERE id = $1`,
    [candidacy.resume_id, JSON.stringify({ experienceClassification: classification })],
  );
  return classification;
}
