import { describe, expect, it } from "vitest";
import { parseFollowUpResponse } from "./parse-response";

describe("parseFollowUpResponse", () => {
  it("extracts a follow-up string from clean JSON", () => {
    expect(parseFollowUpResponse('{"followUp": "What made that approach risky?"}')).toBe(
      "What made that approach risky?",
    );
  });

  it("returns null when followUp is explicitly null", () => {
    expect(parseFollowUpResponse('{"followUp": null}')).toBeNull();
  });

  it("strips markdown code fences before parsing", () => {
    const raw = '```json\n{"followUp": "Can you say more about that?"}\n```';
    expect(parseFollowUpResponse(raw)).toBe("Can you say more about that?");
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(parseFollowUpResponse("not json at all")).toBeNull();
  });

  it("returns null when followUp is missing", () => {
    expect(parseFollowUpResponse("{}")).toBeNull();
  });

  it("returns null when followUp is not a string", () => {
    expect(parseFollowUpResponse('{"followUp": 42}')).toBeNull();
  });

  it("returns null for a blank follow-up string", () => {
    expect(parseFollowUpResponse('{"followUp": "   "}')).toBeNull();
  });
});
