import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { orm } from "@/lib/db";
import { candidacies, invitations, personaWebhookEvents, verificationAttempts } from "@/lib/db/schema";
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

  const rows = await orm
    .select({
      id: verificationAttempts.id,
      confirmedName: candidacies.confirmedName,
      organizationId: candidacies.organizationId,
      candidacyId: candidacies.id,
      invitationId: invitations.id,
    })
    .from(verificationAttempts)
    .innerJoin(candidacies, eq(candidacies.id, verificationAttempts.candidacyId))
    .innerJoin(invitations, eq(invitations.id, verificationAttempts.invitationId))
    .where(
      and(
        eq(verificationAttempts.environment, personaEnvironment()),
        inArray(verificationAttempts.personaInquiryRef, [inquiryId, referenceId ?? inquiryId, referenceId ?? ""]),
      ),
    )
    .orderBy(desc(verificationAttempts.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Verification attempt not found for inquiry.");

  const status = attrs.status;
  let verificationStatus: "verified" | "review" | "failed" = "failed";
  let nameMatch: "match" | "mismatch" | "unknown" = "unknown";

  if (status === "approved" || status === "completed") {
    const idName = `${attrs["name-first"] ?? ""} ${attrs["name-last"] ?? ""}`.trim().toLowerCase();
    const expected = String(row.confirmedName).trim().toLowerCase();
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

  await orm
    .update(verificationAttempts)
    .set({
      status: verificationStatus,
      nameMatch,
      updatedAt: new Date(),
      ...(verificationStatus === "verified" ? { boundAt: new Date() } : {}),
    })
    .where(eq(verificationAttempts.id, row.id));

  if (verificationStatus === "verified") {
    await orm
      .update(candidacies)
      .set({ status: "verified", updatedAt: new Date() })
      .where(eq(candidacies.id, row.candidacyId));
    await enqueueSolanaAction({
      action: "attest_identity",
      organizationId: row.organizationId,
      candidacyId: row.candidacyId,
      invitationId: row.invitationId,
      payload: { verificationAttemptId: row.id },
    });
  } else if (verificationStatus === "review") {
    await orm
      .update(candidacies)
      .set({ status: "verification_review", updatedAt: new Date() })
      .where(eq(candidacies.id, row.candidacyId));
  } else {
    await orm
      .update(candidacies)
      .set({ status: "verification_pending", updatedAt: new Date() })
      .where(eq(candidacies.id, row.candidacyId));
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

  const dedupe = await orm
    .insert(personaWebhookEvents)
    .values({ eventId, inquiryRef })
    .onConflictDoNothing({ target: personaWebhookEvents.eventId })
    .returning({ id: personaWebhookEvents.id });
  if (dedupe.length === 0) return { duplicate: true, eventName: extracted.eventName };

  const result = await applyPersonaInquiryDecision(extracted.inquiry);
  await orm
    .update(personaWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(personaWebhookEvents.eventId, eventId));
  return { ...result, eventName: extracted.eventName };
}
