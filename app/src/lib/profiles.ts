import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { orm } from "./db";
import { accountProfiles } from "./db/schema";
import { resumeSchema, type Resume } from "./workbench/schemas";
import { WorkbenchError } from "./workbench/errors";

export function profileNamespace() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) throw new WorkbenchError("AUTH_CONFIG", "Clerk is not configured.", 503);
  return createHash("sha256").update(key).digest("hex");
}
export async function getProfile(userId: string) {
  const rows = await orm
    .select({
      profile: accountProfiles.profile,
      version: accountProfiles.version,
      updatedAt: accountProfiles.updatedAt,
      classifiedAt: accountProfiles.classifiedAt,
    })
    .from(accountProfiles)
    .where(
      and(
        eq(accountProfiles.clerkInstance, profileNamespace()),
        eq(accountProfiles.clerkUserId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        profile: resumeSchema.parse(row.profile),
        version: row.version,
        updatedAt: row.updatedAt,
        classifiedAt: row.classifiedAt,
      }
    : null;
}

export async function saveProfile(userId: string, profile: Resume, version: number | null) {
  const value = resumeSchema.parse(profile);
  const namespace = profileNamespace();
  // JSON round-trip keeps the stored document byte-identical to the old
  // raw-SQL path (which passed JSON.stringify), not Drizzle's serializer.
  const document = JSON.parse(JSON.stringify(value)) as unknown;
  const returned =
    version === null
      ? await orm
          .insert(accountProfiles)
          .values({ clerkInstance: namespace, clerkUserId: userId, profile: document })
          .onConflictDoNothing()
          .returning({ version: accountProfiles.version })
      : await orm
          .update(accountProfiles)
          .set({
            profile: document,
            version: sql`${accountProfiles.version} + 1`,
            updatedAt: new Date(),
            classifiedAt: new Date(),
          })
          .where(
            and(
              eq(accountProfiles.clerkInstance, namespace),
              eq(accountProfiles.clerkUserId, userId),
              eq(accountProfiles.version, version),
            ),
          )
          .returning({ version: accountProfiles.version });
  if (returned.length === 0)
    throw new WorkbenchError(
      "PROFILE_CONFLICT",
      "Your profile changed in another tab. Load the saved profile before saving again.",
      409,
    );
  return getProfile(userId);
}
