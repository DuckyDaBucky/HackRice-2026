/**
 * End-to-end Persona webhook: creates DB rows, signs payload, posts to local webhook.
 */
import { createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const secret = process.env.PERSONA_WEBHOOK_SECRET;

function sign(body: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret!).update(`${t}.${body}`).digest("hex");
  return { t, header: `t=${t},v1=${v1}` };
}

async function main() {
  if (!secret) throw new Error("PERSONA_WEBHOOK_SECRET missing");

  const org = await pool.query<{ id: string }>(
    `INSERT INTO organizations (clerk_org_id, display_name)
     VALUES ($1, 'Persona E2E Org') ON CONFLICT (clerk_org_id) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`,
    ["persona-e2e-org"],
  );
  const orgId = org.rows[0]!.id;
  const job = await pool.query<{ id: string }>(
    `INSERT INTO hiring_jobs (organization_id, title, role_family, created_by_clerk_user_id)
     VALUES ($1, 'Persona E2E', 'engineering', 'verify-script') RETURNING id`,
    [orgId],
  );
  const jobId = job.rows[0]!.id;
  const candidacy = await pool.query<{ id: string }>(
    `INSERT INTO candidacies (organization_id, job_id, confirmed_name, confirmed_email, status)
     VALUES ($1, $2, 'Alex Candidate', 'alex@example.com', 'verification_pending') RETURNING id`,
    [orgId, jobId],
  );
  const candidacyId = candidacy.rows[0]!.id;
  const invitation = await pool.query<{ id: string }>(
    `INSERT INTO invitations (candidacy_id, pack_revision, secret_hash, deadline_at, status)
     VALUES ($1, 1, $2, now() + interval '7 days', 'active') RETURNING id`,
    [candidacyId, createHmac("sha256", randomUUID()).digest("hex")],
  );
  const invitationId = invitation.rows[0]!.id;
  const inquiryId = `inq_e2e_${randomUUID().slice(0, 8)}`;

  await pool.query(
    `INSERT INTO verification_attempts (candidacy_id, invitation_id, persona_inquiry_ref, environment, status)
     VALUES ($1, $2, $3, 'sandbox', 'pending')`,
    [candidacyId, invitationId, inquiryId],
  );

  const body = JSON.stringify({
    data: {
      id: `evt_e2e_${randomUUID()}`,
      type: "event",
      attributes: {
        name: "inquiry.approved",
        payload: {
          data: {
            id: inquiryId,
            type: "inquiry",
            attributes: {
              status: "approved",
              "reference-id": inquiryId,
              "name-first": "Alex",
              "name-last": "Candidate",
            },
          },
        },
      },
    },
  });
  const { header } = sign(body);
  const res = await fetch(`${BASE}/api/persona/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "Persona-Signature": header },
    body,
  });
  const json = await res.json();

  const attempt = await pool.query(`SELECT status FROM verification_attempts WHERE candidacy_id = $1`, [candidacyId]);
  const candidacyRow = await pool.query(`SELECT status FROM candidacies WHERE id = $1`, [candidacyId]);

  const pass = res.status === 200 && attempt.rows[0]?.status === "verified" && candidacyRow.rows[0]?.status === "verified";
  console.log(JSON.stringify({
    pass,
    httpStatus: res.status,
    response: json,
    verificationStatus: attempt.rows[0]?.status,
    candidacyStatus: candidacyRow.rows[0]?.status,
  }, null, 2));
  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ pass: false, error: String(e) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
