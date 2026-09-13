import { describe, expect, it } from "vitest";
import {
  PresageBusyError,
  composureSignalsFor,
  extractVitalSeries,
  summarizeVideoAnalysis,
  videoAnalysisSchema,
} from "../src/lib/biometrics/contracts";

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
    expect(summary).toMatchObject({
      analysisId: sampleAnalysis.analysisId,
      sdkVersion: sampleAnalysis.sdkVersion,
      eventCounts: sampleAnalysis.eventCounts,
    });
    expect(summary).not.toHaveProperty("events");
    expect(summary.metricReadouts).toBe(43);
    expect(summary.biometricEvents).toBe(43);
  });
});

describe("PresageBusyError", () => {
  it("carries the retry-after hint", () => {
    const error = new PresageBusyError(7);
    expect(error.retryAfterSeconds).toBe(7);
    expect(error.name).toBe("PresageBusyError");
  });
});

function metricEvents(values: number[], key = "pulseRateBpm") {
  return values.map((value, i) => ({
    type: "metrics",
    emittedAt: "2026-09-12T00:00:00Z",
    timestampUs: i * 1_000_000,
    data: { [key]: value },
  }));
}

describe("extractVitalSeries", () => {
  it("collects plausible pulse readings ordered by event time", () => {
    const series = extractVitalSeries(metricEvents([72, 78, 110, 115]), /(pulse|heart|bpm|cardio)/i, 30, 220);
    expect(series).toMatchObject({ samples: 4, avg: 93.75, min: 72, max: 115 });
    expect(series?.trend).toBeGreaterThan(1.1);
  });

  it("rejects confidences, timestamps and enum codes outside the window", () => {
    const series = extractVitalSeries(
      [{ type: "metrics", emittedAt: "x", timestampUs: 0, data: { confidence: 0.97, pulseRateBpm: 68, code: 3, ts: 9999999999 } },
       { type: "metrics", emittedAt: "x", timestampUs: 1, data: { pulseRateBpm: 70 } },
       { type: "metrics", emittedAt: "x", timestampUs: 2, data: { pulseRateBpm: 72 } }],
      /(pulse|heart|bpm|cardio)/i,
      30,
      220,
    );
    expect(series?.samples).toBe(3);
    expect(series?.avg).toBeCloseTo(70, 5);
  });

  it("returns null without enough samples or without metric events", () => {
    expect(extractVitalSeries(metricEvents([80, 82]), /(pulse)/i, 30, 220)).toBeNull();
    expect(extractVitalSeries([{ type: "processing_status", emittedAt: "x" }], /(pulse)/i, 30, 220)).toBeNull();
    expect(extractVitalSeries(undefined, /(pulse)/i, 30, 220)).toBeNull();
  });
});

describe("composureSignalsFor", () => {
  it("flags elevated and rising heart rate plus rapid breathing", () => {
    const summary = summarizeVideoAnalysis(
      videoAnalysisSchema.parse({
        ...sampleAnalysis,
        events: [
          ...metricEvents([102, 104, 112, 118]),
          ...metricEvents([21, 22, 23, 24], "breathingRatePerMin"),
        ],
      }),
    );
    const signals = composureSignalsFor(summary);
    expect(signals.join(" ")).toMatch(/elevated heart rate/);
    expect(signals.join(" ")).toMatch(/rose through the answer/);
    expect(signals.join(" ")).toMatch(/rapid breathing/);
  });

  it("notes settling instead of tension when the trend falls", () => {
    const summary = summarizeVideoAnalysis(
      videoAnalysisSchema.parse({ ...sampleAnalysis, events: metricEvents([118, 112, 96, 88]) }),
    );
    expect(composureSignalsFor(summary)).toContain("heart rate settled through the answer");
  });

  it("stays silent on calm readings and legacy summaries", () => {
    const calm = summarizeVideoAnalysis(
      videoAnalysisSchema.parse({ ...sampleAnalysis, events: metricEvents([68, 70, 72, 71]) }),
    );
    expect(composureSignalsFor(calm)).toEqual([]);
    expect(composureSignalsFor({ eventCounts: { metrics: 5 }, metricReadouts: 5, biometricEvents: 5 })).toEqual([]);
    expect(composureSignalsFor({})).toEqual([]);
  });
});
