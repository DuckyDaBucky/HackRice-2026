import "server-only";
import { db } from "@/lib/db";
import { requireOrgAccess } from "./access";
import { generateInvitationSecret, hashSecret, verifySecret } from "./crypto";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

export function buildInvitationMessage(params: {
  organizationName: string;
  jobTitle: string;
  candidateName: string;
  durationMinutes: number;
  deadlineAt: Date;
  invitationUrl: string;
  recruiterContact: string;
}) {
  const deadline = params.deadlineAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `Hi ${params.candidateName},

${params.organizationName} has invited you to complete a recorded interview for the ${params.jobTitle} role.

Format: recorded video interview (~${params.durationMinutes} minutes)
Deadline: ${deadline}

Before you begin, you will need to:
- Sign in with the email address your recruiter confirmed
- Complete identity verification (government ID + selfie)

Your responses will be recorded and reviewed by the hiring team. A report may be shared with you after review.

Start here: ${params.invitationUrl}

Questions? Contact: ${params.recruiterContact || "your recruiter"}

This link is private. Do not forward it.`;
}

export async function issueInvitation(params: {
  organizationId: string;
  candidacyId: string;
  packRevision: number;
  deadlineDays?: number;
  recruiterContact?: string;
  appOrigin: string;
}) {
  await requireOrgAccess(params.organizationId);
  const days = Math.min(7, Math.max(1, params.deadlineDays ?? 7));
  const secret = generateInvitationSecret();
  const secretHash = hashSecret(secret);

  await db.query(
    `UPDATE invitations SET status = 'superseded', revoked_at = now()
     WHERE candidacy_id = $1 AND status = 'active'`,
    [params.candidacyId],
  );

  const result = await db.query<{ id: string; deadline_at: Date }>(
    `INSERT INTO invitations
       (candidacy_id, pack_revision, secret_hash, deadline_at, recruiter_contact, status)
     VALUES ($1, $2, $3, now() + ($4 || ' days')::interval, $5, 'active')
     RETURNING id, deadline_at`,
    [params.candidacyId, params.packRevision, secretHash, String(days), params.recruiterContact ?? ""],
  );
  const invitation = result.rows[0];
  if (!invitation) throw new Error("Could not create invitation.");

  await db.query(
    `UPDATE candidacies SET status = 'invited', updated_at = now() WHERE id = $1`,
    [params.candidacyId],
  );

  await enqueueSolanaAction({
    action: "issue_invitation",
    organizationId: params.organizationId,
    candidacyId: params.candidacyId,
    invitationId: invitation.id,
    expectedRevision: params.packRevision,
    payload: { packRevision: params.packRevision, deadlineAt: invitation.deadline_at.toISOString() },
  });

  const invitationUrl = `${params.appOrigin}/candidate/invite#${secret}`;
  return { invitationId: invitation.id, secret, invitationUrl, deadlineAt: invitation.deadline_at };
}

export async function exchangeInvitationSecret(secret: string) {
  const secretHash = hashSecret(secret);
  const result = await db.query(
    `SELECT i.*, c.confirmed_email, c.confirmed_name, c.organization_id, c.id AS candidacy_id,
            j.title AS job_title, o.display_name AS org_name
     FROM invitations i
     JOIN candidacies c ON c.id = i.candidacy_id
     JOIN hiring_jobs j ON j.id = c.job_id
     JOIN organizations o ON o.id = c.organization_id
     WHERE i.secret_hash = $1 AND i.status = 'active' AND i.deadline_at > now()`,
    [secretHash],
  );
  const row = result.rows[0];
  if (!row || !verifySecret(secret, row.secret_hash)) return null;
  return row;
}

export async function revokeInvitation(params: {
  organizationId: string;
  invitationId: string;
}) {
  await requireOrgAccess(params.organizationId);
  await db.query(
    `UPDATE invitations SET status = 'revoked', revoked_at = now()
     WHERE id = $1 AND candidacy_id IN (
       SELECT id FROM candidacies WHERE organization_id = $2
     ) AND status = 'active'`,
    [params.invitationId, params.organizationId],
  );
  await enqueueSolanaAction({
    action: "revoke_invitation",
    organizationId: params.organizationId,
    invitationId: params.invitationId,
    payload: { invitationId: params.invitationId },
  });
}

export async function bindCandidateEmail(params: {
  invitationId: string;
  clerkUserId: string;
  verifiedEmail: string;
}) {
  const invitation = await db.query(
    `SELECT i.*, c.confirmed_email, c.id AS candidacy_id
     FROM invitations i JOIN candidacies c ON c.id = i.candidacy_id
     WHERE i.id = $1 AND i.status = 'active'`,
    [params.invitationId],
  );
  const row = invitation.rows[0];
  if (!row) throw new Error("Invitation not found.");
  if (row.confirmed_email.toLowerCase() !== params.verifiedEmail.toLowerCase()) {
    throw new Error("Sign in with the email address your recruiter confirmed.");
  }
  await db.query(
    `UPDATE candidacies SET clerk_user_id = $2, status = 'verification_pending', updated_at = now()
     WHERE id = $1`,
    [row.candidacy_id, params.clerkUserId],
  );
  return row;
}
