"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { personaConfigured, personaSandboxBypassEnabled, requireHiringEnabled } from "@/lib/hiring/config";
import { confirmSandboxIdentity } from "@/lib/persona/sandbox-bypass";
import { exchangeInvitationSecret, bindCandidateEmail } from "@/lib/hiring/invitations";
import { createPersonaInquiry, fetchPersonaInquiry, personaSandboxLabel } from "@/lib/persona/client";
import { orm } from "@/lib/db";
import { candidacies, verificationAttempts } from "@/lib/db/schema";
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
  await orm.insert(verificationAttempts).values({
    candidacyId,
    invitationId,
    personaInquiryRef: inquiry.inquiryId,
    environment: process.env.PERSONA_ENV === "production" ? "production" : "sandbox",
    status: "pending",
  });
  return {
    inquiryId: inquiry.inquiryId,
    inquiryUrl: inquiry.inquiryUrl,
    sandboxLabel: personaSandboxLabel(),
  };
}

export async function candidateGetVerificationStatus(candidacyId: string) {
  requireHiringEnabled();
  const rows = await orm
    .select({
      status: verificationAttempts.status,
      nameMatch: verificationAttempts.nameMatch,
      personaInquiryRef: verificationAttempts.personaInquiryRef,
    })
    .from(verificationAttempts)
    .where(eq(verificationAttempts.candidacyId, candidacyId))
    .orderBy(desc(verificationAttempts.createdAt))
    .limit(1);
  const attempt = rows[0];

  if (
    personaConfigured() &&
    attempt?.personaInquiryRef &&
    !attempt.personaInquiryRef.startsWith("sandbox-bypass:") &&
    (attempt.status === "pending" || !attempt.status)
  ) {
    try {
      const inquiry = await fetchPersonaInquiry(attempt.personaInquiryRef);
      await applyPersonaInquiryDecision(inquiry);
    } catch {
      // Keep pending if Persona has not finished or the inquiry is not retrievable yet.
    }
  }

  const refreshedRows = await orm
    .select({
      status: verificationAttempts.status,
      nameMatch: verificationAttempts.nameMatch,
    })
    .from(verificationAttempts)
    .where(eq(verificationAttempts.candidacyId, candidacyId))
    .orderBy(desc(verificationAttempts.createdAt))
    .limit(1);
  const candidacyRows = await orm
    .select({ status: candidacies.status })
    .from(candidacies)
    .where(eq(candidacies.id, candidacyId))
    .limit(1);
  return {
    verificationStatus: refreshedRows[0]?.status ?? "pending",
    nameMatch: refreshedRows[0]?.nameMatch,
    candidacyStatus: candidacyRows[0]?.status,
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
