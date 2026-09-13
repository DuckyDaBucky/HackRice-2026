import { describe, expect, it } from "vitest";
import { approvedQuestionSchema, type ApprovedQuestion } from "@/lib/hiring/contracts";
import { buildAnswerGuide } from "@/lib/hiring/answer-guide";

const pack: ApprovedQuestion[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    position: 1,
    prompt: "Walk me through a project.",
    category: "behavioral",
    competency: "ownership",
    profileEvidence: [],
    projectId: null,
    sourceQuestionId: null,
    origin: "resume",
    intent: "Probe ownership and scope.",
    strongAnswerIndicators: ["Names a specific project", "Quantifies the outcome"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    position: 2,
    prompt: "How do you debug under pressure?",
    category: "technical-behavioral",
    competency: "debugging",
    profileEvidence: [],
    projectId: null,
    sourceQuestionId: null,
    origin: "shared",
  },
];

describe("approved packs with rich metadata", () => {
  it("still parses legacy packs without intent or indicators", () => {
    const parsed = approvedQuestionSchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      position: 1,
      prompt: "Legacy question.",
      category: "behavioral",
      competency: "ownership",
      origin: "shared",
    });
    expect(parsed.intent).toBeUndefined();
    expect(parsed.strongAnswerIndicators).toBeUndefined();
  });

  it("keeps intent and indicators through approval parsing", () => {
    const parsed = approvedQuestionSchema.parse(pack[0]);
    expect(parsed.intent).toBe("Probe ownership and scope.");
    expect(parsed.strongAnswerIndicators).toHaveLength(2);
  });
});

describe("buildAnswerGuide", () => {
  const plan = [
    { id: "plan-1", position: 1, prompt: "Walk me through a project." },
    { id: "plan-2", position: 2, prompt: "How do you debug under pressure?" },
  ];
  const items = [
    { planQuestionId: "plan-1", competency: "reflection", coverage: "observed", finding: "Gave a concrete example.", rating: 4 },
    { planQuestionId: "plan-1", competency: "clarity", coverage: "observed", finding: "Clear.", rating: 3 },
    { planQuestionId: "plan-9", competency: "x", coverage: "observed", finding: "Orphan.", rating: 5 },
  ];

  it("joins pack expectations with the top finding per question", () => {
    const guide = buildAnswerGuide([...pack], plan, items);
    expect(guide).toHaveLength(2);
    expect(guide[0]?.indicators).toHaveLength(2);
    expect(guide[0]?.finding).toBe("Gave a concrete example.");
    expect(guide[0]?.rating).toBe(4);
    // Legacy pack question without metadata still renders with the finding.
    expect(guide[1]?.indicators).toEqual([]);
    expect(guide[1]?.intent).toBeNull();
    expect(guide[1]?.finding).toBeNull();
  });

  it("never fabricates entries for unmatched items", () => {
    const orphans = [{ planQuestionId: "plan-9", finding: "Orphan.", rating: 5 }];
    const guide = buildAnswerGuide([], plan, orphans);
    expect(guide).toHaveLength(2);
    expect(guide.every((g) => g.finding === null)).toBe(true);
  });
});
