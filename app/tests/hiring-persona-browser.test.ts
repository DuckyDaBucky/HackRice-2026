import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  createPersonaInquiry: vi.fn(),
  requireHiringEnabled: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ orm: { insert: mocks.insert, update: mocks.update } }));
vi.mock("../src/lib/persona/client", () => ({
  createPersonaInquiry: mocks.createPersonaInquiry,
  personaSandboxLabel: () => "",
}));
vi.mock("../src/lib/hiring/config", () => ({
  requireHiringEnabled: mocks.requireHiringEnabled,
}));

import { stubQuery } from "./helpers/drizzle-stub";
import { candidateStartPersona } from "../src/app/candidate/actions";

describe("Persona browser callback does not verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PERSONA_ENV", "sandbox");
    mocks.requireHiringEnabled.mockReturnValue(undefined);
    mocks.createPersonaInquiry.mockResolvedValue({ inquiryId: "inq-ui", inquiryRef: "ref-ui" });
    mocks.insert.mockReturnValue(stubQuery([{ id: "attempt-1" }]));
  });

  it("candidateStartPersona only inserts pending verification attempts", async () => {
    await candidateStartPersona("inv-1", "cand-1");

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
