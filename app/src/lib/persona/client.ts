import "server-only";
import { personaConfigured, personaEnvironment } from "@/lib/hiring/config";

export interface PersonaInquiryResult {
  inquiryId: string;
  inquiryRef: string;
  sessionToken?: string;
}

export async function createPersonaInquiry(params: {
  candidacyId: string;
  invitationId: string;
  referenceId: string;
}): Promise<PersonaInquiryResult> {
  if (!personaConfigured()) {
    throw new Error("Persona is not configured. Set PERSONA_API_KEY, PERSONA_TEMPLATE_ID, and PERSONA_WEBHOOK_SECRET.");
  }
  const apiKey = process.env.PERSONA_API_KEY!;
  const templateId = process.env.PERSONA_TEMPLATE_ID!;
  const response = await fetch("https://withpersona.com/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Persona-Version": "2023-01-05",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          "inquiry-template-id": templateId,
          "reference-id": params.referenceId,
          "note": `candidacy:${params.candidacyId}:invitation:${params.invitationId}`,
        },
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Persona inquiry creation failed: ${response.status} ${text}`);
  }
  const json = await response.json() as {
    data: { id: string; attributes?: { "reference-id"?: string } };
  };
  return {
    inquiryId: json.data.id,
    inquiryRef: json.data.attributes?.["reference-id"] ?? params.referenceId,
  };
}

export function personaSandboxLabel() {
  return personaEnvironment() === "sandbox" ? " (Persona sandbox — not real identity verification)" : "";
}

export async function requestPersonaInquiryDeletion(inquiryRef: string) {
  if (!personaConfigured()) return { ok: false, error: "Persona not configured" };
  // Persona deletion API varies by plan; track attempt without fabricating success.
  return { ok: false, error: "Persona inquiry deletion must be completed through the Persona dashboard or supported API workflow." };
}
