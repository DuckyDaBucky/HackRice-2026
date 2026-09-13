import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  enqueueSolanaAction: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ db: { query: mocks.query } }));
vi.mock("../src/lib/solana/outbox", () => ({ enqueueSolanaAction: mocks.enqueueSolanaAction }));

import { handlePersonaWebhook } from "../src/lib/persona/webhook";

function signBody(body: string, secret: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("Persona webhook security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PERSONA_WEBHOOK_SECRET", "test-webhook-secret");
    vi.stubEnv("PERSONA_ENV", "sandbox");
    mocks.enqueueSolanaAction.mockResolvedValue(undefined);
  });

  it("rejects invalid signatures", async () => {
    const body = JSON.stringify({ data: { id: "evt-1", attributes: { status: "approved" } } });
    await expect(handlePersonaWebhook(body, "deadbeef")).rejects.toThrow("Invalid Persona webhook signature.");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("dedupes duplicate event_id deliveries", async () => {
    const body = JSON.stringify({
      data: {
        id: "evt-dup",
        type: "event",
        attributes: {
          name: "inquiry.approved",
          payload: {
            data: {
              id: "inq-1",
              type: "inquiry",
              attributes: { status: "approved", "reference-id": "inq-1", "name-first": "Alex", "name-last": "Candidate" },
            },
          },
        },
      },
    });
    const signature = signBody(body, "test-webhook-secret");
    mocks.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await handlePersonaWebhook(body, signature);
    expect(result).toMatchObject({ duplicate: true });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("marks verification verified only through webhook path", async () => {
    const body = JSON.stringify({
      data: {
        id: "evt-ok",
        type: "event",
        attributes: {
          name: "inquiry.approved",
          payload: {
            data: {
              id: "inq-1",
              type: "inquiry",
              attributes: {
                status: "approved",
                "reference-id": "inq-1",
                "name-first": "Alex",
                "name-last": "Candidate",
              },
            },
          },
        },
      },
    });
    const signature = signBody(body, "test-webhook-secret");

    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "wh-1" }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "attempt-1",
          candidacy_id: "cand-1",
          invitation_id: "inv-1",
          organization_id: "org-1",
          confirmed_name: "Alex Candidate",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await handlePersonaWebhook(body, signature);
    expect(result).toMatchObject({ verificationStatus: "verified", nameMatch: "match", eventName: "inquiry.approved" });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE verification_attempts"))).toBe(true);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE candidacies SET status = 'verified'"))).toBe(true);
  });
});
