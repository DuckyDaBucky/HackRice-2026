import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { orm } from "@/lib/db";
import {
  approvedQuestionPacks,
  candidacies,
  hiringJobs,
  hiringResumes,
  hiringSessionBindings,
  interviewPlanQuestions,
  interviewSessionConfigs,
  interviewSessions,
  invitations,
  organizations,
  verificationAttempts,
} from "@/lib/db/schema";
import { generateInvitationSecret, hashSecret, packCommitment } from "./crypto";
import { createPersonaInquiry } from "@/lib/persona/client";
import { personaConfigured } from "./config";
import type { ApprovedQuestion } from "./contracts";

const DEMO_ORG_CLERK_ID = "demo-hackathon-org";

type CandidacyStatus = typeof candidacies.$inferSelect.status;

function demoQuestions(resumeProject: string): ApprovedQuestion[] {
  return [
    {
      id: randomUUID(),
      position: 1,
      prompt: `Walk me through your work on ${resumeProject}. What problem were you solving and what was your specific contribution?`,
      category: "behavioral",
      competency: "project ownership",
      profileEvidence: [resumeProject],
      projectId: "demo-project-1",
      sourceQuestionId: null,
      origin: "resume",
    },
    {
      id: randomUUID(),
      position: 2,
      prompt: "Describe a time you had to make a tradeoff between shipping quickly and maintaining quality. How did you decide?",
      category: "behavioral",
      competency: "judgment",
      profileEvidence: [],
      projectId: null,
      sourceQuestionId: null,
      origin: "shared",
    },
    {
      id: randomUUID(),
      position: 3,
      prompt: "Tell me about a situation where you received critical feedback. How did you respond and what changed afterward?",
      category: "behavioral",
      competency: "growth",
      profileEvidence: [],
      projectId: null,
      sourceQuestionId: null,
      origin: "shared",
    },
    {
      id: randomUUID(),
      position: 4,
      prompt: `How would you explain the architecture of ${resumeProject} to a new teammate on day one?`,
      category: "technical-behavioral",
      competency: "communication",
      profileEvidence: [resumeProject],
      projectId: "demo-project-1",
      sourceQuestionId: null,
      origin: "resume",
    },
    {
      id: randomUUID(),
      position: 5,
      prompt: "When debugging a production issue under time pressure, what is your step-by-step approach?",
      category: "technical-behavioral",
      competency: "debugging",
      profileEvidence: [],
      projectId: null,
      sourceQuestionId: null,
      origin: "shared",
    },
    {
      id: randomUUID(),
      position: 6,
      prompt: "Why are you interested in this role, and how does your recent experience prepare you for it?",
      category: "behavioral",
      competency: "motivation",
      profileEvidence: [],
      projectId: null,
      sourceQuestionId: null,
      origin: "shared",
    },
  ];
}

async function ensureApprovedPack(candidacyId: string, questions: ApprovedQuestion[]) {
  const existing = await orm
    .select({ revision: approvedQuestionPacks.revision })
    .from(approvedQuestionPacks)
    .where(eq(approvedQuestionPacks.candidacyId, candidacyId))
    .orderBy(desc(approvedQuestionPacks.revision))
    .limit(1);
  if (existing[0]) return existing[0].revision;

  const revision = 1;
  const commitment = packCommitment(questions, 1, revision);
  await orm.insert(approvedQuestionPacks).values({
    candidacyId,
    revision,
    resumeVersion: 1,
    questions,
    packCommitment: commitment,
    approvedByClerkUserId: "demo-seed",
  });
  return revision;
}

async function ensureInvitation(candidacyId: string, packRevision: number) {
  return orm.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ status: "superseded", revokedAt: new Date() })
      .where(
        and(
          eq(invitations.candidacyId, candidacyId),
          eq(invitations.status, "active"),
        ),
      );

    const secret = generateInvitationSecret();
    const rows = await tx
      .insert(invitations)
      .values({
        candidacyId,
        packRevision,
        secretHash: hashSecret(secret),
        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "active",
      })
      .returning({ id: invitations.id });
    return {
      invitationId: rows[0]!.id,
      secret,
    };
  });
}

async function ensureInterviewSession(params: {
  candidacyId: string;
  invitationId: string;
  clerkUserId: string;
  packRevision: number;
  questions: ApprovedQuestion[];
  jobTitle: string;
  orgName: string;
}) {
  const existing = await orm
    .select({ interviewSessionId: hiringSessionBindings.interviewSessionId })
    .from(hiringSessionBindings)
    .where(eq(hiringSessionBindings.candidacyId, params.candidacyId))
    .limit(1);
  if (existing[0]) return existing[0].interviewSessionId;

  const sessionId = randomUUID();
  await orm.transaction(async (tx) => {
    await tx.insert(interviewSessions).values({
      id: sessionId,
      clerkUserId: params.clerkUserId,
      mode: "behavioral",
      status: "planned",
      sessionMode: "hiring_recorded",
      activeConfigRevision: 1,
    });
    await tx.insert(interviewSessionConfigs).values({
      sessionId,
      revision: 1,
      contentTypes: ["behavioral", "technical_concepts"],
      targetRole: params.jobTitle,
      seniority: "mid_level",
      focusArea: params.orgName,
      timeBudgetSeconds: 1200,
      voiceId: null,
      mood: "neutral",
    });
    for (const q of params.questions) {
      await tx.insert(interviewPlanQuestions).values({
        sessionId,
        configRevision: 1,
        position: q.position,
        contentType: q.category === "technical-behavioral" ? "technical_concepts" : "behavioral",
        prompt: q.prompt,
        intent: { competency: q.competency, category: q.category, evidence: q.profileEvidence },
        maxFollowUps: 0,
        status: "pending",
      });
    }
    await tx.insert(hiringSessionBindings).values({
      interviewSessionId: sessionId,
      candidacyId: params.candidacyId,
      invitationId: params.invitationId,
      packRevision: params.packRevision,
      policy: {
        frozenPlan: true,
        hideFutureQuestions: true,
        allowRetakesBeforeSubmit: true,
        allowFollowUps: false,
        completionWindowSeconds: 7200,
        subtitleSize: "medium",
      },
    });
    await tx
      .update(candidacies)
      .set({ status: "interview_in_progress", updatedAt: new Date() })
      .where(eq(candidacies.id, params.candidacyId));
  });
  return sessionId;
}

export async function seedDemoHiringLinks(params: {
  origin: string;
  clerkUserId?: string;
  candidateEmail?: string;
  candidateName?: string;
}) {
  const email = params.candidateEmail ?? "demo.candidate@example.com";
  const name = params.candidateName ?? "Demo Candidate";
  const projectName = "Get Me Hired interview platform";

  const orgRows = await orm
    .insert(organizations)
    .values({
      clerkOrgId: DEMO_ORG_CLERK_ID,
      displayName: "HackRice Demo Org",
      provisioningStatus: "active",
    })
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: { displayName: "HackRice Demo Org", updatedAt: new Date() },
    })
    .returning({ id: organizations.id });
  const orgId = orgRows[0]!.id;

  let jobRows = await orm
    .select({ id: hiringJobs.id, title: hiringJobs.title })
    .from(hiringJobs)
    .where(
      and(
        eq(hiringJobs.organizationId, orgId),
        eq(hiringJobs.title, "Software Engineer (Demo)"),
        isNull(hiringJobs.deletedAt),
      ),
    )
    .orderBy(desc(hiringJobs.createdAt))
    .limit(1);
  if (!jobRows[0]) {
    jobRows = await orm
      .insert(hiringJobs)
      .values({
        organizationId: orgId,
        title: "Software Engineer (Demo)",
        description: "Demo role for hackathon validation.",
        roleFamily: "engineering",
        specialty: "fullstack",
        createdByClerkUserId: "demo-seed",
      })
      .returning({ id: hiringJobs.id, title: hiringJobs.title });
  }
  const jobId = jobRows[0]!.id;
  const jobTitle = jobRows[0]!.title;

  const resumeFacts = {
    experienceLevel: "mid",
    experienceReason: "Seeded demo profile",
    sections: [{ title: "Experience", items: [projectName] }],
    projects: [{ id: "demo-project-1", name: projectName, description: "Hackathon hiring flow with Persona and Solana." }],
    skills: ["TypeScript", "React", "PostgreSQL", "Next.js"],
    warnings: [],
  };

  const questions = demoQuestions(projectName);

  async function ensureCandidacy(demoEmail: string, displayName: string, status: string) {
    const candidacyStatus = status as CandidacyStatus;
    const found = await orm
      .select({ id: candidacies.id })
      .from(candidacies)
      .where(
        and(
          eq(candidacies.organizationId, orgId),
          eq(candidacies.confirmedEmail, demoEmail),
        ),
      )
      .orderBy(desc(candidacies.createdAt))
      .limit(1);
    let candidacyId: string;
    if (!found[0]) {
      candidacyId = await orm.transaction(async (tx) => {
        const inserted = await tx
          .insert(candidacies)
          .values({
            organizationId: orgId,
            jobId,
            confirmedName: displayName,
            confirmedEmail: demoEmail,
            status: candidacyStatus,
            resumeVersion: 1,
          })
          .returning({ id: candidacies.id });
        const id = inserted[0]!.id;
        await tx.insert(hiringResumes).values({
          organizationId: orgId,
          candidacyId: id,
          originalFilename: "demo-resume.pdf",
          r2Key: "demo/resume.pdf",
          extractedText: `Demo resume for ${projectName}`,
          structuredFacts: resumeFacts,
        });
        return id;
      });
    } else {
      candidacyId = found[0].id;
      await orm
        .update(candidacies)
        .set({ status: candidacyStatus, updatedAt: new Date() })
        .where(eq(candidacies.id, candidacyId));
    }
    const packRevision = await ensureApprovedPack(candidacyId, questions);
    return { candidacyId, packRevision };
  }

  const inviteEmail = "candidate-invite-demo@example.com";
  const personaEmail = email;
  const interviewEmail = email;

  const inviteFlow = await ensureCandidacy(inviteEmail, `${name} (Invite)`, "invited");
  const invite = await ensureInvitation(inviteFlow.candidacyId, inviteFlow.packRevision);

  const personaFlow = await ensureCandidacy(personaEmail, name, "verification_pending");
  const personaInvite = await ensureInvitation(personaFlow.candidacyId, personaFlow.packRevision);
  if (params.clerkUserId) {
    await orm
      .update(candidacies)
      .set({ clerkUserId: params.clerkUserId })
      .where(eq(candidacies.id, personaFlow.candidacyId));
  }
  let personaInquiryUrl: string | null = null;
  if (personaConfigured()) {
    try {
      const inquiry = await createPersonaInquiry({
        candidacyId: personaFlow.candidacyId,
        invitationId: personaInvite.invitationId,
        referenceId: `${personaFlow.candidacyId}:${personaInvite.invitationId}`,
      });
      personaInquiryUrl = inquiry.inquiryUrl;
      await orm.insert(verificationAttempts).values({
        candidacyId: personaFlow.candidacyId,
        invitationId: personaInvite.invitationId,
        personaInquiryRef: inquiry.inquiryId,
        environment: "sandbox",
        status: "pending",
      });
    } catch {
      personaInquiryUrl = null;
    }
  }

  let interviewSessionId: string | null = null;
  if (params.clerkUserId) {
    const interviewFlow = await ensureCandidacy(interviewEmail, name, "verified");
    const interviewInvite = await ensureInvitation(interviewFlow.candidacyId, interviewFlow.packRevision);
    await orm
      .update(candidacies)
      .set({ clerkUserId: params.clerkUserId })
      .where(eq(candidacies.id, interviewFlow.candidacyId));
    await orm.insert(verificationAttempts).values({
      candidacyId: interviewFlow.candidacyId,
      invitationId: interviewInvite.invitationId,
      personaInquiryRef: "demo-verified",
      environment: "sandbox",
      status: "verified",
      nameMatch: "match",
      boundAt: new Date(),
    });
    interviewSessionId = await ensureInterviewSession({
      candidacyId: interviewFlow.candidacyId,
      invitationId: interviewInvite.invitationId,
      clerkUserId: params.clerkUserId,
      packRevision: interviewFlow.packRevision,
      questions,
      jobTitle,
      orgName: "HackRice Demo Org",
    });
  }

  const inviteUrl = `${params.origin}/candidate/invite#${invite.secret}`;

  return {
    orgId,
    jobId,
    jobTitle,
    candidateEmail: email,
    inviteEmail,
    questions,
    links: {
      home: params.origin,
      hr: `${params.origin}/hr`,
      hrJob: `${params.origin}/hr/jobs/${jobId}?org=${orgId}`,
      signIn: `${params.origin}/sign-in`,
      invite: inviteUrl,
      personaVerify: `${params.origin}/candidate/verify?candidacy=${personaFlow.candidacyId}&invitation=${personaInvite.invitationId}`,
      personaHosted: personaInquiryUrl,
      interview: interviewSessionId ? `${params.origin}/candidate/interview/${interviewSessionId}` : null,
      feedback: interviewSessionId ? `${params.origin}/candidate/feedback/${interviewSessionId}` : null,
      devLinks: `${params.origin}/dev/hiring-links`,
    },
    note: params.clerkUserId
      ? "Interview link uses your signed-in Clerk account."
      : "Sign in at /dev/hiring-links to get a personalized interview room link.",
  };
}
