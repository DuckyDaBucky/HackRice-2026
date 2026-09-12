import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
  getV2ResumeState: vi.fn(),
  requireOrgMembership: vi.fn(),
  getProvisionedOrganization: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("../src/lib/db", () => ({ orm: { select: mocks.select } }));
vi.mock("../src/lib/interviews/persistence", () => ({
  getV2ResumeState: mocks.getV2ResumeState,
}));
vi.mock("../src/lib/hiring/access", () => ({
  requireOrgMembership: mocks.requireOrgMembership,
  getProvisionedOrganization: mocks.getProvisionedOrganization,
}));

import { stubQuery } from "./helpers/drizzle-stub";
import { resolveSessionPrincipal } from "../src/lib/access/session-principal";

describe("resolveSessionPrincipal access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-a" });
    mocks.getV2ResumeState.mockResolvedValue(null);
    mocks.requireOrgMembership.mockResolvedValue({ role: "admin" });
    mocks.getProvisionedOrganization.mockResolvedValue({ id: "org-db-1" });
  });

  it("grants assigned candidate access to their hiring session", async () => {
    mocks.select.mockReturnValueOnce(stubQuery([{
      candidacyId: "cand-1",
      organizationId: "org-db-1",
      clerkUserId: "user-a",
    }]));

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toEqual({
      kind: "assigned_candidate",
      clerkUserId: "user-a",
      sessionId: "session-hire-1",
      candidacyId: "cand-1",
    });
  });

  it("denies cross-candidate access to a hiring session", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{
        candidacyId: "cand-1",
        organizationId: "org-db-1",
        clerkUserId: "user-candidate",
      }]))
      .mockReturnValueOnce(stubQuery([]));

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toBeNull();
  });

  it("grants org recruiter access when membership is provisioned", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{
        candidacyId: "cand-1",
        organizationId: "org-db-1",
        clerkUserId: "user-candidate",
      }]))
      .mockReturnValueOnce(stubQuery([{ clerkOrgId: "org-clerk-1" }]));

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal?.kind).toBe("org_recruiter");
    if (principal?.kind === "org_recruiter") {
      expect(principal.organizationId).toBe("org-db-1");
    }
  });

  it("denies cross-org recruiter when membership check fails", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{
        candidacyId: "cand-1",
        organizationId: "org-db-1",
        clerkUserId: "user-candidate",
      }]))
      .mockReturnValueOnce(stubQuery([{ clerkOrgId: "org-clerk-1" }]));
    mocks.requireOrgMembership.mockRejectedValue(new Error("Not a member"));

    const principal = await resolveSessionPrincipal("session-hire-1");
    expect(principal).toBeNull();
  });

  it("returns practice owner for non-hiring sessions", async () => {
    mocks.select.mockReturnValueOnce(stubQuery([]));
    mocks.getV2ResumeState.mockResolvedValue({ sessionId: "session-practice-1" });

    const principal = await resolveSessionPrincipal("session-practice-1");
    expect(principal).toEqual({
      kind: "practice_owner",
      clerkUserId: "user-a",
      sessionId: "session-practice-1",
    });
  });

  it("returns null when practice session belongs to another user", async () => {
    mocks.select.mockReturnValueOnce(stubQuery([]));
    mocks.getV2ResumeState.mockResolvedValue(null);

    const principal = await resolveSessionPrincipal("session-other");
    expect(principal).toBeNull();
  });
});
