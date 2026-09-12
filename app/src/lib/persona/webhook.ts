import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { personaEnvironment } from "@/lib/hiring/config";
import { enqueueSolanaAction } from "@/lib/solana/outbox";

type InquiryAttributes = {
  status?: string;
  "reference-id"?: string;
  "name-first"?: string;
  "name-last"?: string;
};

type InquiryRecord = {
  id: string;
  attributes?: InquiryAttributes;
};

export function verifyPersonaSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const pairs = signatureHeader.trim().split(/\s+/);
  return pairs.some((pair) => {
    const parts = pair.split(",");
    const t = parts.find((p) => p.startsWith("t="))?.slice(2);
    const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
    if (!t || !v1) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function extractInquiryFromWebhookPayload(payload: {
  data?: {
    id?: string;
    type?: string;
    attributes?: InquiryAttributes & {
      name?: string;
      payload?: { data?: InquiryRecord };
    };
  };
}): { eventId: string; eventName: string; inquiry: InquiryRecord } | null {
  const root = payload.data;
  if (!root?.id) return null;
  const eventName = root.attributes?.name ?? "";
  const nested = root.attributes?.payload?.data;
  if (nested?.id) {
    return { eventId: root.id, eventName, inquiry: nested };
  }
  if (root.type === "inquiry" || root.id.startsWith("inq_")) {
    return { eventId: root.id, eventName, inquiry: root as InquiryRecord };
  }
  if (root.attributes?.status) {
    return {
      eventId: root.id,
      eventName,
      inquiry: { id: root.attributes["reference-id"] ?? root.id, attributes: root.attributes },
    };
  }
  return null;
}

export async function applyPersonaInquiryDecision(inquiry: InquiryRecord) {
  const attrs = inquiry.attributes ?? {};
  const inquiryId = inquiry.id;
  const referenceId = attrs["reference-id"];

  const attempt = await db.query(
    `SELECT v.*, c.confirmed_name, c.organization_id, c.id AS candidacy_id, i.id AS invitation_id
     FROM verification_attempts v
     JOIN candidacies c ON c.id = v.candidacy_id
     JOIN invitations i ON i.id = v.invitation_id
     WHERE v.environment = $3
       AND (v.persona_inquiry_ref = $1 OR v.persona_inquiry_ref = $2 OR v.persona_inquiry_ref = $4)
     ORDER BY v.created_at DESC LIMIT 1`,
    [inquiryId, referenceId ?? inquiryId, personaEnvironment(), referenceId ?? ""],
  );
  const row = attempt.rows[0];
  if (!row) throw new Error("Verification attempt not found for inquiry.");

  const status = attrs.status;
  let verificationStatus: "verified" | "review" | "failed" = "failed";
  let nameMatch: "match" | "mismatch" | "unknown" = "unknown";

  if (status === "approved" || status === "completed") {
    const idName = `${attrs["name-first"] ?? ""} ${attrs["name-last"] ?? ""}`.trim().toLowerCase();
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
  } else if (status === "needs review" || status === "marked-for-review") {
    verificationStatus = "review";
  } else {
    return { pending: true as const, verificationStatus: status ?? "pending" };
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

  return { verificationStatus, nameMatch };
}

export async function handlePersonaWebhook(rawBody: string, signature: string | null) {
  if (!process.env.PERSONA_WEBHOOK_SECRET) {
    throw new Error("Persona webhook secret is not configured.");
  }
  if (!verifyPersonaSignature(rawBody, signature)) {
    throw new Error("Invalid Persona webhook signature.");
  }
  const payload = JSON.parse(rawBody) as Parameters<typeof extractInquiryFromWebhookPayload>[0];
  const extracted = extractInquiryFromWebhookPayload(payload);
  if (!extracted) throw new Error("Persona webhook payload missing inquiry.");

  const eventId = extracted.eventId;
  const inquiryRef = extracted.inquiry.attributes?.["reference-id"] ?? extracted.inquiry.id;

  const dedupe = await db.query(
    `INSERT INTO persona_webhook_events (event_id, inquiry_ref)
     VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [eventId, inquiryRef],
  );
  if (dedupe.rowCount === 0) return { duplicate: true, eventName: extracted.eventName };

  const result = await applyPersonaInquiryDecision(extracted.inquiry);
  await db.query(`UPDATE persona_webhook_events SET processed_at = now() WHERE event_id = $1`, [eventId]);
  return { ...result, eventName: extracted.eventName };
}
