import "server-only";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, hiringSessionBindings, interviewSessions, organizations } from "@/lib/db/schema";
import { getV2ResumeState } from "@/lib/interviews/persistence";
import type { HiringInterviewPolicy, SessionPrincipal } from "@/lib/hiring/contracts";
import { DEFAULT_HIRING_POLICY } from "@/lib/hiring/contracts";
import { requireOrgMembership, getProvisionedOrganization } from "@/lib/hiring/access";
import { isHiringSuperadmin } from "@/lib/hiring/superadmin";

export async function resolveSessionPrincipal(sessionId: string): Promise<SessionPrincipal | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await orm
    .select({
      candidacyId: hiringSessionBindings.candidacyId,
      organizationId: candidacies.organizationId,
      clerkUserId: candidacies.clerkUserId,
    })
    .from(hiringSessionBindings)
    .innerJoin(candidacies, eq(candidacies.id, hiringSessionBindings.candidacyId))
    .innerJoin(interviewSessions, eq(interviewSessions.id, hiringSessionBindings.interviewSessionId))
    .where(
      and(
        eq(hiringSessionBindings.interviewSessionId, sessionId),
        isNull(interviewSessions.deletedAt),
        ne(interviewSessions.status, "deleted"),
      ),
    )
    .limit(1);
  const hire = rows[0];

  if (hire) {
    if (hire.clerkUserId === userId) {
      return { kind: "assigned_candidate", clerkUserId: userId, sessionId, candidacyId: hire.candidacyId };
    }
    const orgRows = await orm
      .select({ clerkOrgId: organizations.clerkOrgId })
      .from(organizations)
      .where(eq(organizations.id, hire.organizationId))
      .limit(1);
    const clerkOrgId = orgRows[0]?.clerkOrgId;
    if (clerkOrgId) {
      try {
        const membership = await requireOrgMembership(clerkOrgId);
        const provisioned = await getProvisionedOrganization(clerkOrgId);
        if (provisioned || (await isHiringSuperadmin(userId))) {
          return {
            kind: "org_recruiter",
            clerkUserId: userId,
            sessionId,
            organizationId: hire.organizationId,
            role: membership.role,
          };
        }
      } catch {
        if (await isHiringSuperadmin(userId)) {
          return {
            kind: "org_recruiter",
            clerkUserId: userId,
            sessionId,
            organizationId: hire.organizationId,
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
  const rows = await orm
    .select({ policy: hiringSessionBindings.policy })
    .from(hiringSessionBindings)
    .where(eq(hiringSessionBindings.interviewSessionId, sessionId))
    .limit(1);
  return (rows[0]?.policy as HiringInterviewPolicy | undefined) ?? null;
}

export function mergeHiringPolicy(raw: unknown): HiringInterviewPolicy {
  const parsed = typeof raw === "object" && raw !== null ? raw as Partial<HiringInterviewPolicy> : {};
  return { ...DEFAULT_HIRING_POLICY, ...parsed };
}

export async function isHiringSession(sessionId: string) {
  const rows = await orm
    .select({ sessionMode: interviewSessions.sessionMode })
    .from(interviewSessions)
    .where(eq(interviewSessions.id, sessionId))
    .limit(1);
  return rows[0]?.sessionMode === "hiring_recorded";
}
