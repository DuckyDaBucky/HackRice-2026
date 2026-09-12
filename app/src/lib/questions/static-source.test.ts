import { describe, expect, it } from "vitest";
import { staticQuestionSource } from "./static-source";

describe("staticQuestionSource", () => {
  it("returns only technical questions for technical mode", async () => {
    const questions = await staticQuestionSource.getQuestions("technical");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.mode === "technical")).toBe(true);
  });

  it("returns only behavioral questions for behavioral mode", async () => {
    const questions = await staticQuestionSource.getQuestions("behavioral");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((q) => q.mode === "behavioral")).toBe(true);
  });

  it("gives every question a unique id", async () => {
    const technical = await staticQuestionSource.getQuestions("technical");
    const behavioral = await staticQuestionSource.getQuestions("behavioral");
    const ids = [...technical, ...behavioral].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
