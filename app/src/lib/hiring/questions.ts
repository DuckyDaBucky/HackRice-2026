import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  approvedQuestionPacks,
  candidacies,
  hiringJobs,
  hiringResumes,
} from "@/lib/db/schema";
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
  const rows = await orm
    .select({
      role_family: hiringJobs.roleFamily,
      specialty: hiringJobs.specialty,
      structured_facts: hiringResumes.structuredFacts,
      extracted_text: hiringResumes.extractedText,
    })
    .from(candidacies)
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .leftJoin(hiringResumes, eq(hiringResumes.id, candidacies.resumeId))
    .where(and(eq(candidacies.id, params.candidacyId), eq(candidacies.organizationId, params.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Candidacy not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (row.structured_facts as any) ?? {
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
        description: "",
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
  await orm
    .update(candidacies)
    .set({ status: "questions_pending", updatedAt: new Date() })
    .where(and(eq(candidacies.id, params.candidacyId), eq(candidacies.organizationId, params.organizationId)));
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
  const candidacyRows = await orm
    .select({ resume_version: candidacies.resumeVersion })
    .from(candidacies)
    .where(and(eq(candidacies.id, params.candidacyId), eq(candidacies.organizationId, params.organizationId)))
    .limit(1);
  const resumeVersion = candidacyRows[0]?.resume_version ?? 1;
  const revisionRows = await orm
    .select({
      next: sql<number>`coalesce(max(${approvedQuestionPacks.revision}), 0) + 1`,
    })
    .from(approvedQuestionPacks)
    .where(eq(approvedQuestionPacks.candidacyId, params.candidacyId));
  const revision = revisionRows[0]?.next ?? 1;
  const commitment = packCommitment(parsed, resumeVersion, revision);

  await orm.insert(approvedQuestionPacks).values({
    candidacyId: params.candidacyId,
    revision,
    resumeVersion,
    questions: parsed,
    packCommitment: commitment,
    approvedByClerkUserId: params.approvedByClerkUserId,
  });
  await orm
    .update(candidacies)
    .set({ status: "ready_to_invite", updatedAt: new Date() })
    .where(eq(candidacies.id, params.candidacyId));
  return { revision, commitment };
}

export async function getLatestApprovedPack(candidacyId: string) {
  const rows = await orm
    .select({
      id: approvedQuestionPacks.id,
      candidacy_id: approvedQuestionPacks.candidacyId,
      revision: approvedQuestionPacks.revision,
      resume_version: approvedQuestionPacks.resumeVersion,
      questions: approvedQuestionPacks.questions,
      pack_commitment: approvedQuestionPacks.packCommitment,
      approved_by_clerk_user_id: approvedQuestionPacks.approvedByClerkUserId,
      approved_at: approvedQuestionPacks.approvedAt,
    })
    .from(approvedQuestionPacks)
    .where(eq(approvedQuestionPacks.candidacyId, candidacyId))
    .orderBy(desc(approvedQuestionPacks.revision))
    .limit(1);
  return rows[0] ?? null;
}
