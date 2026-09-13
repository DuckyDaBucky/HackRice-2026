import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

export async function verifiedEmailsForUser(userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.emailAddresses
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => entry.emailAddress.toLowerCase());
}
