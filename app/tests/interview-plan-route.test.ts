import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("../src/lib/interviews/persistence", () => ({
  beginSessionPlanning: mocks.begin,
  completeSessionPlan: mocks.complete,
  failSessionPlanning: mocks.fail,
}));
vi.mock("../src/lib/interviews/planner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/interviews/planner")>()),
  generateInterviewPlan: mocks.generate,
}));

import { POST } from "../src/app/api/interviews/route";

const validSetup = {
  contentTypes: ["system_design"],
  targetRole: "Backend engineer",
  seniority: "mid_level",
  focusArea: null,
  timeBudgetSeconds: 600,
  voiceId: null,
  mood: "neutral",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: "user-1" });
  mocks.begin.mockResolvedValue({ sessionId: "session-1", generationId: "generation-1", configRevision: 1 });
  mocks.complete.mockResolvedValue(undefined);
  mocks.fail.mockResolvedValue(undefined);
  mocks.generate.mockResolvedValue({
    questions: [{ position: 1, contentType: "system_design", prompt: "How would you design a reliable API?" }],
    result: { questions: [] },
    usage: {},
  });
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/interviews", () => {
  it("requires an authenticated same-origin request", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await POST(new Request("http://localhost:3000/api/interviews", { method: "POST" }))).status).toBe(401);
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    expect((await POST(new Request("http://localhost:3000/api/interviews", {
      method: "POST",
      headers: { origin: "https://other.example" },
    }))).status).toBe(403);
  });

  it("persists a planning draft before invoking the planner", async () => {
    const response = await POST(new Request("http://localhost:3000/api/interviews", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify(validSetup),
    }));
    expect(response.status).toBe(201);
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ clerkUserId: "user-1", setup: validSetup }));
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1", generationId: "generation-1" }));
    expect(mocks.fail).not.toHaveBeenCalled();
  });

  it("persists a fallback plan when the provider fails", async () => {
    mocks.generate.mockRejectedValue(new Error("provider down"));
    const response = await POST(new Request("http://localhost:3000/api/interviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSetup),
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).planSource).toBe("fallback");
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1", generationId: "generation-1", model: "fallback-static-v1",
    }));
    expect(mocks.fail).not.toHaveBeenCalled();
  });
});
