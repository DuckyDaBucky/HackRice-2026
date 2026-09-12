import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireOrgAccess: vi.fn(),
  enqueueSolanaAction: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("../src/lib/hiring/access", () => ({ requireOrgAccess: mocks.requireOrgAccess }));
vi.mock("../src/lib/solana/outbox", () => ({ enqueueSolanaAction: mocks.enqueueSolanaAction }));

import { bindCandidateEmail, exchangeInvitationSecret } from "../src/lib/hiring/invitations";
import { generateInvitationSecret, hashSecret } from "../src/lib/hiring/crypto";

describe("invitation security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgAccess.mockResolvedValue(undefined);
    mocks.enqueueSolanaAction.mockResolvedValue(undefined);
  });

  it("rejects expired, revoked, or missing active invitations", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    expect(await exchangeInvitationSecret("bad-secret")).toBeNull();
  });

  it("accepts a valid active invitation secret", async () => {
    const secret = generateInvitationSecret();
    const secretHash = hashSecret(secret);
    mocks.query.mockResolvedValue({
      rows: [{
        id: "inv-1",
        secret_hash: secretHash,
        candidacy_id: "cand-1",
        confirmed_email: "candidate@example.com",
        confirmed_name: "Alex Candidate",
        organization_id: "org-1",
        job_title: "Engineer",
        org_name: "Acme",
      }],
    });

    const row = await exchangeInvitationSecret(secret);
    expect(row?.id).toBe("inv-1");
    expect(row?.candidacy_id).toBe("cand-1");
  });

  it("rejects email binding when Clerk email does not match confirmed email", async () => {
    mocks.query.mockResolvedValue({
      rows: [{
        id: "inv-1",
        candidacy_id: "cand-1",
        confirmed_email: "expected@example.com",
        status: "active",
      }],
    });

    await expect(
      bindCandidateEmail({
        invitationId: "inv-1",
        clerkUserId: "user-1",
        verifiedEmail: "other@example.com",
      }),
    ).rejects.toThrow("Sign in with the email address your recruiter confirmed.");
  });

  it("binds candidate when verified email matches confirmed email", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: "inv-1",
          candidacy_id: "cand-1",
          confirmed_email: "candidate@example.com",
          status: "active",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const row = await bindCandidateEmail({
      invitationId: "inv-1",
      clerkUserId: "user-1",
      verifiedEmail: "Candidate@Example.com",
    });

    expect(row.candidacy_id).toBe("cand-1");
    expect(mocks.query.mock.calls[1]?.[0]).toContain("verification_pending");
  });

  it("hashes invitation secrets consistently for lookup", () => {
    const secret = "test-invitation-secret-value";
    expect(hashSecret(secret)).toBe(createHash("sha256").update(secret).digest("hex"));
  });
});
