import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));

import { getCandidateVisibleReport } from "../src/lib/hiring/reports";

describe("getCandidateVisibleReport filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when candidate is not bound to the session", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    expect(await getCandidateVisibleReport("session-1", "user-1")).toBeNull();
  });

  it("returns null when release was revoked", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ candidacy_id: "cand-1" }] })
      .mockResolvedValueOnce({
        rows: [{
          revoked_at: new Date(),
          release_summary: true,
          release_rubric: true,
          release_per_question: true,
          release_transcript: true,
          release_recordings: true,
          summary: { items: [{ rating: 4 }] },
        }],
      });

    expect(await getCandidateVisibleReport("session-1", "user-1")).toBeNull();
  });

  it("omits unreleased sections and private notes from the response", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ candidacy_id: "cand-1" }] })
      .mockResolvedValueOnce({
        rows: [{
          revoked_at: null,
          release_summary: true,
          release_rubric: false,
          release_per_question: true,
          release_transcript: false,
          release_recordings: false,
          private_notes: "internal only",
          summary: {
            headline: "Strong communicator",
            privateNotes: "should not leak",
            items: [{ question: "Q1", rating: 5 }, { question: "Q2" }],
          },
        }],
      });

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
    mocks.query
      .mockResolvedValueOnce({ rows: [{ candidacy_id: "cand-1" }] })
      .mockResolvedValueOnce({
        rows: [{
          revoked_at: null,
          release_summary: false,
          release_rubric: true,
          release_per_question: false,
          release_transcript: true,
          release_recordings: true,
          summary: { items: [{ rating: 3 }, { question: "Q2" }] },
        }],
      });

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
