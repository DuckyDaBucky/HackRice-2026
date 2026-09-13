import "server-only";
import { db } from "@/lib/db";
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

  const candidacy = await db.query<{
    id: string;
    clerk_user_id: string | null;
    organization_id: string;
    confirmed_name: string;
    status: string;
  }>(
    `SELECT c.id, c.clerk_user_id, c.organization_id, c.confirmed_name, c.status
     FROM candidacies c
     JOIN invitations i ON i.candidacy_id = c.id
     WHERE c.id = $1 AND i.id = $2 AND i.status = 'active'`,
    [params.candidacyId, params.invitationId],
  );
  const row = candidacy.rows[0];
  if (!row) throw new Error("Invitation not found.");
  if (row.clerk_user_id !== params.clerkUserId) {
    throw new Error("Sign in with the email address your recruiter confirmed.");
  }

  const inquiryRef = `sandbox-bypass:${params.candidacyId}:${params.invitationId}`;
  await db.query(
    `INSERT INTO verification_attempts (candidacy_id, invitation_id, persona_inquiry_ref, environment, status, name_match, bound_at)
     VALUES ($1, $2, $3, 'sandbox', 'verified', 'unknown', now())`,
    [params.candidacyId, params.invitationId, inquiryRef],
  );
  await db.query(`UPDATE candidacies SET status = 'verified', updated_at = now() WHERE id = $1`, [params.candidacyId]);
  await enqueueSolanaAction({
    action: "attest_identity",
    organizationId: row.organization_id,
    candidacyId: params.candidacyId,
    invitationId: params.invitationId,
    payload: { verificationAttemptId: inquiryRef, sandboxBypass: true },
  });
  return { verificationStatus: "verified" as const, sandboxBypass: true };
}
