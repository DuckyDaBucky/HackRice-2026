import { describe, expect, it, beforeEach, afterEach } from "vitest";

describe("hiring config flags", () => {
  const original = process.env.HIRING_ENABLED;

  afterEach(() => {
    process.env.HIRING_ENABLED = original;
  });

  it("defaults hiring to disabled", async () => {
    delete process.env.HIRING_ENABLED;
    const { hiringEnabled } = await import("@/lib/hiring/config");
    expect(hiringEnabled()).toBe(false);
  });

  it("enables when HIRING_ENABLED=true", async () => {
    process.env.HIRING_ENABLED = "true";
    const { hiringEnabled } = await import("@/lib/hiring/config");
    expect(hiringEnabled()).toBe(true);
  });
});
