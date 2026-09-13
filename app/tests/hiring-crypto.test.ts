import { describe, expect, it } from "vitest";
import { generateInvitationSecret, hashSecret, packCommitment, verifySecret } from "@/lib/hiring/crypto";

describe("hiring crypto", () => {
  it("hashes and verifies invitation secrets", () => {
    const secret = generateInvitationSecret();
    const hash = hashSecret(secret);
    expect(verifySecret(secret, hash)).toBe(true);
    expect(verifySecret("wrong", hash)).toBe(false);
  });

  it("creates stable pack commitments", () => {
    const questions = [{ id: "1", prompt: "Tell me about a project." }];
    expect(packCommitment(questions, 1, 1)).toHaveLength(64);
    expect(packCommitment(questions, 1, 1)).toBe(packCommitment(questions, 1, 1));
  });
});
