import { describe, expect, it } from "vitest";
import { interviewSetupSchema } from "../src/lib/interviews/contracts";
import {
  buildPlanPrompt,
  createFallbackInterviewPlan,
  interviewPlanParser,
  planInputHash,
} from "../src/lib/interviews/planner";

const setup = interviewSetupSchema.parse({
  contentTypes: ["behavioral", "system_design"],
  targetRole: "Platform engineer",
  seniority: "senior",
  focusArea: "reliability tradeoffs",
  timeBudgetSeconds: 600,
  voiceId: null,
  mood: "neutral",
});

describe("interview planner contract", () => {
  it("requests a complete plan that honors selected setup", () => {
    const prompt = buildPlanPrompt(setup);
    expect(prompt).toContain("behavioral, system_design");
    expect(prompt).toContain("Plan exactly 4 numbered questions");
    expect(planInputHash(setup)).toHaveLength(64);
  });

  it("accepts only a complete selected-type plan", () => {
    const questions = interviewPlanParser.parse(JSON.stringify({
      questions: [
        { position: 2, contentType: "system_design", prompt: "How would you design a reliable webhook delivery service?", intent: { objective: "Assess reliability tradeoffs", expectedEvidence: ["retry strategy"] } },
        { position: 1, contentType: "behavioral", prompt: "Tell me about a time you led a difficult technical decision.", intent: { objective: "Assess ownership", expectedEvidence: ["specific decision"] } },
        { position: 3, contentType: "behavioral", prompt: "Describe a project where you handled an unexpected production issue.", intent: { objective: "Assess incident response", expectedEvidence: ["outcome"] } },
        { position: 4, contentType: "system_design", prompt: "What tradeoffs would you make for the service as traffic grows?", intent: { objective: "Assess scaling reasoning", expectedEvidence: ["tradeoff"] } },
      ],
    }), setup);
    expect(questions.map((question) => question.position)).toEqual([1, 2, 3, 4]);
  });

  it("rejects extra questions and unselected content", () => {
    expect(() => interviewPlanParser.parse(JSON.stringify({ questions: [] }), setup)).toThrow();
    expect(() => interviewPlanParser.parse(JSON.stringify({
      questions: Array.from({ length: 4 }, (_, index) => ({
        position: index + 1,
        contentType: "code_explanation",
        prompt: "Explain a code approach with the relevant tradeoffs clearly.",
        intent: { objective: "Reasoning", expectedEvidence: ["tradeoff"] },
      })),
    }), setup)).toThrow();
  });

  it("creates a complete selected-type fallback during provider outages", () => {
    const fallback = createFallbackInterviewPlan(setup);
    expect(fallback.source).toBe("fallback");
    expect(fallback.questions).toHaveLength(4);
    expect(fallback.questions.every((question) => setup.contentTypes.includes(question.contentType))).toBe(true);
  });
});
