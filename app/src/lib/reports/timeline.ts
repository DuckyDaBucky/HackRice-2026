import "server-only";
import { deriveProcessMistakes, type ProcessMistake } from "@/lib/analytics/process-events";
import { createPlaybackUrl } from "@/lib/storage/r2";
import { getSessionTimelineContext, type SessionTimelineContext, type StoredReportFinding } from "./persistence";

export interface ReviewClip {
  url: string;
  durationMs: number | null;
}

export interface ReviewAnswer {
  turnId: string;
  number: number;
  question: string | null;
  isFollowUp: boolean;
  transcript: string | null;
  finding: StoredReportFinding | null;
  clip: ReviewClip | null;
}

export interface SessionReview {
  answers: ReviewAnswer[];
  processMistakes: ProcessMistake[];
}

const INTERVIEWER_TURN_KINDS = new Set(["question", "follow_up", "rephrase", "repeat", "revisit"]);

/** Pairs each candidate answer with the exact wording it responded to, its verdict and its clip. */
export function buildReviewAnswers(params: {
  context: Pick<SessionTimelineContext, "planQuestions" | "turns">;
  findings: StoredReportFinding[];
  clipsByTurnId: Map<string, ReviewClip>;
}): ReviewAnswer[] {
  const promptByPlanQuestionId = new Map(params.context.planQuestions.map((question) => [question.id, question.prompt]));
  const findingByTurnId = new Map(params.findings.map((finding) => [finding.turnId, finding]));
  const lastAskedByPlanQuestionId = new Map<string, { text: string; kind: string }>();
  const answers: ReviewAnswer[] = [];

  for (const turn of params.context.turns) {
    if (turn.planQuestionId && turn.text && INTERVIEWER_TURN_KINDS.has(turn.kind)) {
      lastAskedByPlanQuestionId.set(turn.planQuestionId, { text: turn.text, kind: turn.kind });
      continue;
    }
    if (turn.kind !== "candidate_answer") continue;

    const asked = turn.planQuestionId ? lastAskedByPlanQuestionId.get(turn.planQuestionId) : undefined;
    const planPrompt = turn.planQuestionId ? promptByPlanQuestionId.get(turn.planQuestionId) ?? null : null;
    answers.push({
      turnId: turn.id,
      number: answers.length + 1,
      question: asked?.text ?? planPrompt,
      isFollowUp: asked?.kind === "follow_up",
      transcript: turn.text,
      finding: findingByTurnId.get(turn.id) ?? null,
      clip: params.clipsByTurnId.get(turn.id) ?? null,
    });
  }
  return answers;
}

/** The chess-style review for an owned session: answers in order, each with verdict and recording. */
export async function buildSessionReview(params: {
  sessionId: string;
  clerkUserId: string;
  findings: StoredReportFinding[];
}): Promise<SessionReview | null> {
  const context = await getSessionTimelineContext(params.sessionId, params.clerkUserId);
  if (!context) return null;

  // Signing is local (no network); it only fails when R2 isn't configured, in which case clips are omitted.
  const uploaded = context.artifacts.filter((artifact) => artifact.turnId && artifact.uploadStatus === "uploaded");
  const urls = await Promise.all(uploaded.map((artifact) => createPlaybackUrl(artifact.r2Key).catch(() => null)));
  const clipsByTurnId = new Map<string, ReviewClip>();
  uploaded.forEach((artifact, index) => {
    const url = urls[index];
    if (url && artifact.turnId) clipsByTurnId.set(artifact.turnId, { url, durationMs: artifact.durationMs });
  });

  return {
    answers: buildReviewAnswers({ context, findings: params.findings, clipsByTurnId }),
    processMistakes: deriveProcessMistakes({
      elapsedActiveMs: context.session.elapsedActiveMs,
      timeBudgetSeconds: context.session.timeBudgetSeconds,
      planQuestions: context.planQuestions,
      turns: context.turns,
      artifacts: context.artifacts,
    }),
  };
}
