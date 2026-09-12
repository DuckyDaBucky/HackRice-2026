import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { personaEnvironment } from "@/lib/hiring/config";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

function verifyPersonaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handlePersonaWebhook(rawBody: string, signature: string | null) {
  if (!verifyPersonaSignature(rawBody, signature)) {
    throw new Error("Invalid Persona webhook signature.");
  }
  const payload = JSON.parse(rawBody) as {
    data: {
      id: string;
      attributes: {
        status?: string;
        "reference-id"?: string;
        "name-first"?: string;
        "name-last"?: string;
        fields?: Record<string, unknown>;
      };
    };
  };
  const eventId = payload.data.id;
  const inquiryRef = payload.data.attributes["reference-id"] ?? eventId;

  const dedupe = await db.query(
    `INSERT INTO persona_webhook_events (event_id, inquiry_ref)
     VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [eventId, inquiryRef],
  );
  if (dedupe.rowCount === 0) return { duplicate: true };

  const attempt = await db.query(
    `SELECT v.*, c.confirmed_name, c.organization_id, c.id AS candidacy_id, i.id AS invitation_id
     FROM verification_attempts v
     JOIN candidacies c ON c.id = v.candidacy_id
     JOIN invitations i ON i.id = v.invitation_id
     WHERE v.persona_inquiry_ref = $1 AND v.environment = $2
     ORDER BY v.created_at DESC LIMIT 1`,
    [inquiryRef, personaEnvironment()],
  );
  const row = attempt.rows[0];
  if (!row) throw new Error("Verification attempt not found for inquiry.");

  const status = payload.data.attributes.status;
  let verificationStatus: "verified" | "review" | "failed" = "failed";
  let nameMatch: "match" | "mismatch" | "unknown" = "unknown";

  if (status === "approved" || status === "completed") {
    const idName = `${payload.data.attributes["name-first"] ?? ""} ${payload.data.attributes["name-last"] ?? ""}`.trim().toLowerCase();
    const expected = String(row.confirmed_name).trim().toLowerCase();
    if (idName && expected && (idName.includes(expected.split(" ")[0]!) || expected.includes(idName.split(" ")[0]!))) {
      verificationStatus = "verified";
      nameMatch = "match";
    } else if (idName) {
      verificationStatus = "review";
      nameMatch = "mismatch";
    } else {
      verificationStatus = "review";
    }
  } else if (status === "declined" || status === "failed") {
    verificationStatus = "failed";
  } else {
    return { pending: true };
  }

  await db.query(
    `UPDATE verification_attempts SET status = $2, name_match = $3, bound_at = CASE WHEN $2 = 'verified' THEN now() ELSE bound_at END, updated_at = now()
     WHERE id = $1`,
    [row.id, verificationStatus, nameMatch],
  );

  if (verificationStatus === "verified") {
    await db.query(`UPDATE candidacies SET status = 'verified', updated_at = now() WHERE id = $1`, [row.candidacy_id]);
    await enqueueSolanaAction({
      action: "attest_identity",
      organizationId: row.organization_id,
      candidacyId: row.candidacy_id,
      invitationId: row.invitation_id,
      payload: { verificationAttemptId: row.id },
    });
  } else if (verificationStatus === "review") {
    await db.query(`UPDATE candidacies SET status = 'verification_review', updated_at = now() WHERE id = $1`, [row.candidacy_id]);
  } else {
    await db.query(`UPDATE candidacies SET status = 'verification_pending', updated_at = now() WHERE id = $1`, [row.candidacy_id]);
  }

  await db.query(`UPDATE persona_webhook_events SET processed_at = now() WHERE event_id = $1`, [eventId]);
  return { verificationStatus, nameMatch };
}
