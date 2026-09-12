import { describe, expect, it } from "vitest";
import { deriveProcessMistakes } from "../src/lib/analytics/process-events";

describe("deriveProcessMistakes", () => {
  it("flags a skipped question", () => {
    const mistakes = deriveProcessMistakes({
      elapsedActiveMs: 100_000,
      timeBudgetSeconds: 600,
      planQuestions: [{ id: "q1", position: 1, status: "skipped" }],
      turns: [],
      artifacts: [],
    });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].kind).toBe("skipped_question");
  });

  it("flags a time overrun only when elapsed exceeds the budget", () => {
    const withinBudget = deriveProcessMistakes({
      elapsedActiveMs: 500_000,
      timeBudgetSeconds: 600,
      planQuestions: [],
      turns: [],
      artifacts: [],
    });
    expect(withinBudget).toHaveLength(0);

    const overBudget = deriveProcessMistakes({
      elapsedActiveMs: 700_000,
      timeBudgetSeconds: 600,
      planQuestions: [],
      turns: [],
      artifacts: [],
    });
    expect(overBudget.map((mistake) => mistake.kind)).toEqual(["time_overrun"]);
  });

  it("flags a terminally failed upload and links it back to its plan question", () => {
    const mistakes = deriveProcessMistakes({
      elapsedActiveMs: 0,
      timeBudgetSeconds: 600,
      planQuestions: [],
      turns: [{ id: "turn1", planQuestionId: "q1", kind: "candidate_answer" }],
      artifacts: [{ id: "artifact1", turnId: "turn1", uploadStatus: "terminal_failed" }],
    });
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({ kind: "upload_failed", planQuestionId: "q1", turnId: "turn1" });
  });

  it("ignores retryable failures, only flagging terminal ones", () => {
    const mistakes = deriveProcessMistakes({
      elapsedActiveMs: 0,
      timeBudgetSeconds: 600,
      planQuestions: [],
      turns: [],
      artifacts: [{ id: "artifact1", turnId: null, uploadStatus: "retryable_failed" }],
    });
    expect(mistakes).toHaveLength(0);
  });
});
