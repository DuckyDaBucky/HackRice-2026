import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
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
  const result = await db.query<{
    id: string;
    clerk_org_id: string;
    display_name: string;
    provisioning_status: string;
  }>(
    `SELECT id, clerk_org_id, display_name, provisioning_status
     FROM organizations WHERE clerk_org_id = $1 AND provisioning_status = 'active'`,
    [clerkOrgId],
  );
  return result.rows[0] ?? null;
}

export async function provisionOrganization(params: {
  clerkOrgId: string;
  displayName: string;
}) {
  requireHiringEnabled();
  const result = await db.query<{ id: string }>(
    `INSERT INTO organizations (clerk_org_id, display_name, provisioning_status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (clerk_org_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
     RETURNING id`,
    [params.clerkOrgId, params.displayName],
  );
  return result.rows[0]?.id;
}

export async function requireOrgAccess(organizationId: string) {
  const org = await db.query<{ clerk_org_id: string }>(
    `SELECT clerk_org_id FROM organizations WHERE id = $1 AND provisioning_status = 'active'`,
    [organizationId],
  );
  const row = org.rows[0];
  if (!row) throw new Error("Organization not found.");
  const membership = await requireOrgMembership(row.clerk_org_id);
  return { ...membership, organizationId, clerkOrgId: row.clerk_org_id };
}
