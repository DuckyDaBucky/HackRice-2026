import { describe, expect, it } from "vitest";
import { buildExitLine, buildIntroLine } from "../src/lib/interview-dialog";

describe("interview dialog", () => {
  it("opens a blitz round with the one-question format", () => {
    const line = buildIntroLine({
      targetRole: "Backend engineer",
      seniority: "junior",
      timeBudgetSeconds: 180,
      questionCount: 1,
    });
    expect(line).toContain("blitz");
    expect(line).toContain("Backend engineer");
    expect(line).toContain("one question");
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(45);
  });

  it("opens a standard round with the question count", () => {
    const line = buildIntroLine({
      targetRole: "Designer",
      seniority: "mid_level",
      timeBudgetSeconds: 1200,
      questionCount: 6,
    });
    expect(line).toContain("6 questions");
    expect(line).not.toContain("blitz");
  });

  it("closes a blitz round pointing at the review", () => {
    const line = buildExitLine({ answeredCount: 1, totalQuestions: 1, timeBudgetSeconds: 180 });
    expect(line).toContain("blitz");
    expect(line).toContain("review");
  });

  it("celebrates a full standard round and nudges a partial one", () => {
    expect(
      buildExitLine({ answeredCount: 6, totalQuestions: 6, timeBudgetSeconds: 1200 }),
    ).toContain("all 6");
    expect(
      buildExitLine({ answeredCount: 2, totalQuestions: 6, timeBudgetSeconds: 1200 }),
    ).toContain("2 of 6");
  });
});
