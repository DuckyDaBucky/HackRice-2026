import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  interviewContentTypeSchema,
  planLengthFor,
  type InterviewContentType,
  type InterviewSetup,
} from "./contracts";
import type { PlannedQuestionInput } from "./persistence";
import { completeJsonText } from "@/lib/llm/provider";

const planQuestionSchema = z.object({
  position: z.number().int().min(1),
  contentType: interviewContentTypeSchema,
  prompt: z.string().trim().min(12).max(500),
  intent: z.object({
    objective: z.string().trim().min(1).max(300),
    expectedEvidence: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
  }).strict(),
}).strict();

const rawPlanSchema = z.object({
  questions: z.array(planQuestionSchema).min(1).max(10),
}).strict();

export interface GeneratedInterviewPlan {
  questions: PlannedQuestionInput[];
  inputHash: string;
  result: Record<string, unknown>;
  usage: Record<string, number>;
  model: string;
  source: "meta" | "gemini" | "fallback";
}

const FALLBACK_QUESTIONS: Record<InterviewContentType, Array<{
  prompt: string;
  objective: string;
  expectedEvidence: string;
}>> = {
  behavioral: [
    { prompt: "Tell me about a time you had to align people with different opinions on a technical decision.", objective: "Assess collaboration and ownership.", expectedEvidence: "specific action" },
    { prompt: "Describe a project that did not go as planned. What did you change and what happened next?", objective: "Assess reflection and learning.", expectedEvidence: "outcome" },
    { prompt: "Tell me about a time you took responsibility for an ambiguous problem.", objective: "Assess initiative under ambiguity.", expectedEvidence: "decision" },
    { prompt: "Describe feedback that changed how you work with a team.", objective: "Assess growth and collaboration.", expectedEvidence: "concrete example" },
  ],
  technical_concepts: [
    { prompt: "Explain a technical tradeoff you made recently and why it was appropriate for the situation.", objective: "Assess technical reasoning.", expectedEvidence: "tradeoff" },
    { prompt: "Walk me through how you would debug a production issue that only appears under load.", objective: "Assess debugging approach.", expectedEvidence: "investigation steps" },
    { prompt: "How would you decide whether to optimize a slow service now or accept the current cost?", objective: "Assess prioritization and performance reasoning.", expectedEvidence: "decision criteria" },
    { prompt: "Explain how you would evaluate a dependency before introducing it into a production system.", objective: "Assess engineering judgment.", expectedEvidence: "risk assessment" },
  ],
  system_design: [
    { prompt: "How would you design a reliable service that receives and processes webhooks from third parties?", objective: "Assess reliability and system design.", expectedEvidence: "failure handling" },
    { prompt: "Design a notification system that can deliver messages to many users without losing track of failures.", objective: "Assess scalable architecture.", expectedEvidence: "delivery strategy" },
    { prompt: "How would you design an API that remains responsive as traffic grows tenfold?", objective: "Assess scaling tradeoffs.", expectedEvidence: "bottleneck analysis" },
    { prompt: "Describe how you would make a user-upload service safe, observable, and recoverable.", objective: "Assess production system thinking.", expectedEvidence: "operational plan" },
  ],
  code_explanation: [
    { prompt: "Explain how you would approach finding duplicate values in a large collection, including the tradeoffs of your chosen approach.", objective: "Assess code reasoning.", expectedEvidence: "complexity tradeoff" },
    { prompt: "Talk through how you would design a cache lookup helper that is correct under concurrent requests.", objective: "Assess implementation reasoning.", expectedEvidence: "concurrency consideration" },
    { prompt: "Explain how you would reason about the edge cases in a function that merges two sorted lists.", objective: "Assess careful code explanation.", expectedEvidence: "edge cases" },
    { prompt: "Describe how you would review a function that parses untrusted request input before changing it.", objective: "Assess secure implementation thinking.", expectedEvidence: "validation approach" },
  ],
};

export function planInputHash(setup: InterviewSetup) {
  return createHash("sha256").update(JSON.stringify({
    ...setup,
    contentTypes: [...setup.contentTypes].sort(),
  })).digest("hex");
}

export function buildPlanPrompt(setup: InterviewSetup) {
  const length = planLengthFor(setup.timeBudgetSeconds);
  const selectedTypes = setup.contentTypes.join(", ");
  const focus = setup.focusArea ? `The candidate focus area is: ${setup.focusArea}` : "No extra focus area was supplied.";

  return `You are planning a realistic interview-practice session for a ${setup.seniority.replace("_", " ")} ${setup.targetRole}.

The candidate selected these content types: ${selectedTypes}.
${focus}
The session lasts ${setup.timeBudgetSeconds / 60} minutes. Plan exactly ${length.target} numbered question${length.target === 1 ? "" : "s"}. Choose a useful mix and ordering from the selected types; do not require every selected type when there are more types than questions.

Definitions:
- behavioral: a concrete experience, ownership, conflict, learning or outcome story;
- technical_concepts: explain a relevant technical concept, tradeoff or debugging decision;
- system_design: design/reason about a service, architecture, scale, reliability or tradeoff;
- code_explanation: explain and defend a LeetCode-style approach; never require a code editor or ask the candidate to solve live.

Questions must be concise, spoken naturally, independent enough to survive resume, and appropriate to the seniority. Do not ask demographic, appearance, biometric, medical, age, school-prestige or protected-trait questions. Do not include answers, greetings, scoring, or multiple questions in one prompt.

Return strict JSON only:
{"questions":[{"position":1,"contentType":"one selected type","prompt":"one spoken question","intent":{"objective":"what this probes","expectedEvidence":["evidence 1"]}}]}`;
}

/** Provider-safe plan used only when a planner call fails or is rate-limited. */
export function createFallbackInterviewPlan(setup: InterviewSetup): GeneratedInterviewPlan {
  const length = planLengthFor(setup.timeBudgetSeconds);
  const questions = Array.from({ length: length.target }, (_, index) => {
    const contentType = setup.contentTypes[index % setup.contentTypes.length];
    const template = FALLBACK_QUESTIONS[contentType][Math.floor(index / setup.contentTypes.length) % FALLBACK_QUESTIONS[contentType].length];
    return {
      position: index + 1,
      contentType,
      prompt: template.prompt,
      intent: { objective: template.objective, expectedEvidence: [template.expectedEvidence] },
      maxFollowUps: 1 as const,
    };
  });
  return {
    questions,
    inputHash: planInputHash(setup),
    result: { questions, source: "fallback", reason: "planner_unavailable" },
    usage: {},
    model: "fallback-static-v1",
    source: "fallback",
  };
}

function parseModelText(raw: string, setup: InterviewSetup): PlannedQuestionInput[] {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = rawPlanSchema.parse(JSON.parse(stripped));
  const length = planLengthFor(setup.timeBudgetSeconds);
  if (parsed.questions.length !== length.target) {
    throw new Error(`Planner returned ${parsed.questions.length} questions; expected ${length.target}.`);
  }
  const positions = new Set(parsed.questions.map((question) => question.position));
  if (positions.size !== parsed.questions.length) throw new Error("Planner returned duplicate question positions.");
  if (parsed.questions.some((question) => !setup.contentTypes.includes(question.contentType))) {
    throw new Error("Planner returned a content type the candidate did not choose.");
  }
  return [...parsed.questions]
    .sort((left, right) => left.position - right.position)
    .map((question) => ({
      position: question.position,
      contentType: question.contentType,
      prompt: question.prompt,
      intent: question.intent,
      maxFollowUps: 1,
    }));
}

/** Calls the active LLM once for the plan; persistence happens in the owning action/service. */
export async function generateInterviewPlan(setup: InterviewSetup): Promise<GeneratedInterviewPlan> {
  const { text, model, provider, usage } = await completeJsonText(buildPlanPrompt(setup), { timeoutMs: 25_000 });
  const questions = parseModelText(text, setup);
  return {
    questions,
    inputHash: planInputHash(setup),
    result: { questions },
    usage,
    model,
    source: provider,
  };
}

export const interviewPlanParser = {
  parse: parseModelText,
};
