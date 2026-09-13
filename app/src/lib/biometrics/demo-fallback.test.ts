import { describe, expect, it } from "vitest";
import {
  biometricNoteFor,
  composureSignalsFor,
  isDemoMetrics,
  syntheticDemoMetrics,
} from "./contracts";

describe("syntheticDemoMetrics", () => {
  it("matches the summarized shape with plausible vitals", () => {
    const metrics = syntheticDemoMetrics();
    expect(metrics.demoMode).toBe(true);
    expect(typeof metrics.analysisId).toBe("string");
    const pulse = metrics.pulseBpm as { avg: number; samples: number };
    expect(pulse.avg).toBeGreaterThanOrEqual(60);
    expect(pulse.avg).toBeLessThanOrEqual(110);
    expect(pulse.samples).toBeGreaterThanOrEqual(8);
    const breath = metrics.breathingPerMin as { avg: number };
    expect(breath.avg).toBeGreaterThanOrEqual(10);
    expect(breath.avg).toBeLessThanOrEqual(25);
  });

  it("is detectable and labeled everywhere it surfaces", () => {
    const metrics = syntheticDemoMetrics();
    expect(isDemoMetrics(metrics)).toBe(true);
    expect(isDemoMetrics({})).toBe(false);
    expect(isDemoMetrics(null)).toBe(false);
    const note = biometricNoteFor(metrics);
    expect(note).toContain("demo preview");
    expect(note).toContain("simulated");
  });

  it("flows through composure signals like real summaries", () => {
    const signals = composureSignalsFor(syntheticDemoMetrics());
    expect(Array.isArray(signals)).toBe(true);
  });
});
