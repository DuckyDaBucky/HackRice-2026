import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { orm } from "@/lib/db";
import { solanaOutbox } from "@/lib/db/schema";
import { opaqueCommitment } from "@/lib/hiring/crypto";
import { solanaConfigured } from "./config";

export interface SolanaActionInput {
  action: string;
  idempotencyKey?: string;
  expectedRevision?: number;
  organizationId?: string;
  candidacyId?: string;
  invitationId?: string;
  payload: Record<string, unknown>;
}

export async function enqueueSolanaAction(input: SolanaActionInput) {
  const idempotencyKey = input.idempotencyKey ?? `${input.action}:${randomUUID()}`;
  const commitment = opaqueCommitment(input.payload);
  const rows = await orm
    .insert(solanaOutbox)
    .values({
      action: input.action,
      idempotencyKey,
      expectedRevision: input.expectedRevision ?? null,
      payloadCommitment: commitment,
      organizationId: input.organizationId ?? null,
      candidacyId: input.candidacyId ?? null,
      invitationId: input.invitationId ?? null,
      state: "queued",
    })
    .onConflictDoUpdate({
      target: solanaOutbox.idempotencyKey,
      set: { updatedAt: new Date() },
    })
    .returning({ id: solanaOutbox.id });
  return rows[0]?.id;
}

export async function processSolanaOutboxBatch(limit = 10) {
  if (!solanaConfigured()) {
    return { processed: 0, blocked: true, reason: "Solana not configured" };
  }
  const { submitSolanaTransaction, reconcileSolanaTransaction } = await import("./client");
  const jobs = await orm
    .select()
    .from(solanaOutbox)
    .where(inArray(solanaOutbox.state, ["queued", "reconcile_required"]))
    .orderBy(asc(solanaOutbox.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });
  let processed = 0;
  for (const job of jobs) {
    try {
      if (job.state === "reconcile_required" && job.txSignature) {
        const finalized = await reconcileSolanaTransaction(job.txSignature);
        if (finalized) {
          await orm
            .update(solanaOutbox)
            .set({ state: "finalized", finalizedAt: new Date(), updatedAt: new Date() })
            .where(eq(solanaOutbox.id, job.id));
        }
      } else {
        const sig = await submitSolanaTransaction({
          id: job.id,
          action: job.action,
          payload_commitment: job.payloadCommitment,
          expected_revision: job.expectedRevision,
        });
        await orm
          .update(solanaOutbox)
          .set({ state: "submitted", txSignature: sig, updatedAt: new Date() })
          .where(eq(solanaOutbox.id, job.id));
        const finalized = await reconcileSolanaTransaction(sig);
        if (finalized) {
          await orm
            .update(solanaOutbox)
            .set({ state: "finalized", finalizedAt: new Date(), updatedAt: new Date() })
            .where(eq(solanaOutbox.id, job.id));
        }
      }
      processed += 1;
    } catch (error) {
      await orm
        .update(solanaOutbox)
        .set({
          state: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(solanaOutbox.id, job.id));
    }
  }
  return { processed, blocked: false };
}

export async function requireFinalizedSolanaAction(idempotencyKey: string) {
  const rows = await orm
    .select({ state: solanaOutbox.state })
    .from(solanaOutbox)
    .where(eq(solanaOutbox.idempotencyKey, idempotencyKey))
    .limit(1);
  const row = rows[0];
  if (!row || row.state !== "finalized") {
    throw new Error("On-chain confirmation is required before granting this access.");
  }
}
