/**
 * Structural session mistakes derived from data the session already has — no new persisted
 * judgment, just a read over existing status/timing columns.
 */

export type ProcessMistakeKind = "skipped_question" | "time_overrun" | "upload_failed";

export interface ProcessMistake {
  kind: ProcessMistakeKind;
  planQuestionId: string | null;
  turnId: string | null;
  detail: string;
}

export interface ProcessEventsInput {
  elapsedActiveMs: number;
  timeBudgetSeconds: number;
  planQuestions: Array<{ id: string; position: number; status: string }>;
  turns: Array<{ id: string; planQuestionId: string | null; kind: string }>;
  artifacts: Array<{ id: string; turnId: string | null; uploadStatus: string }>;
}

export function deriveProcessMistakes(input: ProcessEventsInput): ProcessMistake[] {
  const mistakes: ProcessMistake[] = [];

  for (const question of input.planQuestions) {
    if (question.status === "skipped") {
      mistakes.push({
        kind: "skipped_question",
        planQuestionId: question.id,
        turnId: null,
        detail: `Question ${question.position} was skipped.`,
      });
    }
  }

  if (input.elapsedActiveMs > input.timeBudgetSeconds * 1000) {
    const overrunMs = input.elapsedActiveMs - input.timeBudgetSeconds * 1000;
    mistakes.push({
      kind: "time_overrun",
      planQuestionId: null,
      turnId: null,
      detail: `Session ran ${Math.round(overrunMs / 1000)}s over its ${input.timeBudgetSeconds / 60}-minute budget.`,
    });
  }

  const turnById = new Map(input.turns.map((turn) => [turn.id, turn]));
  for (const artifact of input.artifacts) {
    if (artifact.uploadStatus !== "terminal_failed") continue;
    const turn = artifact.turnId ? turnById.get(artifact.turnId) : undefined;
    mistakes.push({
      kind: "upload_failed",
      planQuestionId: turn?.planQuestionId ?? null,
      turnId: artifact.turnId,
      detail: "A recorded answer failed to upload and could not be recovered.",
    });
  }

  return mistakes;
}
