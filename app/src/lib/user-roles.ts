import "server-only";
import { db } from "@/lib/db";
import { verifiedEmailsForUser } from "@/lib/clerk-user";
import { type AppUserRole, roleHasHrAccess } from "@/lib/user-roles.shared";

export type { AppUserRole } from "@/lib/user-roles.shared";
export { roleLabel, roleHasHrAccess } from "@/lib/user-roles.shared";

function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

export async function resolveAppUserRole(userId: string): Promise<AppUserRole> {
  let byUser;
  try {
    byUser = await db.query<{ role: AppUserRole }>(
      `SELECT role FROM app_user_roles WHERE clerk_user_id = $1 LIMIT 1`,
      [userId],
    );
  } catch (error) {
    // During rolling deploys the application can briefly start before the
    // optional role migration. Candidate practice must remain available;
    // authorization checks still default to no HR access.
    if (isUndefinedTable(error)) {
      console.warn("app_user_roles is unavailable; defaulting to candidate access");
      return "candidate";
    }
    throw error;
  }
  if (byUser.rows[0]) return byUser.rows[0].role;

  const emails = await verifiedEmailsForUser(userId);
  for (const email of emails) {
    const byEmail = await db.query<{ id: string; role: AppUserRole }>(
      `SELECT id, role FROM app_user_roles WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    if (byEmail.rows[0]) {
      await db.query(
        `UPDATE app_user_roles SET clerk_user_id = $1, updated_at = now() WHERE id = $2`,
        [userId, byEmail.rows[0].id],
      );
      return byEmail.rows[0].role;
    }
  }

  return "candidate";
}

export async function userHasHrAccess(userId: string) {
  const role = await resolveAppUserRole(userId);
  return roleHasHrAccess(role);
}
