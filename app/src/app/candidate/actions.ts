"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { personaConfigured, personaSandboxBypassEnabled, requireHiringEnabled } from "@/lib/hiring/config";
import { confirmSandboxIdentity } from "@/lib/persona/sandbox-bypass";
import { exchangeInvitationSecret, bindCandidateEmail } from "@/lib/hiring/invitations";
import { createPersonaInquiry, fetchPersonaInquiry, personaSandboxLabel } from "@/lib/persona/client";
import { db } from "@/lib/db";
import { createHiringInterviewSession } from "@/lib/hiring/sessions";
import { getCandidateVisibleReport } from "@/lib/hiring/reports";
import { applyPersonaInquiryDecision } from "@/lib/persona/webhook";

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
    [candidacyId, invitationId, inquiry.inquiryId, process.env.PERSONA_ENV === "production" ? "production" : "sandbox"],
  );
  return {
    inquiryId: inquiry.inquiryId,
    inquiryUrl: inquiry.inquiryUrl,
    sandboxLabel: personaSandboxLabel(),
  };
}

export async function candidateGetVerificationStatus(candidacyId: string) {
  requireHiringEnabled();
  const result = await db.query<{
    status: string;
    name_match: string | null;
    persona_inquiry_ref: string;
  }>(
    `SELECT status, name_match, persona_inquiry_ref FROM verification_attempts WHERE candidacy_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [candidacyId],
  );
  const attempt = result.rows[0];

  if (
    personaConfigured() &&
    attempt?.persona_inquiry_ref &&
    !attempt.persona_inquiry_ref.startsWith("sandbox-bypass:") &&
    (attempt.status === "pending" || !attempt.status)
  ) {
    try {
      const inquiry = await fetchPersonaInquiry(attempt.persona_inquiry_ref);
      await applyPersonaInquiryDecision(inquiry);
    } catch {
      // Keep pending if Persona has not finished or the inquiry is not retrievable yet.
    }
  }

  const refreshed = await db.query(
    `SELECT status, name_match FROM verification_attempts WHERE candidacy_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [candidacyId],
  );
  const candidacy = await db.query(`SELECT status FROM candidacies WHERE id = $1`, [candidacyId]);
  return {
    verificationStatus: refreshed.rows[0]?.status ?? "pending",
    nameMatch: refreshed.rows[0]?.name_match,
    candidacyStatus: candidacy.rows[0]?.status,
    sandboxBypass: personaSandboxBypassEnabled(),
    personaAvailable: personaConfigured(),
  };
}

export async function candidateConfirmSandboxIdentity(invitationId: string, candidacyId: string) {
  requireHiringEnabled();
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");
  return confirmSandboxIdentity({ candidacyId, invitationId, clerkUserId: userId });
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
