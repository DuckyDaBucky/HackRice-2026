import { describe, expect, it } from "vitest";
import {
  buildLiveVisualContextBlock,
  describeCameraObservations,
  sanitizeVisualNote,
} from "./live-context";

describe("describeCameraObservations", () => {
  it("returns null without an observation", () => {
    expect(describeCameraObservations(null)).toBeNull();
  });

  it("reports camera off", () => {
    expect(
      describeCameraObservations({ cameraOn: false, presence: "unknown", light: "unknown", motion: "unknown" }),
    ).toBe("camera off");
  });

  it("summarizes a steady visible candidate", () => {
    expect(
      describeCameraObservations({ cameraOn: true, presence: "visible", light: "ok", motion: "still" }),
    ).toContain("steady framing");
  });
});

describe("buildLiveVisualContextBlock", () => {
  it("returns null when both signals are missing", () => {
    expect(buildLiveVisualContextBlock({})).toBeNull();
  });

  it("combines camera and presage signals with guardrails", () => {
    const block = buildLiveVisualContextBlock({
      camera: { cameraOn: true, presence: "visible", light: "ok", motion: "moderate" },
      presageNotes: "heart rate settled through the answer",
    });
    expect(block).toContain("Live camera:");
    expect(block).toContain("SmartSpectra");
    expect(block).toContain("never be used to score");
  });

  it("clips oversized presage notes", () => {
    const block = buildLiveVisualContextBlock({ presageNotes: `x`.repeat(2000) });
    expect(block!.length).toBeLessThan(1200);
  });
});

describe("sanitizeVisualNote", () => {
  it("rejects non-strings and blanks", () => {
    expect(sanitizeVisualNote(undefined)).toBeNull();
    expect(sanitizeVisualNote("   ")).toBeNull();
  });
});
