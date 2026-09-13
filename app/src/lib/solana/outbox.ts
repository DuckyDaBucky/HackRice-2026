import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
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
  const result = await db.query<{ id: string }>(
    `INSERT INTO solana_outbox
       (action, idempotency_key, expected_revision, payload_commitment, organization_id, candidacy_id, invitation_id, state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
     ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [
      input.action,
      idempotencyKey,
      input.expectedRevision ?? null,
      commitment,
      input.organizationId ?? null,
      input.candidacyId ?? null,
      input.invitationId ?? null,
    ],
  );
  return result.rows[0]?.id;
}

export async function processSolanaOutboxBatch(limit = 10) {
  if (!solanaConfigured()) {
    return { processed: 0, blocked: true, reason: "Solana not configured" };
  }
  const { submitSolanaTransaction, reconcileSolanaTransaction } = await import("./client");
  const jobs = await db.query(
    `SELECT * FROM solana_outbox
     WHERE state IN ('queued', 'reconcile_required')
     ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`,
    [limit],
  );
  let processed = 0;
  for (const job of jobs.rows) {
    try {
      if (job.state === "reconcile_required" && job.tx_signature) {
        const finalized = await reconcileSolanaTransaction(job.tx_signature);
        if (finalized) {
          await db.query(
            `UPDATE solana_outbox SET state = 'finalized', finalized_at = now(), updated_at = now() WHERE id = $1`,
            [job.id],
          );
        }
      } else {
        const sig = await submitSolanaTransaction(job);
        await db.query(
          `UPDATE solana_outbox SET state = 'submitted', tx_signature = $2, updated_at = now() WHERE id = $1`,
          [job.id, sig],
        );
        const finalized = await reconcileSolanaTransaction(sig);
        if (finalized) {
          await db.query(
            `UPDATE solana_outbox SET state = 'finalized', finalized_at = now(), updated_at = now() WHERE id = $1`,
            [job.id],
          );
        }
      }
      processed += 1;
    } catch (error) {
      await db.query(
        `UPDATE solana_outbox SET state = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
        [job.id, error instanceof Error ? error.message : "Unknown error"],
      );
    }
  }
  return { processed, blocked: false };
}

export async function requireFinalizedSolanaAction(idempotencyKey: string) {
  const result = await db.query(
    `SELECT state FROM solana_outbox WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  const row = result.rows[0];
  if (!row || row.state !== "finalized") {
    throw new Error("On-chain confirmation is required before granting this access.");
  }
}
