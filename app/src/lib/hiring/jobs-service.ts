import "server-only";
import { db } from "@/lib/db";
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
  const result = await db.query<{ id: string }>(
    `INSERT INTO hiring_jobs
       (organization_id, title, description, role_family, specialty, competencies, created_by_clerk_user_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [
      input.organizationId,
      input.title.trim(),
      (input.description ?? "").trim(),
      input.roleFamily.trim(),
      input.specialty?.trim() ?? null,
      JSON.stringify(input.competencies ?? []),
      input.createdByClerkUserId,
    ],
  );
  return result.rows[0]?.id;
}

export async function listJobs(organizationId: string) {
  await requireOrgAccess(organizationId);
  const result = await db.query(
    `SELECT j.*, count(c.id)::int AS candidate_count
     FROM hiring_jobs j
     LEFT JOIN candidacies c ON c.job_id = j.id AND c.status <> 'deleted'
     WHERE j.organization_id = $1 AND j.deleted_at IS NULL
     GROUP BY j.id
     ORDER BY j.created_at DESC`,
    [organizationId],
  );
  return result.rows;
}

export async function getJob(jobId: string, organizationId: string) {
  await requireOrgAccess(organizationId);
  const result = await db.query(
    `SELECT * FROM hiring_jobs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [jobId, organizationId],
  );
  return result.rows[0] ?? null;
}
