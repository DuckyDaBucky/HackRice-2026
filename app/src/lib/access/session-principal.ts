import "server-only";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getV2ResumeState } from "@/lib/interviews/persistence";
import type { HiringInterviewPolicy, SessionPrincipal } from "@/lib/hiring/contracts";
import { DEFAULT_HIRING_POLICY } from "@/lib/hiring/contracts";
import { requireOrgMembership, getProvisionedOrganization } from "@/lib/hiring/access";
import { isHiringSuperadmin } from "@/lib/hiring/superadmin";
import { userHasHrAccess } from "@/lib/user-roles";

export async function resolveSessionPrincipal(sessionId: string): Promise<SessionPrincipal | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const binding = await db.query<{
    candidacy_id: string;
    organization_id: string;
    clerk_user_id: string | null;
    policy: HiringInterviewPolicy;
  }>(
    `SELECT b.candidacy_id, c.organization_id, c.clerk_user_id, b.policy
     FROM hiring_session_bindings b
     JOIN candidacies c ON c.id = b.candidacy_id
     JOIN interview_sessions s ON s.id = b.interview_session_id
     WHERE b.interview_session_id = $1 AND s.deleted_at IS NULL AND s.status <> 'deleted'`,
    [sessionId],
  );
  const hire = binding.rows[0];

  if (hire) {
    if (hire.clerk_user_id === userId) {
      return { kind: "assigned_candidate", clerkUserId: userId, sessionId, candidacyId: hire.candidacy_id };
    }
    const org = await db.query<{ clerk_org_id: string }>(
      `SELECT clerk_org_id FROM organizations WHERE id = $1`,
      [hire.organization_id],
    );
    const clerkOrgId = org.rows[0]?.clerk_org_id;
    if (clerkOrgId) {
      try {
        const membership = await requireOrgMembership(clerkOrgId);
        const provisioned = await getProvisionedOrganization(clerkOrgId);
        if (provisioned || (await isHiringSuperadmin(userId)) || (await userHasHrAccess(userId))) {
          return {
            kind: "org_recruiter",
            clerkUserId: userId,
            sessionId,
            organizationId: hire.organization_id,
            role: membership.role,
          };
        }
      } catch {
        if ((await isHiringSuperadmin(userId)) || (await userHasHrAccess(userId))) {
          return {
            kind: "org_recruiter",
            clerkUserId: userId,
            sessionId,
            organizationId: hire.organization_id,
            role: "admin",
          };
        }
        return null;
      }
    }
    return null;
  }

  const practice = await getV2ResumeState(sessionId, userId);
  if (practice) {
    return { kind: "practice_owner", clerkUserId: userId, sessionId };
  }
  return null;
}

export async function requireSessionPrincipal(sessionId: string) {
  const principal = await resolveSessionPrincipal(sessionId);
  if (!principal) throw new Error("Interview session not found.");
  return principal;
}

export async function requirePracticeOwner(sessionId: string) {
  const principal = await requireSessionPrincipal(sessionId);
  if (principal.kind !== "practice_owner") throw new Error("Interview session not found.");
  return principal;
}

export async function requireCandidateOrRecruiter(sessionId: string) {
  const principal = await requireSessionPrincipal(sessionId);
  if (principal.kind === "practice_owner") throw new Error("Interview session not found.");
  return principal;
}

export async function getHiringPolicy(sessionId: string): Promise<HiringInterviewPolicy | null> {
  const result = await db.query<{ policy: HiringInterviewPolicy }>(
    `SELECT policy FROM hiring_session_bindings WHERE interview_session_id = $1`,
    [sessionId],
  );
  return result.rows[0]?.policy ?? null;
}

export function mergeHiringPolicy(raw: unknown): HiringInterviewPolicy {
  const parsed = typeof raw === "object" && raw !== null ? raw as Partial<HiringInterviewPolicy> : {};
  return { ...DEFAULT_HIRING_POLICY, ...parsed };
}

export async function isHiringSession(sessionId: string) {
  const result = await db.query<{ session_mode: string }>(
    `SELECT session_mode FROM interview_sessions WHERE id = $1`,
    [sessionId],
  );
  return result.rows[0]?.session_mode === "hiring_recorded";
}
