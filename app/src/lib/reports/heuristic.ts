import type { ReportFindingInput, ReportOverview, ReportTranscriptTurn } from "./contracts";

/**
 * Deterministic local scorer so Answer accuracy is never stuck at all-zeros
 * when the provider is unavailable, rate-limited, or a transcript is thin.
 * Used as the fallback path and for instant per-answer feedback while the
 * full AI review is still running.
 */

const FILLERS = /\b(um+|uh+|like|you know|basically|actually|stuff|things?)\b/gi;

function scoreOne(text: string): { verdict: ReportFindingInput["verdict"]; explanation: string; improvement: string | null } {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentences = trimmed ? trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length : 0;
  const fillerHits = (trimmed.match(FILLERS) ?? []).length;
  const hasStar = /situation|task|action|result|outcome|learned|impact|metric|percent|%\b|\d+/i.test(trimmed);
  const hasStructure = sentences >= 3 && words >= 60;

  if (words < 10) {
    return {
      verdict: "insufficient_evidence",
      explanation: `Only ${words} words were captured, so there isn't enough to judge fairly.`,
      improvement: null,
    };
  }
  if (words < 30 || fillerHits > Math.max(3, words * 0.08)) {
    return {
      verdict: "inaccuracy",
      explanation: `Short or filler-heavy answer (${words} words, ~${fillerHits} filler words) that misses a concrete example.`,
      improvement: "Restate the question, give one specific example with what you did, and end with the outcome.",
    };
  }
  if (!hasStar || !hasStructure) {
    return {
      verdict: "mistake",
      explanation: `Answer has substance (${words} words) but lacks a clear situation-action-outcome structure.`,
      improvement: "Use STAR: 1 sentence of context, 2-3 on your actions, 1 on measured outcome.",
    };
  }
  if (words >= 120 && hasStar && fillerHits <= 2) {
    return {
      verdict: "best",
      explanation: `Thorough, structured answer (${words} words) with a concrete example and outcome.`,
      improvement: null,
    };
  }
  return {
    verdict: "good",
    explanation: `Solid answer (${words} words) with a relevant example; could tighten wording and quantify impact.`,
    improvement: "Add one number (time saved, users, latency) to make the impact concrete.",
  };
}

export function heuristicFindings(turns: ReportTranscriptTurn[]): ReportFindingInput[] {
  return turns
    .filter((t) => t.kind === "candidate_answer" && t.text?.trim())
    .map((t) => {
      const scored = scoreOne(t.text as string);
      return { turnId: t.turnId, ...scored };
    });
}

export function heuristicOverview(findings: ReportFindingInput[]): ReportOverview {
  if (findings.length === 0) {
    return {
      summary: "No substantive answers were captured yet, so there is nothing to score.",
      keyProblems: ["Answer out loud for at least 30 seconds per question so the reviewer has evidence."],
    };
  }
  const weak = findings.filter((f) => f.verdict === "mistake" || f.verdict === "blunder").length;
  const thin = findings.filter((f) => f.verdict === "inaccuracy" || f.verdict === "insufficient_evidence").length;
  return {
    summary: `Local quick review of ${findings.length} answers while the full AI review runs. ${weak > 0 ? `${weak} need restructuring. ` : ""}${thin > 0 ? `${thin} are too thin. ` : ""}Open any answer to see why.`,
    keyProblems: [
      ...(thin > 0 ? ["Give longer answers with one concrete example per question."] : []),
      ...(weak > 0 ? ["Use situation → action → measured outcome in every answer."] : []),
      "Quantify impact with a number wherever possible.",
    ].slice(0, 5),
  };
}
