import "server-only";
import { db } from "@/lib/db";
import { generateQuestions } from "@/lib/workbench/ai/service";
import { requireOrgAccess } from "./access";
import { approvedQuestionSchema, type ApprovedQuestion } from "./contracts";
import { packCommitment } from "./crypto";
import { z } from "zod";

export type InterviewTemplate = "balanced" | "personality_behavioral" | "technical_behavioral";

function templateToCategoryFocus(template: InterviewTemplate | undefined) {
  if (template === "personality_behavioral") return "behavioral" as const;
  if (template === "technical_behavioral") return "technical-behavioral" as const;
  return "balanced" as const;
}

export async function generateCandidateQuestions(params: {
  organizationId: string;
  candidacyId: string;
  clerkUserId: string;
  interviewTemplate?: InterviewTemplate;
}) {
  await requireOrgAccess(params.organizationId);
  const candidacy = await db.query(
    `SELECT c.*, j.role_family, j.specialty, j.competencies, r.structured_facts, r.extracted_text
     FROM candidacies c
     JOIN hiring_jobs j ON j.id = c.job_id
     LEFT JOIN hiring_resumes r ON r.id = c.resume_id
     WHERE c.id = $1 AND c.organization_id = $2`,
    [params.candidacyId, params.organizationId],
  );
  const row = candidacy.rows[0];
  if (!row) throw new Error("Candidacy not found.");

  const profile = row.structured_facts ?? {
    experienceLevel: "unknown",
    experienceReason: "Not classified",
    sections: [],
    projects: [],
    skills: [],
    warnings: [],
  };

  const { pack } = await generateQuestions(params.clerkUserId, {
    count: 6,
    categoryFocus: templateToCategoryFocus(params.interviewTemplate),
    context: {
      useMemory: false,
      profile,
      target: {
        familyId: row.role_family,
        specialtyId: row.specialty ?? "",
        level: profile.experienceLevel ?? "unknown",
        technologies: [],
        description: row.title ?? "",
      },
    },
  });

  const questions: ApprovedQuestion[] = pack.questions.map((q, index) => ({
    id: q.id,
    position: index + 1,
    prompt: q.prompt,
    category: q.category,
    competency: q.competency,
    profileEvidence: q.profileEvidence,
    projectId: q.projectId,
    sourceQuestionId: q.sourceQuestionId,
    origin: q.origin,
    rubricId: undefined,
  }));

  return { questions, packId: pack.id };
}

export async function saveDraftQuestions(params: {
  organizationId: string;
  candidacyId: string;
  questions: ApprovedQuestion[];
}) {
  await requireOrgAccess(params.organizationId);
  const parsed = z.array(approvedQuestionSchema).parse(params.questions);
  await db.query(
    `UPDATE candidacies SET status = 'questions_pending', updated_at = now() WHERE id = $1 AND organization_id = $2`,
    [params.candidacyId, params.organizationId],
  );
  return parsed;
}

export async function approveQuestionPack(params: {
  organizationId: string;
  candidacyId: string;
  questions: ApprovedQuestion[];
  approvedByClerkUserId: string;
}) {
  await requireOrgAccess(params.organizationId);
  const parsed = z.array(approvedQuestionSchema).min(1).parse(params.questions);
  const candidacy = await db.query<{ resume_version: number }>(
    `SELECT resume_version FROM candidacies WHERE id = $1 AND organization_id = $2`,
    [params.candidacyId, params.organizationId],
  );
  const resumeVersion = candidacy.rows[0]?.resume_version ?? 1;
  const revisionResult = await db.query<{ next: number }>(
    `SELECT coalesce(max(revision), 0) + 1 AS next FROM approved_question_packs WHERE candidacy_id = $1`,
    [params.candidacyId],
  );
  const revision = revisionResult.rows[0]?.next ?? 1;
  const commitment = packCommitment(parsed, resumeVersion, revision);

  await db.query(
    `INSERT INTO approved_question_packs
       (candidacy_id, revision, resume_version, questions, pack_commitment, approved_by_clerk_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
    [params.candidacyId, revision, resumeVersion, JSON.stringify(parsed), commitment, params.approvedByClerkUserId],
  );
  await db.query(
    `UPDATE candidacies SET status = 'ready_to_invite', updated_at = now() WHERE id = $1`,
    [params.candidacyId],
  );
  return { revision, commitment };
}

export async function getLatestApprovedPack(candidacyId: string) {
  const result = await db.query(
    `SELECT * FROM approved_question_packs WHERE candidacy_id = $1 ORDER BY revision DESC LIMIT 1`,
    [candidacyId],
  );
  return result.rows[0] ?? null;
}
