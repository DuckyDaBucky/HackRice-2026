import { describe, expect, it } from "vitest";
import { PresageBusyError, summarizeVideoAnalysis, videoAnalysisSchema } from "../src/lib/biometrics/contracts";

const sampleAnalysis = {
  analysisId: "11111111-1111-1111-1111-111111111111",
  sdkVersion: "3.3.0",
  requestedMetrics: [1, 2, 3],
  status: "completed",
  eventCounts: { metrics: 42, accumulated_metrics: 1 },
  events: [{ type: "metrics", emittedAt: "2026-09-12T00:00:00Z" }],
};

describe("videoAnalysisSchema", () => {
  it("accepts a well-formed presage-api response", () => {
    const parsed = videoAnalysisSchema.parse(sampleAnalysis);
    expect(parsed.analysisId).toBe(sampleAnalysis.analysisId);
  });

  it("rejects a response missing required fields", () => {
    expect(() => videoAnalysisSchema.parse({ analysisId: "x" })).toThrow();
  });
});

describe("summarizeVideoAnalysis", () => {
  it("keeps only the small display-ready fields, dropping the raw event stream", () => {
    const parsed = videoAnalysisSchema.parse(sampleAnalysis);
    const summary = summarizeVideoAnalysis(parsed);
    expect(summary).toEqual({
      analysisId: sampleAnalysis.analysisId,
      sdkVersion: sampleAnalysis.sdkVersion,
      eventCounts: sampleAnalysis.eventCounts,
    });
    expect(summary).not.toHaveProperty("events");
  });
});

describe("PresageBusyError", () => {
  it("carries the retry-after hint", () => {
    const error = new PresageBusyError(7);
    expect(error.retryAfterSeconds).toBe(7);
    expect(error.name).toBe("PresageBusyError");
  });
});
