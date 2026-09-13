import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  getV2ResumeState: vi.fn(),
  requireOrgMembership: vi.fn(),
  getProvisionedOrganization: vi.fn(),
  isHiringSuperadmin: vi.fn(),
  userHasHrAccess: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("../src/lib/interviews/persistence", () => ({
  getV2ResumeState: mocks.getV2ResumeState,
}));
vi.mock("../src/lib/hiring/access", () => ({
  requireOrgMembership: mocks.requireOrgMembership,
  getProvisionedOrganization: mocks.getProvisionedOrganization,
}));
vi.mock("../src/lib/hiring/superadmin", () => ({
  isHiringSuperadmin: mocks.isHiringSuperadmin,
}));
vi.mock("../src/lib/user-roles", () => ({
  userHasHrAccess: mocks.userHasHrAccess,
}));

import { resolveSessionPrincipal } from "../src/lib/access/session-principal";

describe("resolveSessionPrincipal access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-a" });
    mocks.getV2ResumeState.mockResolvedValue(null);
    mocks.requireOrgMembership.mockResolvedValue({ role: "admin" });
    mocks.getProvisionedOrganization.mockResolvedValue({ id: "org-db-1" });
    mocks.isHiringSuperadmin.mockResolvedValue(false);
    mocks.userHasHrAccess.mockResolvedValue(false);
  });

  it("grants assigned candidate access to their hiring session", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          candidacy_id: "cand-1",
          organization_id: "org-db-1",
          clerk_user_id: "user-a",
          policy: {},
        }],
      });

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toEqual({
      kind: "assigned_candidate",
      clerkUserId: "user-a",
      sessionId: "session-hire-1",
      candidacyId: "cand-1",
    });
  });

  it("denies cross-candidate access to a hiring session", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          candidacy_id: "cand-1",
          organization_id: "org-db-1",
          clerk_user_id: "user-candidate",
          policy: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toBeNull();
  });

  it("grants org recruiter access when membership is provisioned", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          candidacy_id: "cand-1",
          organization_id: "org-db-1",
          clerk_user_id: "user-candidate",
          policy: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [{ clerk_org_id: "org-clerk-1" }] });

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal?.kind).toBe("org_recruiter");
    if (principal?.kind === "org_recruiter") {
      expect(principal.organizationId).toBe("org-db-1");
    }
  });

  it("denies cross-org recruiter when membership check fails", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          candidacy_id: "cand-1",
          organization_id: "org-db-1",
          clerk_user_id: "user-candidate",
          policy: {},
        }],
      })
      .mockResolvedValueOnce({ rows: [{ clerk_org_id: "org-clerk-1" }] });
    mocks.requireOrgMembership.mockRejectedValue(new Error("Not a member"));

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toBeNull();
  });

  it("returns practice owner for non-hiring sessions", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    mocks.getV2ResumeState.mockResolvedValue({ sessionId: "session-practice-1" });

    const principal = await resolveSessionPrincipal("session-practice-1");
    expect(principal).toEqual({
      kind: "practice_owner",
      clerkUserId: "user-a",
      sessionId: "session-practice-1",
    });
  });

  it("returns null when practice session belongs to another user", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    mocks.getV2ResumeState.mockResolvedValue(null);

    const principal = await resolveSessionPrincipal("session-other");
    expect(principal).toBeNull();
  });
});
