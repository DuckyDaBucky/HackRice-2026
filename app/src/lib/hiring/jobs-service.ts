import "server-only";
import { and, count, desc, eq, isNull, ne } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, hiringJobs } from "@/lib/db/schema";
import { requireOrgAccess } from "./access";

export interface CreateJobInput {
  organizationId: string;
  title: string;
  description?: string;
  roleFamily: string;
  specialty?: string;
  competencies?: string[];
  createdByClerkUserId: string;
}

export async function createJob(input: CreateJobInput) {
  await requireOrgAccess(input.organizationId);
  const rows = await orm
    .insert(hiringJobs)
    .values({
      organizationId: input.organizationId,
      title: input.title.trim(),
      description: (input.description ?? "").trim(),
      roleFamily: input.roleFamily.trim(),
      specialty: input.specialty?.trim() ?? null,
      competencies: input.competencies ?? [],
      createdByClerkUserId: input.createdByClerkUserId,
    })
    .returning({ id: hiringJobs.id });
  return rows[0]?.id;
}

export async function listJobs(organizationId: string) {
  await requireOrgAccess(organizationId);
  const rows = await orm
    .select({
      id: hiringJobs.id,
      organization_id: hiringJobs.organizationId,
      title: hiringJobs.title,
      description: hiringJobs.description,
      role_family: hiringJobs.roleFamily,
      specialty: hiringJobs.specialty,
      competencies: hiringJobs.competencies,
      question_count: hiringJobs.questionCount,
      time_budget_seconds: hiringJobs.timeBudgetSeconds,
      language: hiringJobs.language,
      shared_question_count: hiringJobs.sharedQuestionCount,
      personalized_question_count: hiringJobs.personalizedQuestionCount,
      allow_live_follow_ups: hiringJobs.allowLiveFollowUps,
      created_by_clerk_user_id: hiringJobs.createdByClerkUserId,
      created_at: hiringJobs.createdAt,
      updated_at: hiringJobs.updatedAt,
      deleted_at: hiringJobs.deletedAt,
      candidate_count: count(candidacies.id),
    })
    .from(hiringJobs)
    .leftJoin(
      candidacies,
      and(eq(candidacies.jobId, hiringJobs.id), ne(candidacies.status, "deleted")),
    )
    .where(and(eq(hiringJobs.organizationId, organizationId), isNull(hiringJobs.deletedAt)))
    .groupBy(hiringJobs.id)
    .orderBy(desc(hiringJobs.createdAt));
  return rows;
}

export async function getJob(jobId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const rows = await orm
    .select({
      id: hiringJobs.id,
      organization_id: hiringJobs.organizationId,
      title: hiringJobs.title,
      description: hiringJobs.description,
      role_family: hiringJobs.roleFamily,
      specialty: hiringJobs.specialty,
      competencies: hiringJobs.competencies,
      question_count: hiringJobs.questionCount,
      time_budget_seconds: hiringJobs.timeBudgetSeconds,
      language: hiringJobs.language,
      shared_question_count: hiringJobs.sharedQuestionCount,
      personalized_question_count: hiringJobs.personalizedQuestionCount,
      allow_live_follow_ups: hiringJobs.allowLiveFollowUps,
      created_by_clerk_user_id: hiringJobs.createdByClerkUserId,
      created_at: hiringJobs.createdAt,
      updated_at: hiringJobs.updatedAt,
      deleted_at: hiringJobs.deletedAt,
    })
    .from(hiringJobs)
    .where(
      and(
        eq(hiringJobs.id, jobId),
        eq(hiringJobs.organizationId, organizationId),
        isNull(hiringJobs.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
