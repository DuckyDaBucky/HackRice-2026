import { describe, expect, it } from "vitest";
import { parseGeneratedQuestion } from "./parse-generated-question";

describe("parseGeneratedQuestion", () => {
  it("accepts a valid JSON question", () => {
    expect(parseGeneratedQuestion('{"question":"How did you measure whether that change worked?"}')).toBe(
      "How did you measure whether that change worked?",
    );
  });

  it("rejects malformed or empty model output", () => {
    expect(parseGeneratedQuestion("not json")).toBeNull();
    expect(parseGeneratedQuestion('{"question":""}')).toBeNull();
  });
});
