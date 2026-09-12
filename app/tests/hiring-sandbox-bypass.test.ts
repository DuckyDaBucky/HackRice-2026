import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  enqueueSolanaAction: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ orm: { select: mocks.select, insert: mocks.insert, update: mocks.update } }));
vi.mock("../src/lib/solana/outbox", () => ({ enqueueSolanaAction: mocks.enqueueSolanaAction }));

import { stubQuery } from "./helpers/drizzle-stub";
import { confirmSandboxIdentity } from "../src/lib/persona/sandbox-bypass";

describe("sandbox identity bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueueSolanaAction.mockResolvedValue(undefined);
  });

  it("is rejected when PERSONA_ENV is production", async () => {
    vi.stubEnv("PERSONA_ENV", "production");
    vi.stubEnv("PERSONA_SANDBOX_BYPASS", "true");
    await expect(
      confirmSandboxIdentity({ candidacyId: "c1", invitationId: "i1", clerkUserId: "u1" }),
    ).rejects.toThrow("Sandbox identity confirmation is disabled.");
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("is rejected when the bypass flag is off", async () => {
    vi.stubEnv("PERSONA_ENV", "sandbox");
    vi.stubEnv("PERSONA_SANDBOX_BYPASS", "false");
    await expect(
      confirmSandboxIdentity({ candidacyId: "c1", invitationId: "i1", clerkUserId: "u1" }),
    ).rejects.toThrow("Sandbox identity confirmation is disabled.");
  });

  it("verifies only the bound Clerk user and records a sandbox attempt", async () => {
    vi.stubEnv("PERSONA_ENV", "sandbox");
    vi.stubEnv("PERSONA_SANDBOX_BYPASS", "true");
    mocks.select.mockReturnValueOnce(stubQuery([{
      id: "c1",
      clerkUserId: "u1",
      organizationId: "org-1",
      confirmedName: "Alex Candidate",
      status: "verification_pending",
    }]));
    mocks.insert.mockReturnValueOnce(stubQuery([{ id: "attempt-1" }]));
    mocks.update.mockReturnValueOnce(stubQuery([]));

    const result = await confirmSandboxIdentity({
      candidacyId: "c1",
      invitationId: "i1",
      clerkUserId: "u1",
    });
    expect(result).toEqual({ verificationStatus: "verified", sandboxBypass: true });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueSolanaAction).toHaveBeenCalledWith(expect.objectContaining({ action: "attest_identity" }));
  });

  it("rejects a different Clerk user", async () => {
    vi.stubEnv("PERSONA_ENV", "sandbox");
    vi.stubEnv("PERSONA_SANDBOX_BYPASS", "true");
    mocks.select.mockReturnValueOnce(stubQuery([{
      id: "c1",
      clerkUserId: "u-other",
      organizationId: "org-1",
      confirmedName: "Alex Candidate",
      status: "verification_pending",
    }]));

    await expect(
      confirmSandboxIdentity({ candidacyId: "c1", invitationId: "i1", clerkUserId: "u1" }),
    ).rejects.toThrow("Sign in with the email address your recruiter confirmed.");
  });
});
