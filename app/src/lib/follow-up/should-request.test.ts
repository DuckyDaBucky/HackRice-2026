import { describe, expect, it } from "vitest";
import { shouldRequestFollowUp } from "./should-request";

describe("shouldRequestFollowUp", () => {
  it("returns false if a follow-up was already shown for this question", () => {
    expect(
      shouldRequestFollowUp({
        hasFollowUpAlready: true,
        msSinceLastFinalSegment: 5000,
        transcriptLength: 200,
      }),
    ).toBe(false);
  });

  it("returns false if the candidate hasn't paused long enough", () => {
    expect(
      shouldRequestFollowUp({
        hasFollowUpAlready: false,
        msSinceLastFinalSegment: 300,
        transcriptLength: 200,
      }),
    ).toBe(false);
  });

  it("returns false if too little has been said yet", () => {
    expect(
      shouldRequestFollowUp({
        hasFollowUpAlready: false,
        msSinceLastFinalSegment: 5000,
        transcriptLength: 5,
      }),
    ).toBe(false);
  });

  it("returns true once paused long enough with enough said and no prior follow-up", () => {
    expect(
      shouldRequestFollowUp({
        hasFollowUpAlready: false,
        msSinceLastFinalSegment: 2000,
        transcriptLength: 60,
      }),
    ).toBe(true);
  });
});
