import { describe, expect, it } from "vitest";
import { buildReviewAnswers } from "../src/lib/reports/timeline";

const planQuestions = [
  { id: "q1", position: 1, prompt: "Tell me about a conflict on your team.", status: "answered" },
  { id: "q2", position: 2, prompt: "Design a reliable job queue.", status: "answered" },
];

const turns = [
  { id: "t1", planQuestionId: "q1", kind: "question", sequence: 1, text: "Tell me about a conflict on your team." },
  { id: "a1", planQuestionId: "q1", kind: "candidate_answer", sequence: 2, text: "We disagreed on a design." },
  { id: "t2", planQuestionId: "q1", kind: "follow_up", sequence: 3, text: "What did you personally do?" },
  { id: "a2", planQuestionId: "q1", kind: "candidate_answer", sequence: 4, text: "I set up a design review." },
  { id: "a3", planQuestionId: "q2", kind: "candidate_answer", sequence: 5, text: "I would use a durable log." },
];

const mistake = { id: "f1", turnId: "a2", verdict: "mistake", explanation: "No outcome named.", improvement: "Say what changed." };

describe("buildReviewAnswers", () => {
  const answers = buildReviewAnswers({
    context: { planQuestions, turns },
    findings: [mistake],
    clipsByTurnId: new Map([["a3", { url: "https://example.test/clip.webm", durationMs: 42_000 }]]),
  });

  it("returns only candidate answers, numbered in order", () => {
    expect(answers.map((answer) => [answer.turnId, answer.number])).toEqual([
      ["a1", 1],
      ["a2", 2],
      ["a3", 3],
    ]);
  });

  it("pairs an answer with the follow-up wording it actually responded to", () => {
    expect(answers[0]).toMatchObject({ question: "Tell me about a conflict on your team.", isFollowUp: false });
    expect(answers[1]).toMatchObject({ question: "What did you personally do?", isFollowUp: true });
  });

  it("falls back to the plan prompt when no interviewer turn was recorded", () => {
    expect(answers[2]).toMatchObject({ question: "Design a reliable job queue.", isFollowUp: false });
  });

  it("attaches each answer's own verdict and recording", () => {
    expect(answers[1].finding).toBe(mistake);
    expect(answers[0].finding).toBeNull();
    expect(answers[2].clip).toEqual({ url: "https://example.test/clip.webm", durationMs: 42_000 });
    expect(answers[1].clip).toBeNull();
  });
});
