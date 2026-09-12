import { describe, expect, it } from "vitest";
import { reportReleaseMaskSchema } from "@/lib/hiring/contracts";

describe("report release mask", () => {
  it("parses independent section flags", () => {
    const mask = reportReleaseMaskSchema.parse({
      summary: true,
      rubric: false,
      perQuestion: true,
      transcript: false,
      recordings: false,
    });
    expect(mask.summary).toBe(true);
    expect(mask.recordings).toBe(false);
  });
});
