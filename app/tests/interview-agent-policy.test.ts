import { describe, expect, it } from "vitest";
import { agentDecisionSchema, type AgentContext, type AgentDecision } from "../src/lib/interviews/agent-contracts";
import { validateAgentDecision } from "../src/lib/interviews/agent-policy";

const baseContext: AgentContext = {
  sessionId: "session-1",
  turnId: "turn-1",
  planQuestionId: "question-1",
  sessionStatus: "in_progress",
  questionPrompt: "Describe a technical tradeoff you made.",
  questionIntent: { objective: "Assess tradeoff reasoning." },
  transcript: "I would consider latency and operational complexity.",
  followUpsUsed: 0,
  maxFollowUps: 1,
  elapsedActiveMs: 60_000,
  timeBudgetSeconds: 600,
  isLastQuestion: false,
};

type CorpusCase = {
  name: string;
  context?: Partial<AgentContext>;
  candidate: AgentDecision;
  expected: AgentDecision["action"];
};

const move: AgentDecision = { action: "move_to_next_question", rationale: "coverage_complete" };
const followUp: AgentDecision = {
  action: "ask_follow_up",
  rationale: "needs_tradeoff",
  wording: "Which tradeoff mattered most, and how did you decide?",
};

// This corpus checks permitted action classes, not subjective wording quality.
const corpus: CorpusCase[] = [
  { name: "strong behavioral answer progresses", candidate: move, expected: "move_to_next_question" },
  { name: "strong technical answer progresses", candidate: move, expected: "move_to_next_question" },
  { name: "strong system-design answer progresses", candidate: move, expected: "move_to_next_question" },
  { name: "vague answer can receive one evidence probe", candidate: followUp, expected: "ask_follow_up" },
  { name: "missing tradeoff can receive one focused probe", candidate: followUp, expected: "ask_follow_up" },
  { name: "short answer can receive one focused probe", candidate: followUp, expected: "ask_follow_up" },
  { name: "second probe is rejected", context: { followUpsUsed: 1 }, candidate: followUp, expected: "move_to_next_question" },
  { name: "third probe is rejected", context: { followUpsUsed: 2 }, candidate: followUp, expected: "move_to_next_question" },
  { name: "time cap closes instead of probing", context: { elapsedActiveMs: 600_000 }, candidate: followUp, expected: "close_interview" },
  { name: "time cap closes instead of moving", context: { elapsedActiveMs: 600_000 }, candidate: move, expected: "close_interview" },
  { name: "last planned question closes after complete answer", context: { isLastQuestion: true }, candidate: move, expected: "close_interview" },
  { name: "last planned question may use its one probe", context: { isLastQuestion: true }, candidate: followUp, expected: "ask_follow_up" },
  { name: "provider fallback proceeds safely", candidate: { action: "move_to_next_question", rationale: "provider_fallback" }, expected: "move_to_next_question" },
  { name: "provider fallback closes on final question", context: { isLastQuestion: true }, candidate: { action: "move_to_next_question", rationale: "provider_fallback" }, expected: "close_interview" },
  { name: "coverage close is preserved", candidate: { action: "close_interview", rationale: "coverage_complete" }, expected: "close_interview" },
  { name: "time close is preserved", candidate: { action: "close_interview", rationale: "time_budget_reached" }, expected: "close_interview" },
  { name: "clarification follow-up is bounded", candidate: { ...followUp, rationale: "missing_specific_example" }, expected: "ask_follow_up" },
  { name: "empty transcript still cannot bypass cap", context: { transcript: "", followUpsUsed: 1 }, candidate: followUp, expected: "move_to_next_question" },
  { name: "near-cap answer can still progress", context: { elapsedActiveMs: 599_000 }, candidate: move, expected: "move_to_next_question" },
  { name: "near-cap final answer closes", context: { elapsedActiveMs: 599_000, isLastQuestion: true }, candidate: move, expected: "close_interview" },
];

describe("bounded interviewer agent policy corpus", () => {
  it.each(corpus)("$name", ({ context, candidate, expected }) => {
    expect(validateAgentDecision({ ...baseContext, ...context }, candidate).action).toBe(expected);
  });

  it("rejects malformed provider payloads before policy evaluation", () => {
    expect(() => agentDecisionSchema.parse({ action: "ask_follow_up", wording: "No rationale supplied." })).toThrow();
    expect(() => agentDecisionSchema.parse({ action: "invent_a_question", rationale: "coverage_complete" })).toThrow();
  });
});
