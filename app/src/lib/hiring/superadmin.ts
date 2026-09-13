import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";

export function hiringSuperadminEmails() {
  return (process.env.HIRING_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function personalClerkOrgId(userId: string) {
  return `personal_${userId}`;
}

export async function verifiedEmailsForUser(userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.emailAddresses
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => entry.emailAddress.toLowerCase());
}

export async function isHiringSuperadmin(userId: string) {
  const allow = hiringSuperadminEmails();
  if (allow.length === 0) return false;
  const emails = await verifiedEmailsForUser(userId);
  return emails.some((email) => allow.includes(email));
}

/** Clerk org for HR routes — uses active org or a personal org for superadmins. */
export async function resolveHiringClerkOrgId() {
  const { userId, orgId } = await auth();
  if (!userId) return null;
  if (orgId) return orgId;
  if (await isHiringSuperadmin(userId)) return personalClerkOrgId(userId);
  return null;
}
