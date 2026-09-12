import { describe, expect, it } from "vitest";
import {
  interviewSetupSchema,
  planLengthFor,
  transcriptSegmentSchema,
} from "../src/lib/interviews/contracts";
import {
  canAccessSessionArtifact,
  createSessionClock,
  elapsedSessionTime,
  pauseSessionClock,
  resumeSessionClock,
  transitionSession,
} from "../src/lib/interviews/state";

describe("durable interview setup contract", () => {
  it("accepts granular content choices and deduplicates them", () => {
    const setup = interviewSetupSchema.parse({
      contentTypes: ["system_design", "behavioral", "system_design"],
      targetRole: "Backend engineer",
      seniority: "mid_level",
      focusArea: "distributed systems",
      timeBudgetSeconds: 1200,
      voiceId: null,
      mood: "neutral",
    });
    expect(setup.contentTypes).toEqual(["system_design", "behavioral"]);
    expect(planLengthFor(setup.timeBudgetSeconds)).toEqual({ minimum: 5, target: 6, maximum: 7 });
  });

  it("rejects an unbounded duration or unsupported content type", () => {
    expect(() => interviewSetupSchema.parse({
      contentTypes: ["leetcode"],
      targetRole: "Engineer",
      seniority: "junior",
      focusArea: null,
      timeBudgetSeconds: 900,
      voiceId: null,
      mood: "neutral",
    })).toThrow();
  });

  it("requires timestamped transcript segments to have a valid range", () => {
    expect(transcriptSegmentSchema.parse({ startMs: 10, endMs: 20, text: "A saved answer." })).toMatchObject({
      startMs: 10,
    });
    expect(() => transcriptSegmentSchema.parse({ startMs: 20, endMs: 10, text: "Invalid." })).toThrow();
  });
});

describe("durable interview session state", () => {
  it("freezes the timer during a leave and resumes it later", () => {
    const started = createSessionClock(1_000);
    const paused = pauseSessionClock(started, 5_000);
    expect(elapsedSessionTime(paused, 100_000)).toBe(4_000);
    const resumed = resumeSessionClock(paused, 100_000);
    expect(elapsedSessionTime(resumed, 103_000)).toBe(7_000);
  });

  it("permits resumable leave state but prevents access after deletion", () => {
    expect(transitionSession("in_progress", "pause")).toBe("paused");
    expect(transitionSession("paused", "resume")).toBe("in_progress");
    expect(() => transitionSession("completed", "resume")).toThrow();
    expect(canAccessSessionArtifact("in_progress", null)).toBe(true);
    expect(canAccessSessionArtifact("deleted", new Date())).toBe(false);
  });
});
