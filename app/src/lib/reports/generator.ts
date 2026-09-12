import "server-only";
import { createHash } from "node:crypto";
import { rawReportSchema, type ReportFindingInput, type ReportOverview, type ReportTranscriptTurn } from "./contracts";

export const REPORT_PROMPT_VERSION = "report-v2-chess-style";

/** A separate model keeps interview-time calls from exhausting the free-tier quota reports need. */
export function reportModel() {
  return process.env.GEMINI_REPORT_MODEL || process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

export interface GeneratedReport {
  overview: ReportOverview;
  findings: ReportFindingInput[];
  inputHash: string;
  result: Record<string, unknown>;
  usage: Record<string, number>;
  model: string;
  source: "gemini" | "fallback";
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

function usageFrom(data: unknown): Record<string, number> {
  const usage = (data as { usageMetadata?: Record<string, unknown> })?.usageMetadata;
  if (!usage) return {};
  const fields: Record<string, unknown> = {
    promptTokens: usage.promptTokenCount,
    candidateTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
  };
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

/** Calls Gemini once for the report; persistence happens in the owning action. */
export async function generateReport(turns: ReportTranscriptTurn[]): Promise<GeneratedReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Report generation is unavailable because Gemini is not configured.");
  const model = reportModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildEvaluatorPrompt(turns) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 128 },
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini report evaluator failed with status ${response.status}.`);
    const data: unknown = await response.json();
    const text = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini report evaluator returned no text.");
    const { overview, findings } = parseModelText(text, turns);
    return {
      overview,
      findings,
      inputHash: reportInputHash(turns),
      result: { overview, findings },
      usage: usageFrom(data),
      model,
      source: "gemini",
    };
  } finally {
    clearTimeout(timeout);
  }
}
