import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  enqueueSolanaAction: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({ orm: { select: mocks.select, insert: mocks.insert, update: mocks.update } }));
vi.mock("../src/lib/solana/outbox", () => ({ enqueueSolanaAction: mocks.enqueueSolanaAction }));

import { stubQuery } from "./helpers/drizzle-stub";
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
    expect(mocks.insert).not.toHaveBeenCalled();
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
    mocks.insert.mockReturnValueOnce(stubQuery([]));

    const result = await handlePersonaWebhook(body, signature);
    expect(result).toMatchObject({ duplicate: true });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
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

    mocks.insert.mockReturnValueOnce(stubQuery([{ id: "wh-1" }]));
    mocks.select.mockReturnValueOnce(stubQuery([{
      id: "attempt-1",
      confirmedName: "Alex Candidate",
      organizationId: "org-1",
      candidacyId: "cand-1",
      invitationId: "inv-1",
    }]));
    mocks.update.mockReturnValue(stubQuery([]));

    const result = await handlePersonaWebhook(body, signature);
    expect(result).toMatchObject({ verificationStatus: "verified", nameMatch: "match", eventName: "inquiry.approved" });
    expect(mocks.update).toHaveBeenCalledTimes(3);
    expect(mocks.enqueueSolanaAction).toHaveBeenCalledWith(expect.objectContaining({ action: "attest_identity" }));
  });
});
