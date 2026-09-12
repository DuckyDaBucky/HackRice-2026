import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateInvitationSecret() {
  return randomBytes(32).toString("base64url");
}

export function verifySecret(secret: string, secretHash: string) {
  const computed = hashSecret(secret);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(secretHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function packCommitment(questions: unknown, resumeVersion: number, revision: number) {
  return createHash("sha256")
    .update(JSON.stringify({ questions, resumeVersion, revision }))
    .digest("hex");
}

export function opaqueCommitment(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
