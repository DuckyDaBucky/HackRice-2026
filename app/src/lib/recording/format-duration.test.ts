import { describe, expect, it } from "vitest";
import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(45_000)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(600_000)).toBe("10:00");
  });

  it("truncates partial seconds rather than rounding up", () => {
    expect(formatDuration(1_999)).toBe("0:01");
  });

  it("clamps negative durations to 0:00", () => {
    expect(formatDuration(-500)).toBe("0:00");
  });
});
