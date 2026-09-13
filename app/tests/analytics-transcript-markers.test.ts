import { describe, expect, it } from "vitest";
import { deriveTranscriptMarkers } from "../src/lib/analytics/transcript-markers";

describe("deriveTranscriptMarkers", () => {
  it("finds no pauses in a continuous transcript", () => {
    const markers = deriveTranscriptMarkers([
      { startMs: 0, endMs: 1000, text: "So the way I approached it" },
      { startMs: 1200, endMs: 2000, text: "was to split the rollout into stages" },
    ]);
    expect(markers.longPauses).toHaveLength(0);
  });

  it("flags a gap between segments longer than the threshold", () => {
    const markers = deriveTranscriptMarkers([
      { startMs: 0, endMs: 1000, text: "So the way I approached it" },
      { startMs: 6000, endMs: 7000, text: "was to split the rollout into stages" },
    ]);
    expect(markers.longPauses).toHaveLength(1);
    expect(markers.longPauses[0].gapMs).toBe(5000);
  });

  it("counts filler words and computes a rate over total words", () => {
    const markers = deriveTranscriptMarkers([
      { startMs: 0, endMs: 1000, text: "Um so like I think it was, you know, a good call" },
    ]);
    expect(markers.fillerWordCount).toBe(3);
    expect(markers.wordCount).toBe(12);
    expect(markers.fillerWordRate).toBeCloseTo(3 / 12);
  });

  it("returns zero rate for an empty transcript", () => {
    const markers = deriveTranscriptMarkers([]);
    expect(markers.wordCount).toBe(0);
    expect(markers.fillerWordRate).toBe(0);
  });
});
