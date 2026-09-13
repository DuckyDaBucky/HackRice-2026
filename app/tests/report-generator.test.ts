import { describe, expect, it } from "vitest";
import { createFallbackReport, reportInputHash } from "../src/lib/reports/generator";
import { rawReportSchema, REPORT_VERDICTS } from "../src/lib/reports/contracts";
import type { ReportTranscriptTurn } from "../src/lib/reports/contracts";
import { reportScoreFromVerdicts } from "../src/lib/reports/scoring";

const turns: ReportTranscriptTurn[] = [
  {
    turnId: "11111111-1111-4111-8111-111111111111",
    planQuestionId: "22222222-2222-4222-8222-222222222222",
    kind: "candidate_answer",
    position: 1,
    prompt: "Tell me about a time you owned an ambiguous problem.",
    text: "I led the migration and made the call to roll it out in stages after our first attempt failed.",
    startMs: 0,
    endMs: 4000,
  },
];

describe("report fallback", () => {
  it("produces an instant heuristic verdict when the generator is unavailable", () => {
    const fallback = createFallbackReport(turns);
    expect(fallback.source).toBe("fallback");
    expect(fallback.findings).toHaveLength(1);
    expect(REPORT_VERDICTS).toContain(fallback.findings[0].verdict);
    expect(fallback.findings[0].turnId).toBe(turns[0].turnId);
    expect(fallback.overview.keyProblems.length).toBeGreaterThan(0);
  });

  it("produces no findings for a session with no answered turns", () => {
    const fallback = createFallbackReport([]);
    expect(fallback.findings).toHaveLength(0);
  });

  it("does not reward a long repetitive answer", () => {
    const fallback = createFallbackReport([
      { ...turns[0], text: Array.from({ length: 60 }, () => "synergy").join(" ") },
    ]);
    expect(fallback.findings[0].verdict).toBe("insufficient_evidence");
  });

  it("hashes transcript input deterministically", () => {
    expect(reportInputHash(turns)).toHaveLength(64);
    expect(reportInputHash(turns)).toBe(reportInputHash(turns));
  });
});

describe("canonical report score", () => {
  it("uses the report verdict values and counts skips as zero", () => {
    expect(reportScoreFromVerdicts(["best", "good"], 1)).toBe(60);
  });

  it("counts an attempted answer with insufficient evidence as zero", () => {
    expect(reportScoreFromVerdicts(["insufficient_evidence"], 0)).toBe(0);
  });
});

describe("report finding schema", () => {
  it("accepts a well-formed model response", () => {
    const parsed = rawReportSchema.parse({
      overview: { summary: "Overall solid.", keyProblems: ["Name the specific decision you made."] },
      findings: [
        {
          turnId: turns[0].turnId,
          verdict: "good",
          explanation: "Names a concrete action and outcome.",
          improvement: null,
        },
      ],
    });
    expect(parsed.findings).toHaveLength(1);
    expect(REPORT_VERDICTS).toContain(parsed.findings[0].verdict);
  });

  it("rejects a finding with an unknown verdict", () => {
    expect(() =>
      rawReportSchema.parse({
        overview: { summary: "x", keyProblems: ["y"] },
        findings: [
          {
            turnId: turns[0].turnId,
            verdict: "not_a_real_verdict",
            explanation: "x",
            improvement: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("requires at least one key problem in the overview", () => {
    expect(() =>
      rawReportSchema.parse({
        overview: { summary: "x", keyProblems: [] },
        findings: [
          { turnId: turns[0].turnId, verdict: "good", explanation: "x", improvement: null },
        ],
      }),
    ).toThrow();
  });
});
