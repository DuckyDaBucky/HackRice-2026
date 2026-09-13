import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  enqueueSolanaAction: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("../src/lib/solana/outbox", () => ({ enqueueSolanaAction: mocks.enqueueSolanaAction }));

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
    expect(mocks.query).not.toHaveBeenCalled();
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
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: "c1",
          clerk_user_id: "u1",
          organization_id: "org-1",
          confirmed_name: "Alex Candidate",
          status: "verification_pending",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await confirmSandboxIdentity({
      candidacyId: "c1",
      invitationId: "i1",
      clerkUserId: "u1",
    });
    expect(result).toEqual({ verificationStatus: "verified", sandboxBypass: true });
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain("'verified'");
    expect(mocks.query.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["c1", "i1", "sandbox-bypass:c1:i1"]));
    expect(mocks.enqueueSolanaAction).toHaveBeenCalledWith(expect.objectContaining({ action: "attest_identity" }));
  });

  it("rejects a different Clerk user", async () => {
    vi.stubEnv("PERSONA_ENV", "sandbox");
    vi.stubEnv("PERSONA_SANDBOX_BYPASS", "true");
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: "c1",
        clerk_user_id: "u-other",
        organization_id: "org-1",
        confirmed_name: "Alex Candidate",
        status: "verification_pending",
      }],
    });

    await expect(
      confirmSandboxIdentity({ candidacyId: "c1", invitationId: "i1", clerkUserId: "u1" }),
    ).rejects.toThrow("Sign in with the email address your recruiter confirmed.");
  });
});
