import "server-only";
import { deriveProcessMistakes, type ProcessMistake } from "@/lib/analytics/process-events";
import { deriveTranscriptMarkers, type TranscriptMarkers } from "@/lib/analytics/transcript-markers";
import { getSessionTimelineContext, type StoredReportFinding } from "./persistence";

export interface TimelineTurn {
  turnId: string;
  planQuestionId: string | null;
  kind: string;
  sequence: number;
  prompt: string | null;
  text: string | null;
  findings: StoredReportFinding[];
  transcriptMarkers: TranscriptMarkers | null;
}

export interface SessionTimeline {
  turns: TimelineTurn[];
  processMistakes: ProcessMistake[];
}

/** Merges turns, rubric findings and derived analytics into one ordered view for the report page. */
export async function buildSessionTimeline(params: {
  sessionId: string;
  clerkUserId: string;
  findings: StoredReportFinding[];
}): Promise<SessionTimeline | null> {
  const context = await getSessionTimelineContext(params.sessionId, params.clerkUserId);
  if (!context) return null;

  const findingsByTurnId = new Map<string, StoredReportFinding[]>();
  for (const finding of params.findings) {
    for (const turnId of finding.evidenceTurnIds) {
      const existing = findingsByTurnId.get(turnId) ?? [];
      existing.push(finding);
      findingsByTurnId.set(turnId, existing);
    }
  }

  const promptByPlanQuestionId = new Map(
    context.planQuestions.map((question) => [question.id, question.prompt]),
  );

  const turns: TimelineTurn[] = context.turns.map((turn) => {
    const segments = context.transcriptsByTurnId.get(turn.id);
    return {
      turnId: turn.id,
      planQuestionId: turn.planQuestionId,
      kind: turn.kind,
      sequence: turn.sequence,
      prompt: turn.planQuestionId ? promptByPlanQuestionId.get(turn.planQuestionId) ?? null : null,
      text: turn.text,
      findings: findingsByTurnId.get(turn.id) ?? [],
      transcriptMarkers: segments ? deriveTranscriptMarkers(segments) : null,
    };
  });

  const processMistakes = deriveProcessMistakes({
    elapsedActiveMs: context.session.elapsedActiveMs,
    timeBudgetSeconds: context.session.timeBudgetSeconds,
    planQuestions: context.planQuestions,
    turns: context.turns,
    artifacts: context.artifacts,
  });

  return { turns, processMistakes };
}
