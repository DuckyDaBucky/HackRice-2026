import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, hiringJobs, invitations, organizations } from "@/lib/db/schema";
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

  await orm
    .update(invitations)
    .set({ status: "superseded", revokedAt: new Date() })
    .where(and(eq(invitations.candidacyId, params.candidacyId), eq(invitations.status, "active")));

  const deadlineAt = new Date(Date.now() + days * 86400000);
  const rows = await orm
    .insert(invitations)
    .values({
      candidacyId: params.candidacyId,
      packRevision: params.packRevision,
      secretHash,
      deadlineAt,
      recruiterContact: params.recruiterContact ?? "",
      status: "active",
    })
    .returning({ id: invitations.id, deadline_at: invitations.deadlineAt });
  const invitation = rows[0];
  if (!invitation) throw new Error("Could not create invitation.");

  await orm
    .update(candidacies)
    .set({ status: "invited", updatedAt: new Date() })
    .where(eq(candidacies.id, params.candidacyId));

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
  const rows = await orm
    .select({
      id: invitations.id,
      candidacy_id: candidacies.id,
      pack_revision: invitations.packRevision,
      secret_hash: invitations.secretHash,
      deadline_at: invitations.deadlineAt,
      recruiter_contact: invitations.recruiterContact,
      status: invitations.status,
      revoked_at: invitations.revokedAt,
      superseded_by: invitations.supersededBy,
      solana_invitation_pda: invitations.solanaInvitationPda,
      issued_at: invitations.issuedAt,
      accepted_at: invitations.acceptedAt,
      confirmed_email: candidacies.confirmedEmail,
      confirmed_name: candidacies.confirmedName,
      organization_id: candidacies.organizationId,
      job_title: hiringJobs.title,
      org_name: organizations.displayName,
    })
    .from(invitations)
    .innerJoin(candidacies, eq(candidacies.id, invitations.candidacyId))
    .innerJoin(hiringJobs, eq(hiringJobs.id, candidacies.jobId))
    .innerJoin(organizations, eq(organizations.id, candidacies.organizationId))
    .where(
      and(
        eq(invitations.secretHash, secretHash),
        eq(invitations.status, "active"),
        gt(invitations.deadlineAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !verifySecret(secret, row.secret_hash)) return null;
  return row;
}

export async function revokeInvitation(params: {
  organizationId: string;
  invitationId: string;
}) {
  await requireOrgAccess(params.organizationId);
  await orm
    .update(invitations)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(invitations.id, params.invitationId),
        eq(invitations.status, "active"),
        inArray(
          invitations.candidacyId,
          orm
            .select({ id: candidacies.id })
            .from(candidacies)
            .where(eq(candidacies.organizationId, params.organizationId)),
        ),
      ),
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
  const rows = await orm
    .select({
      id: invitations.id,
      candidacy_id: candidacies.id,
      pack_revision: invitations.packRevision,
      secret_hash: invitations.secretHash,
      deadline_at: invitations.deadlineAt,
      recruiter_contact: invitations.recruiterContact,
      status: invitations.status,
      revoked_at: invitations.revokedAt,
      superseded_by: invitations.supersededBy,
      solana_invitation_pda: invitations.solanaInvitationPda,
      issued_at: invitations.issuedAt,
      accepted_at: invitations.acceptedAt,
      confirmed_email: candidacies.confirmedEmail,
    })
    .from(invitations)
    .innerJoin(candidacies, eq(candidacies.id, invitations.candidacyId))
    .where(and(eq(invitations.id, params.invitationId), eq(invitations.status, "active")))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Invitation not found.");
  if (row.confirmed_email.toLowerCase() !== params.verifiedEmail.toLowerCase()) {
    throw new Error("Sign in with the email address your recruiter confirmed.");
  }
  await orm
    .update(candidacies)
    .set({ clerkUserId: params.clerkUserId, status: "verification_pending", updatedAt: new Date() })
    .where(eq(candidacies.id, row.candidacy_id));
  return row;
}
