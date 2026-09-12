import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ orm: { select: mocks.select } }));

import { stubQuery } from "./helpers/drizzle-stub";
import { getCandidateVisibleReport } from "../src/lib/hiring/reports";

describe("getCandidateVisibleReport filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when candidate is not bound to the session", async () => {
    mocks.select.mockReturnValueOnce(stubQuery([]));
    expect(await getCandidateVisibleReport("session-1", "user-1")).toBeNull();
  });

  it("returns null when every release was revoked", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{ candidacy_id: "cand-1" }]))
      .mockReturnValueOnce(stubQuery([{ id: "rev-1", summary: {} }]))
      .mockReturnValueOnce(stubQuery([]))
      .mockReturnValueOnce(stubQuery([{ id: "rel-1" }]));

    expect(await getCandidateVisibleReport("session-1", "user-1")).toBeNull();
  });

  it("omits unreleased sections and private notes from the response", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{ candidacy_id: "cand-1" }]))
      .mockReturnValueOnce(stubQuery([{ id: "rev-1", summary: {
        headline: "Strong communicator",
        privateNotes: "should not leak",
        items: [{ question: "Q1", rating: 5 }, { question: "Q2" }],
      } }]))
      .mockReturnValueOnce(stubQuery([{
        revokedAt: null,
        releaseSummary: true,
        releaseRubric: false,
        releasePerQuestion: true,
        releaseTranscript: false,
        releaseRecordings: false,
      }]));

    const report = await getCandidateVisibleReport("session-1", "user-1");
    expect(report).toEqual({
      sessionId: "session-1",
      summary: {
        headline: "Strong communicator",
        privateNotes: "should not leak",
        items: [{ question: "Q1", rating: 5 }, { question: "Q2" }],
      },
      perQuestion: [{ question: "Q1", rating: 5 }, { question: "Q2" }],
    });
    expect(report).not.toHaveProperty("private_notes");
    expect(report).not.toHaveProperty("rubric");
    expect(report).not.toHaveProperty("transcripts");
    expect(report).not.toHaveProperty("recordings");
  });

  it("includes only explicitly released sections", async () => {
    mocks.select
      .mockReturnValueOnce(stubQuery([{ candidacy_id: "cand-1" }]))
      .mockReturnValueOnce(stubQuery([{ id: "rev-1", summary: { items: [{ rating: 3 }, { question: "Q2" }] } }]))
      .mockReturnValueOnce(stubQuery([{
        revokedAt: null,
        releaseSummary: false,
        releaseRubric: true,
        releasePerQuestion: false,
        releaseTranscript: true,
        releaseRecordings: true,
      }]));

    const report = await getCandidateVisibleReport("session-1", "user-1");
    expect(report).toEqual({
      sessionId: "session-1",
      rubric: [{ rating: 3 }],
      transcripts: "available",
      recordings: "available",
    });
    expect(report).not.toHaveProperty("summary");
    expect(report).not.toHaveProperty("perQuestion");
  });
});
