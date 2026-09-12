import "server-only";
import { createHash } from "node:crypto";
import { REPORT_COMPETENCIES, rawReportSchema, type ReportFindingInput, type ReportTranscriptTurn } from "./contracts";

export const REPORT_PROMPT_VERSION = "report-v1";

export interface GeneratedReport {
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

function buildEvaluatorPrompt(turns: ReportTranscriptTurn[]) {
  const transcript = turns
    .filter((turn) => turn.text)
    .map((turn) => {
      const label = turn.position ? `Q${turn.position}` : turn.kind;
      return `[turnId=${turn.turnId}] ${label}${turn.prompt ? ` (${turn.prompt})` : ""}: ${turn.text}`;
    })
    .join("\n");

  return `You are evaluating a completed interview-practice transcript, not conducting the interview. Assess only what is present in the transcript below.

Competencies to assess, in this exact order: ${REPORT_COMPETENCIES.join(", ")}.

For each competency, return exactly one finding:
- "strength" if the transcript clearly demonstrates it, with a turnId as evidence;
- "gap" if there was an opportunity to demonstrate it but the answer fell short, with a turnId as evidence and a concrete improvement suggestion;
- "insufficient_evidence" if the transcript does not contain enough material to judge it fairly. Do not guess.

Never infer or mention confidence, emotion, appearance, accent, personality or any biometric trait. Base every finding only on what was said. Reference only turnIds that appear in the transcript below.

Transcript:
${transcript || "(no answered turns)"}

Return strict JSON only:
{"findings":[{"competencyId":"one of the listed competencies","kind":"strength|gap|insufficient_evidence","finding":"one sentence, evidence-grounded","improvement":"one practical suggestion, or null for strength/insufficient_evidence","evidenceTurnIds":["turnId"],"confidence":"low|medium|high"}]}`;
}

/** Safe default when the model call fails or is rate-limited: never fabricate a score. */
export function createFallbackReport(turns: ReportTranscriptTurn[]): GeneratedReport {
  const findings: ReportFindingInput[] = REPORT_COMPETENCIES.map((competencyId) => ({
    competencyId,
    kind: "insufficient_evidence" as const,
    finding: "The report generator was unavailable, so this competency was not evaluated.",
    improvement: null,
    evidenceTurnIds: [],
    confidence: "low" as const,
  }));
  return {
    findings,
    inputHash: reportInputHash(turns),
    result: { findings, source: "fallback", reason: "report_generator_unavailable" },
    usage: {},
    model: "fallback-static-v1",
    source: "fallback",
  };
}

function parseModelText(raw: string, turns: ReportTranscriptTurn[]): ReportFindingInput[] {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = rawReportSchema.parse(JSON.parse(stripped));
  const validTurnIds = new Set(turns.map((turn) => turn.turnId));
  return parsed.findings.map((finding) => ({
    ...finding,
    evidenceTurnIds: finding.evidenceTurnIds.filter((id) => validTurnIds.has(id)),
  }));
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
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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
    const findings = parseModelText(text, turns);
    return {
      findings,
      inputHash: reportInputHash(turns),
      result: { findings },
      usage: usageFrom(data),
      model,
      source: "gemini",
    };
  } finally {
    clearTimeout(timeout);
  }
}
