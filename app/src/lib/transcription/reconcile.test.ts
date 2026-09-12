import { describe, expect, it } from "vitest";
import { reconcileTranscripts } from "./reconcile";

describe("reconcileTranscripts", () => {
  it("prefers the batch transcript when present", () => {
    const result = reconcileTranscripts({
      liveText: "i worked on a group project",
      batchText: "I worked on a group project with Postgres.",
      batchConfidence: 0.94,
      batchProvider: "deepgram",
    });
    expect(result.source).toBe("batch");
    expect(result.text).toBe("I worked on a group project with Postgres.");
    expect(result.confidence).toBe(0.94);
    expect(result.provider).toBe("deepgram");
  });

  it("falls back to live text when batch is empty", () => {
    const result = reconcileTranscripts({
      liveText: "live fallback",
      liveConfidence: 0.6,
      batchText: "",
    });
    expect(result).toEqual({
      text: "live fallback",
      source: "live",
      confidence: 0.6,
      provider: null,
    });
  });

  it("rejects a suspiciously short batch result", () => {
    const liveText = "one two three four five six seven eight nine ten eleven twelve";
    const result = reconcileTranscripts({ liveText, batchText: "one two" });
    expect(result.source).toBe("live");
    expect(result.text).toBe(liveText);
  });
});
