import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-12T12:00:00Z");

  it("collapses very recent timestamps to 'just now'", () => {
    expect(formatRelativeTime("2026-09-12T11:59:57Z", now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    expect(formatRelativeTime("2026-09-12T11:55:00Z", now)).toBe("5 minutes ago");
  });

  it("formats hours ago", () => {
    expect(formatRelativeTime("2026-09-12T09:00:00Z", now)).toBe("3 hours ago");
  });

  it("formats days ago", () => {
    expect(formatRelativeTime("2026-09-10T12:00:00Z", now)).toBe("2 days ago");
  });

  it("formats weeks ago", () => {
    expect(formatRelativeTime("2026-08-29T12:00:00Z", now)).toBe("2 weeks ago");
  });
});
