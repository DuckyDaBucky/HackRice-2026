"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { requireHiringEnabled } from "@/lib/hiring/config";
import { exchangeInvitationSecret, bindCandidateEmail } from "@/lib/hiring/invitations";
import { createPersonaInquiry, personaSandboxLabel } from "@/lib/persona/client";
import { db } from "@/lib/db";
import { createHiringInterviewSession } from "@/lib/hiring/sessions";
import { getCandidateVisibleReport } from "@/lib/hiring/reports";

export async function candidateExchangeInvitation(secret: string) {
  requireHiringEnabled();
  const invite = await exchangeInvitationSecret(secret);
  if (!invite) throw new Error("This invitation is invalid, expired, or has been revoked.");
  return {
    invitationId: invite.id,
    candidacyId: invite.candidacy_id,
    jobTitle: invite.job_title,
    orgName: invite.org_name,
    confirmedEmail: invite.confirmed_email,
    sandboxLabel: personaSandboxLabel(),
  };
}

export async function candidateBindEmail(invitationId: string) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.emailAddresses.find((e) => e.verification?.status === "verified")?.emailAddress;
  if (!email) throw new Error("Verify your email before continuing.");
  return bindCandidateEmail({ invitationId, clerkUserId: userId, verifiedEmail: email });
}

export async function candidateStartPersona(invitationId: string, candidacyId: string) {
  requireHiringEnabled();
  const inquiry = await createPersonaInquiry({
    candidacyId,
    invitationId,
    referenceId: `${candidacyId}:${invitationId}`,
  });
  await db.query(
    `INSERT INTO verification_attempts (candidacy_id, invitation_id, persona_inquiry_ref, environment, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [candidacyId, invitationId, inquiry.inquiryRef, process.env.PERSONA_ENV === "production" ? "production" : "sandbox"],
  );
  return { inquiryId: inquiry.inquiryId, sandboxLabel: personaSandboxLabel() };
}

export async function candidateGetVerificationStatus(candidacyId: string) {
  requireHiringEnabled();
  const result = await db.query(
    `SELECT status, name_match FROM verification_attempts WHERE candidacy_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [candidacyId],
  );
  const candidacy = await db.query(`SELECT status FROM candidacies WHERE id = $1`, [candidacyId]);
  return {
    verificationStatus: result.rows[0]?.status ?? "pending",
    nameMatch: result.rows[0]?.name_match,
    candidacyStatus: candidacy.rows[0]?.status,
  };
}

export async function candidateEnterInterview(candidacyId: string, invitationId: string) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return createHiringInterviewSession({ candidacyId, invitationId, clerkUserId: userId });
}

export async function candidateGetFeedback(sessionId: string) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return getCandidateVisibleReport(sessionId, userId);
}
