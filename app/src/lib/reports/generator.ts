import "server-only";
import { createHash } from "node:crypto";
import { rawReportSchema, type ReportFindingInput, type ReportOverview, type ReportTranscriptTurn } from "./contracts";
import { completeJsonText, llmTextModel, activeLlmProvider, type LlmProviderId } from "@/lib/llm/provider";

export const REPORT_PROMPT_VERSION = "report-v2-chess-style";

/** Model for the report pass under the active LLM provider (Muse Spark by default). */
export function reportModel() {
  return llmTextModel("report");
}

export interface GeneratedReport {
  overview: ReportOverview;
  findings: ReportFindingInput[];
  inputHash: string;
  result: Record<string, unknown>;
  usage: Record<string, number>;
  model: string;
  provider: LlmProviderId;
  source: LlmProviderId | "fallback";
}

export function reportInputHash(turns: ReportTranscriptTurn[]) {
  return createHash("sha256").update(JSON.stringify(turns)).digest("hex");
}

function answeredTurns(turns: ReportTranscriptTurn[]) {
  return turns.filter((turn) => turn.kind === "candidate_answer" && turn.text);
}

function buildEvaluatorPrompt(turns: ReportTranscriptTurn[]) {
  const answered = answeredTurns(turns);
  const transcript = answered
    .map((turn) => {
      const label = turn.position ? `Q${turn.position}` : "Follow-up";
      return `[turnId=${turn.turnId}] ${label}${turn.prompt ? ` (${turn.prompt})` : ""}: ${turn.text}`;
    })
    .join("\n");

  return `You are reviewing a completed interview-practice transcript the way a chess engine reviews a finished game: go answer by answer, call out exactly where the candidate went wrong and why, and finish with an overview of the biggest problems to fix. You are evaluating a transcript after the fact, not conducting the interview.

For EVERY answered turn listed below, return exactly one finding with:
- "turnId": copied exactly from the transcript line.
- "verdict": one of "blunder" (a serious, costly mistake), "mistake" (a clear mistake), "inaccuracy" (a minor issue or missed opportunity), "good" (a solid answer), "best" (an excellent answer), or "insufficient_evidence" (the answer is too short/off-topic to judge fairly).
- "explanation": one or two sentences saying specifically why this verdict applies, grounded only in what was actually said.
- "improvement": one concrete suggestion for what to say instead next time, or null for "best"/"insufficient_evidence".

Then return one "overview" object with:
- "summary": a short paragraph on overall performance across the session.
- "keyProblems": 1-5 short bullet strings naming the most impactful, recurring problems to fix, ordered by impact.

Never infer or mention confidence, emotion, appearance, accent, personality or any biometric trait. Base every verdict only on what was said.

Transcript:
${transcript || "(no answered turns)"}

Return strict JSON only:
{"overview":{"summary":"...","keyProblems":["..."]},"findings":[{"turnId":"...","verdict":"blunder|mistake|inaccuracy|good|best|insufficient_evidence","explanation":"...","improvement":"...or null"}]}`;
}

/** Safe default when the model call fails or is rate-limited: never fabricate a verdict. */
export function createFallbackReport(turns: ReportTranscriptTurn[]): GeneratedReport {
  const findings: ReportFindingInput[] = answeredTurns(turns).map((turn) => ({
    turnId: turn.turnId,
    verdict: "insufficient_evidence" as const,
    explanation: "The report generator was unavailable, so this answer was not evaluated.",
    improvement: null,
  }));
  const overview: ReportOverview = {
    summary: "The report generator was unavailable, so this session could not be reviewed yet.",
    keyProblems: ["Retry generating this report once the evaluator is available again."],
  };
  return {
    overview,
    findings,
    inputHash: reportInputHash(turns),
    result: { overview, findings, source: "fallback", reason: "report_generator_unavailable" },
    usage: {},
    model: "fallback-static-v1",
    provider: activeLlmProvider(),
    source: "fallback",
  };
}

function parseModelText(raw: string, turns: ReportTranscriptTurn[]): { overview: ReportOverview; findings: ReportFindingInput[] } {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = rawReportSchema.parse(JSON.parse(stripped));
  const validTurnIds = new Set(turns.map((turn) => turn.turnId));
  return {
    overview: parsed.overview,
    findings: parsed.findings.filter((finding) => validTurnIds.has(finding.turnId)),
  };
}

/** Calls the active LLM once for the report; persistence happens in the owning action. */
export async function generateReport(turns: ReportTranscriptTurn[]): Promise<GeneratedReport> {
  const { text, model, provider, usage } = await completeJsonText(buildEvaluatorPrompt(turns), {
    timeoutMs: 25_000,
  });
  const { overview, findings } = parseModelText(text, turns);
  return {
    overview,
    findings,
    inputHash: reportInputHash(turns),
    result: { overview, findings },
    usage,
    model,
    provider,
    source: provider,
  };
}
