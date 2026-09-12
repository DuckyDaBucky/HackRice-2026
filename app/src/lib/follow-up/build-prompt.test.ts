import { describe, expect, it } from "vitest";
import { buildFollowUpPrompt } from "./build-prompt";

describe("buildFollowUpPrompt", () => {
  it("includes the original question and the transcript so far", () => {
    const prompt = buildFollowUpPrompt({
      mode: "behavioral",
      questionPrompt: "Tell me about a time you disagreed with a teammate.",
      transcriptSoFar: "So last semester I was working on a group project and",
    });
    expect(prompt).toContain("Tell me about a time you disagreed with a teammate.");
    expect(prompt).toContain("So last semester I was working on a group project and");
  });

  it("mentions the interview mode", () => {
    const prompt = buildFollowUpPrompt({
      mode: "technical",
      questionPrompt: "Walk me through a design decision.",
      transcriptSoFar: "I chose Postgres because",
    });
    expect(prompt.toLowerCase()).toContain("technical");
  });

  it("instructs the model to respond with strict JSON containing followUp", () => {
    const prompt = buildFollowUpPrompt({
      mode: "technical",
      questionPrompt: "Walk me through a design decision.",
      transcriptSoFar: "I chose Postgres because",
    });
    expect(prompt).toContain("followUp");
    expect(prompt.toLowerCase()).toContain("json");
  });

  it("only permits moving on after a substantive answer", () => {
    const prompt = buildFollowUpPrompt({
      mode: "technical",
      questionPrompt: "Walk me through a design decision.",
      transcriptSoFar: "I used Postgres.",
    });
    expect(prompt).toContain("Return null ONLY when it has");
    expect(prompt.toLowerCase()).toContain("specific detail");
  });
});
