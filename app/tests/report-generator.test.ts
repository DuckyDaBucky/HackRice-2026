import { describe, expect, it } from "vitest";
import { createFallbackReport, reportInputHash } from "../src/lib/reports/generator";
import { rawReportSchema, REPORT_COMPETENCIES } from "../src/lib/reports/contracts";
import type { ReportTranscriptTurn } from "../src/lib/reports/contracts";

const turns: ReportTranscriptTurn[] = [
  {
    turnId: "11111111-1111-1111-1111-111111111111",
    planQuestionId: "22222222-2222-2222-2222-222222222222",
    kind: "candidate_answer",
    position: 1,
    prompt: "Tell me about a time you owned an ambiguous problem.",
    text: "I led the migration and made the call to roll it out in stages after our first attempt failed.",
    startMs: 0,
    endMs: 4000,
  },
];

describe("report fallback", () => {
  it("never fabricates a score when the generator is unavailable", () => {
    const fallback = createFallbackReport(turns);
    expect(fallback.source).toBe("fallback");
    expect(fallback.findings).toHaveLength(REPORT_COMPETENCIES.length);
    expect(fallback.findings.every((finding) => finding.kind === "insufficient_evidence")).toBe(true);
    expect(fallback.findings.every((finding) => finding.evidenceTurnIds.length === 0)).toBe(true);
  });

  it("hashes transcript input deterministically", () => {
    expect(reportInputHash(turns)).toHaveLength(64);
    expect(reportInputHash(turns)).toBe(reportInputHash(turns));
  });
});

describe("report finding schema", () => {
  it("accepts a well-formed model response", () => {
    const parsed = rawReportSchema.parse({
      findings: REPORT_COMPETENCIES.map((competencyId) => ({
        competencyId,
        kind: "insufficient_evidence",
        finding: "No relevant material in the transcript.",
        improvement: null,
        evidenceTurnIds: [],
        confidence: "low",
      })),
    });
    expect(parsed.findings).toHaveLength(REPORT_COMPETENCIES.length);
  });

  it("rejects a finding with an unknown competency", () => {
    expect(() =>
      rawReportSchema.parse({
        findings: [
          {
            competencyId: "not_a_real_competency",
            kind: "gap",
            finding: "x",
            improvement: "y",
            evidenceTurnIds: [],
            confidence: "low",
          },
        ],
      }),
    ).toThrow();
  });
});
