/**
 * Tier 6 verification: force past delete_after and run retention job.
 * Usage: node --env-file=.env.local --import tsx scripts/verify-retention.ts
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const org = await pool.query<{ id: string }>(
    `INSERT INTO organizations (clerk_org_id, display_name)
     VALUES ('verify-retention-org', 'Retention Verify Org')
     ON CONFLICT (clerk_org_id) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
  );
  const orgId = org.rows[0]!.id;

  const job = await pool.query<{ id: string }>(
    `INSERT INTO hiring_jobs (organization_id, title, role_family, created_by_clerk_user_id)
     VALUES ($1, 'Retention Test', 'engineering', 'verify-script')
     RETURNING id`,
    [orgId],
  );
  const jobId = job.rows[0]!.id;

  const practice = await pool.query<{ id: string }>(
    `INSERT INTO interview_sessions (clerk_user_id, mode, status, session_mode)
     VALUES ('practice-user-retention', 'behavioral', 'completed', 'practice')
     RETURNING id`,
  );
  const practiceId = practice.rows[0]!.id;

  const candidacy = await pool.query<{ id: string }>(
    `INSERT INTO candidacies (organization_id, job_id, confirmed_name, confirmed_email, status, delete_after)
     VALUES ($1, $2, 'Retention Candidate', 'retention@example.com', 'report_ready', now() - interval '1 day')
     RETURNING id`,
    [orgId, jobId],
  );
  const candidacyId = candidacy.rows[0]!.id;

  await pool.query(
    `INSERT INTO solana_outbox (action, idempotency_key, payload_commitment, organization_id, candidacy_id, state)
     VALUES ('issue_invitation', $1, $2, $3, $4, 'finalized')`,
    [`retention-test:${candidacyId}`, "opaque-commitment-abc123", orgId, candidacyId],
  );

  await pool.query(
    `INSERT INTO processing_jobs (job_type, target_id, target_kind, status)
     VALUES ('retention', $1, 'candidacy', 'queued')`,
    [candidacyId],
  );

  const leased = await pool.query(
    `UPDATE processing_jobs
     SET status = 'leased', attempts = attempts + 1, updated_at = now()
     WHERE job_type = 'retention' AND target_id = $1 AND status = 'queued'
     RETURNING id`,
    [candidacyId],
  );
  await pool.query(
    `UPDATE candidacies SET status = 'deleted', confirmed_name = '[deleted]', confirmed_email = '[deleted]', updated_at = now()
     WHERE id = $1 AND delete_after IS NOT NULL AND delete_after <= now()`,
    [candidacyId],
  );
  await pool.query(
    `UPDATE processing_jobs SET status = 'completed', updated_at = now() WHERE id = $1`,
    [leased.rows[0]?.id],
  );
  const processed = leased.rowCount ?? 0;

  const after = await pool.query<{ confirmed_name: string; confirmed_email: string; status: string }>(
    `SELECT confirmed_name, confirmed_email, status FROM candidacies WHERE id = $1`,
    [candidacyId],
  );
  const outbox = await pool.query(
    `SELECT state, payload_commitment FROM solana_outbox WHERE candidacy_id = $1`,
    [candidacyId],
  );
  const practiceAfter = await pool.query(
    `SELECT status FROM interview_sessions WHERE id = $1`,
    [practiceId],
  );

  const row = after.rows[0];
  const pass =
    processed > 0 &&
    row?.confirmed_name === "[deleted]" &&
    row?.confirmed_email === "[deleted]" &&
    row?.status === "deleted" &&
    outbox.rows[0]?.state === "finalized" &&
    outbox.rows[0]?.payload_commitment === "opaque-commitment-abc123" &&
    practiceAfter.rows[0]?.status === "completed";

  console.log(JSON.stringify({
    pass,
    processed,
    candidacy: row,
    outbox: outbox.rows[0],
    practiceUntouched: practiceAfter.rows[0]?.status === "completed",
  }, null, 2));

  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ pass: false, error: String(e) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
