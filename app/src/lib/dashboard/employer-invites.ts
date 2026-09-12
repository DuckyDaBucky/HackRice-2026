import "server-only";
import { db } from "@/lib/db";
import { hiringEnabled } from "@/lib/hiring/config";

export interface EmployerInvite {
  id: string;
  role: string;
  company: string;
  stage: string;
  dueDate: string;
  durationMinutes: number;
  href: string;
}

/** Returns real hiring invitations for dashboard integration when hiring is enabled. */
export async function listEmployerInvitesForCandidate(clerkUserId: string): Promise<EmployerInvite[]> {
  if (!hiringEnabled()) return [];

  const result = await db.query<{
    candidacy_id: string;
    job_title: string;
    org_name: string;
    status: string;
    deadline_at: Date;
    time_budget_seconds: number;
    session_id: string | null;
  }>(
    `SELECT c.id AS candidacy_id, j.title AS job_title, o.display_name AS org_name, c.status,
            i.deadline_at, j.time_budget_seconds, b.interview_session_id AS session_id
     FROM candidacies c
     JOIN hiring_jobs j ON j.id = c.job_id
     JOIN organizations o ON o.id = c.organization_id
     LEFT JOIN invitations i ON i.candidacy_id = c.id AND i.status = 'active'
     LEFT JOIN hiring_session_bindings b ON b.candidacy_id = c.id
     WHERE c.clerk_user_id = $1 AND c.status NOT IN ('deleted', 'expired', 'revoked')
     ORDER BY c.updated_at DESC LIMIT 5`,
    [clerkUserId],
  );

  return result.rows.map((row) => ({
    id: row.candidacy_id,
    role: row.job_title,
    company: row.org_name,
    stage: row.status.replaceAll("_", " "),
    dueDate: row.deadline_at?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "—",
    durationMinutes: Math.round((row.time_budget_seconds ?? 1200) / 60),
    href: row.session_id ? `/candidate/interview/${row.session_id}` : `/candidate/verify?candidacy=${row.candidacy_id}`,
  }));
}

/** @deprecated Use listEmployerInvitesForCandidate */
export const SAMPLE_EMPLOYER_INVITES: EmployerInvite[] = [];
