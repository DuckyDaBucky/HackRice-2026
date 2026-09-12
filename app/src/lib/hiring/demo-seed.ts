import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { generateInvitationSecret, hashSecret, packCommitment } from "./crypto";
import { createPersonaInquiry } from "@/lib/persona/client";
import { personaConfigured } from "./config";
import type { ApprovedQuestion } from "./contracts";

const DEMO_ORG_CLERK_ID = "demo-hackathon-org";

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
  const existing = await db.query(
    `SELECT revision FROM approved_question_packs WHERE candidacy_id = $1 ORDER BY revision DESC LIMIT 1`,
    [candidacyId],
  );
  if (existing.rows[0]) return existing.rows[0].revision as number;

  const revision = 1;
  const commitment = packCommitment(questions, 1, revision);
  await db.query(
    `INSERT INTO approved_question_packs
       (candidacy_id, revision, resume_version, questions, pack_commitment, approved_by_clerk_user_id)
     VALUES ($1, $2, 1, $3::jsonb, $4, 'demo-seed')`,
    [candidacyId, revision, JSON.stringify(questions), commitment],
  );
  return revision;
}

async function ensureInvitation(candidacyId: string, packRevision: number) {
  await db.query(
    `UPDATE invitations SET status = 'superseded', revoked_at = now()
     WHERE candidacy_id = $1 AND status = 'active'`,
    [candidacyId],
  );

  const secret = generateInvitationSecret();
  const result = await db.query<{ id: string }>(
    `INSERT INTO invitations (candidacy_id, pack_revision, secret_hash, deadline_at, status)
     VALUES ($1, $2, $3, now() + interval '7 days', 'active') RETURNING id`,
    [candidacyId, packRevision, hashSecret(secret)],
  );
  return {
    invitationId: result.rows[0]!.id,
    secret,
  };
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
  const existing = await db.query<{ interview_session_id: string }>(
    `SELECT interview_session_id FROM hiring_session_bindings WHERE candidacy_id = $1`,
    [params.candidacyId],
  );
  if (existing.rows[0]) return existing.rows[0].interview_session_id;

  const sessionId = randomUUID();
  await db.query(
    `INSERT INTO interview_sessions (id, clerk_user_id, mode, status, session_mode, active_config_revision)
     VALUES ($1, $2, 'behavioral', 'planned', 'hiring_recorded', 1)`,
    [sessionId, params.clerkUserId],
  );
  await db.query(
    `INSERT INTO interview_session_configs
       (session_id, revision, content_types, target_role, seniority, focus_area, time_budget_seconds, voice_id, mood)
     VALUES ($1, 1, $2, $3, 'mid_level', $4, 1200, null, 'neutral')`,
    [sessionId, ["behavioral", "technical_concepts"], params.jobTitle, params.orgName],
  );
  for (const q of params.questions) {
    await db.query(
      `INSERT INTO interview_plan_questions
         (session_id, config_revision, position, content_type, prompt, intent, max_follow_ups, status)
       VALUES ($1, 1, $2, $3, $4, $5::jsonb, 0, 'pending')`,
      [
        sessionId,
        q.position,
        q.category === "technical-behavioral" ? "technical_concepts" : "behavioral",
        q.prompt,
        JSON.stringify({ competency: q.competency, category: q.category, evidence: q.profileEvidence }),
      ],
    );
  }
  await db.query(
    `INSERT INTO hiring_session_bindings (interview_session_id, candidacy_id, invitation_id, pack_revision, policy)
     VALUES ($1, $2, $3, $4, '{"frozenPlan":true,"hideFutureQuestions":true,"allowRetakesBeforeSubmit":true,"allowFollowUps":false,"completionWindowSeconds":7200,"subtitleSize":"medium"}'::jsonb)`,
    [sessionId, params.candidacyId, params.invitationId, params.packRevision],
  );
  await db.query(`UPDATE candidacies SET status = 'interview_in_progress', updated_at = now() WHERE id = $1`, [params.candidacyId]);
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

  const org = await db.query<{ id: string }>(
    `INSERT INTO organizations (clerk_org_id, display_name, provisioning_status)
     VALUES ($1, 'HackRice Demo Org', 'active')
     ON CONFLICT (clerk_org_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
     RETURNING id`,
    [DEMO_ORG_CLERK_ID],
  );
  const orgId = org.rows[0]!.id;

  let job = await db.query<{ id: string; title: string }>(
    `SELECT id, title FROM hiring_jobs
     WHERE organization_id = $1 AND title = 'Software Engineer (Demo)' AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [orgId],
  );
  if (!job.rows[0]) {
    job = await db.query<{ id: string; title: string }>(
      `INSERT INTO hiring_jobs (organization_id, title, description, role_family, specialty, created_by_clerk_user_id)
       VALUES ($1, 'Software Engineer (Demo)', 'Demo role for hackathon validation.', 'engineering', 'fullstack', 'demo-seed')
       RETURNING id, title`,
      [orgId],
    );
  }
  const jobId = job.rows[0]!.id;
  const jobTitle = job.rows[0]!.title;

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
    let row = await db.query<{ id: string }>(
      `SELECT id FROM candidacies WHERE organization_id = $1 AND confirmed_email = $2 ORDER BY created_at DESC LIMIT 1`,
      [orgId, demoEmail],
    );
    if (!row.rows[0]) {
      row = await db.query<{ id: string }>(
        `INSERT INTO candidacies (organization_id, job_id, confirmed_name, confirmed_email, status, resume_version)
         VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
        [orgId, jobId, displayName, demoEmail, status],
      );
      await db.query(
        `INSERT INTO hiring_resumes (organization_id, candidacy_id, original_filename, r2_key, extracted_text, structured_facts)
         VALUES ($1, $2, 'demo-resume.pdf', 'demo/resume.pdf', $3, $4::jsonb)`,
        [orgId, row.rows[0]!.id, `Demo resume for ${projectName}`, JSON.stringify(resumeFacts)],
      );
    } else {
      await db.query(`UPDATE candidacies SET status = $2, updated_at = now() WHERE id = $1`, [row.rows[0]!.id, status]);
    }
    const candidacyId = row.rows[0]!.id;
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
    await db.query(`UPDATE candidacies SET clerk_user_id = $2 WHERE id = $1`, [personaFlow.candidacyId, params.clerkUserId]);
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
      await db.query(
        `INSERT INTO verification_attempts (candidacy_id, invitation_id, persona_inquiry_ref, environment, status)
         VALUES ($1, $2, $3, 'sandbox', 'pending')`,
        [personaFlow.candidacyId, personaInvite.invitationId, inquiry.inquiryId],
      );
    } catch {
      personaInquiryUrl = null;
    }
  }

  let interviewSessionId: string | null = null;
  let verifiedCandidacyId: string | null = null;
  if (params.clerkUserId) {
    const interviewFlow = await ensureCandidacy(interviewEmail, name, "verified");
    verifiedCandidacyId = interviewFlow.candidacyId;
    const interviewInvite = await ensureInvitation(interviewFlow.candidacyId, interviewFlow.packRevision);
    await db.query(`UPDATE candidacies SET clerk_user_id = $2 WHERE id = $1`, [interviewFlow.candidacyId, params.clerkUserId]);
    await db.query(
      `INSERT INTO verification_attempts (candidacy_id, invitation_id, persona_inquiry_ref, environment, status, name_match, bound_at)
       VALUES ($1, $2, 'demo-verified', 'sandbox', 'verified', 'match', now())`,
      [interviewFlow.candidacyId, interviewInvite.invitationId],
    );
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
