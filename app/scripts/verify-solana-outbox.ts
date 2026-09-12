/**
 * Tier 4 verification: enqueue issue_invitation and process via worker API.
 * Usage: node --env-file=.env.local --import tsx scripts/verify-solana-outbox.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const WORKER_SECRET = process.env.HIRING_WORKER_SECRET ?? "";

function opaqueCommitment(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function main() {
  const programId = process.env.SOLANA_PROGRAM_ID;
  const keypair = process.env.SOLANA_SERVICE_KEYPAIR;
  const dryRun = process.env.SOLANA_DRY_RUN === "true";

  if (!programId || !keypair) {
    console.log(JSON.stringify({
      pass: false,
      blocker: "Set SOLANA_PROGRAM_ID and SOLANA_SERVICE_KEYPAIR in .env.local (SOLANA_DRY_RUN=false for real finalization)",
      dryRun,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const org = await pool.query<{ id: string }>(
    `INSERT INTO organizations (clerk_org_id, display_name)
     VALUES ('verify-solana-org', 'Solana Verify Org')
     ON CONFLICT (clerk_org_id) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
  );
  const orgId = org.rows[0]!.id;

  const job = await pool.query<{ id: string }>(
    `INSERT INTO hiring_jobs (organization_id, title, role_family, created_by_clerk_user_id)
     VALUES ($1, 'Solana Test', 'engineering', 'verify-script')
     RETURNING id`,
    [orgId],
  );
  const jobId = job.rows[0]!.id;

  const candidacy = await pool.query<{ id: string }>(
    `INSERT INTO candidacies (organization_id, job_id, confirmed_name, confirmed_email, status)
     VALUES ($1, $2, 'Sol Candidate', 'sol@example.com', 'invited')
     RETURNING id`,
    [orgId, jobId],
  );
  const candidacyId = candidacy.rows[0]!.id;

  const secretHash = createHash("sha256").update(randomUUID()).digest("hex");
  const invitation = await pool.query<{ id: string }>(
    `INSERT INTO invitations (candidacy_id, pack_revision, secret_hash, deadline_at, status)
     VALUES ($1, 1, $2, now() + interval '7 days', 'active')
     RETURNING id`,
    [candidacyId, secretHash],
  );
  const invitationId = invitation.rows[0]!.id;

  const payload = { packRevision: 1, deadlineAt: new Date().toISOString() };
  const outbox = await pool.query<{ id: string }>(
    `INSERT INTO solana_outbox
       (action, idempotency_key, expected_revision, payload_commitment, organization_id, candidacy_id, invitation_id, state)
     VALUES ('issue_invitation', $1, 1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [`issue_invitation:${randomUUID()}`, opaqueCommitment(payload), orgId, candidacyId, invitationId],
  );
  const outboxId = outbox.rows[0]!.id;

  const workerRes = await fetch(`${BASE}/api/hiring/worker`, {
    method: "POST",
    headers: { "x-worker-secret": WORKER_SECRET },
  });
  const workerJson = await workerRes.json() as { solana?: { processed?: number; blocked?: boolean } };

  const row = await pool.query(
    `SELECT state, tx_signature, finalized_at, error_message FROM solana_outbox WHERE id = $1`,
    [outboxId],
  );

  const state = row.rows[0]?.state;
  const txSignature = row.rows[0]?.tx_signature as string | null;
  const realSignature = Boolean(
    txSignature &&
    !txSignature.startsWith("sim-") &&
    !txSignature.startsWith("dryrun-"),
  );
  const pass = state === "finalized" && !dryRun && realSignature;

  console.log(JSON.stringify({
    pass,
    dryRun,
    note: dryRun
      ? "SOLANA_DRY_RUN=true — outbox uses sim/dryrun signatures; set SOLANA_DRY_RUN=false for devnet proof"
      : pass
        ? "issue_invitation outbox finalized"
        : `Outbox state=${state}; error=${row.rows[0]?.error_message ?? "none"}`,
    outboxId,
    state,
    txSignature,
    realSignature,
    finalizedAt: row.rows[0]?.finalized_at,
    worker: workerJson,
  }, null, 2));

  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ pass: false, error: String(e) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
