import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { orm } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { requireHiringEnabled } from "./config";
import { isHiringSuperadmin } from "./superadmin";

export type OrgRole = "admin" | "recruiter";

export async function requireSignedInUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return userId;
}

export async function requireOrgMembership(clerkOrgId: string): Promise<{ userId: string; role: OrgRole }> {
  requireHiringEnabled();
  const userId = await requireSignedInUser();
  if (await isHiringSuperadmin(userId)) {
    return { userId, role: "admin" };
  }
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({ userId });
  const membership = memberships.data.find((m) => m.organization.id === clerkOrgId);
  if (!membership) throw new Error("You are not a member of this organization.");

  const role = membership.role;
  if (role === "org:admin") return { userId, role: "admin" };
  if (role === "org:member") return { userId, role: "recruiter" };
  throw new Error("Insufficient organization permissions.");
}

export async function getProvisionedOrganization(clerkOrgId: string) {
  const rows = await orm
    .select({
      id: organizations.id,
      clerk_org_id: organizations.clerkOrgId,
      display_name: organizations.displayName,
      provisioning_status: organizations.provisioningStatus,
    })
    .from(organizations)
    .where(and(eq(organizations.clerkOrgId, clerkOrgId), eq(organizations.provisioningStatus, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function provisionOrganization(params: {
  clerkOrgId: string;
  displayName: string;
}) {
  requireHiringEnabled();
  const rows = await orm
    .insert(organizations)
    .values({
      clerkOrgId: params.clerkOrgId,
      displayName: params.displayName,
      provisioningStatus: "active",
    })
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: { displayName: params.displayName, updatedAt: new Date() },
    })
    .returning({ id: organizations.id });
  return rows[0]?.id;
}

export async function requireOrgAccess(organizationId: string) {
  const rows = await orm
    .select({ clerk_org_id: organizations.clerkOrgId })
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.provisioningStatus, "active")))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Organization not found.");
  const membership = await requireOrgMembership(row.clerk_org_id);
  return { ...membership, organizationId, clerkOrgId: row.clerk_org_id };
}
