import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createPersonaInquiry: vi.fn(),
  requireHiringEnabled: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("../src/lib/persona/client", () => ({
  createPersonaInquiry: mocks.createPersonaInquiry,
  personaSandboxLabel: () => "",
}));
vi.mock("../src/lib/hiring/config", () => ({
  requireHiringEnabled: mocks.requireHiringEnabled,
}));

import { candidateStartPersona } from "../src/app/candidate/actions";

describe("Persona browser callback does not verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PERSONA_ENV", "sandbox");
    mocks.requireHiringEnabled.mockReturnValue(undefined);
    mocks.createPersonaInquiry.mockResolvedValue({ inquiryId: "inq-ui", inquiryRef: "ref-ui" });
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("candidateStartPersona only inserts pending verification attempts", async () => {
    await candidateStartPersona("inv-1", "cand-1");

    const insertCall = mocks.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO verification_attempts"));
    expect(insertCall).toBeDefined();
    expect(String(insertCall?.[0])).toContain("'pending'");
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("verified"))).toBe(false);
  });
});
