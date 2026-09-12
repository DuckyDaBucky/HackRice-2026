import "server-only";
import { and, eq } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, invitations, verificationAttempts } from "@/lib/db/schema";
import { personaSandboxBypassEnabled } from "@/lib/hiring/config";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

export async function confirmSandboxIdentity(params: {
  candidacyId: string;
  invitationId: string;
  clerkUserId: string;
}) {
  if (!personaSandboxBypassEnabled()) {
    throw new Error("Sandbox identity confirmation is disabled.");
  }

  const rows = await orm
    .select({
      id: candidacies.id,
      clerkUserId: candidacies.clerkUserId,
      organizationId: candidacies.organizationId,
      confirmedName: candidacies.confirmedName,
      status: candidacies.status,
    })
    .from(candidacies)
    .innerJoin(invitations, eq(invitations.candidacyId, candidacies.id))
    .where(
      and(
        eq(candidacies.id, params.candidacyId),
        eq(invitations.id, params.invitationId),
        eq(invitations.status, "active"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Invitation not found.");
  if (row.clerkUserId !== params.clerkUserId) {
    throw new Error("Sign in with the email address your recruiter confirmed.");
  }

  const inquiryRef = `sandbox-bypass:${params.candidacyId}:${params.invitationId}`;
  await orm.insert(verificationAttempts).values({
    candidacyId: params.candidacyId,
    invitationId: params.invitationId,
    personaInquiryRef: inquiryRef,
    environment: "sandbox",
    status: "verified",
    nameMatch: "unknown",
    boundAt: new Date(),
  });
  await orm
    .update(candidacies)
    .set({ status: "verified", updatedAt: new Date() })
    .where(eq(candidacies.id, params.candidacyId));
  await enqueueSolanaAction({
    action: "attest_identity",
    organizationId: row.organizationId,
    candidacyId: params.candidacyId,
    invitationId: params.invitationId,
    payload: { verificationAttemptId: inquiryRef, sandboxBypass: true },
  });
  return { verificationStatus: "verified" as const, sandboxBypass: true };
}
