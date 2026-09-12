import { describe, expect, it } from "vitest";
import { pickRecordingMimeType } from "./mime-type";

describe("pickRecordingMimeType", () => {
  it("prefers vp9 webm when everything is supported", () => {
    expect(pickRecordingMimeType(() => true)).toBe("video/webm;codecs=vp9,opus");
  });

  it("returns the first preferred type the browser supports", () => {
    const supported = new Set(["video/webm;codecs=vp8,opus", "video/mp4"]);
    expect(pickRecordingMimeType((type) => supported.has(type))).toBe(
      "video/webm;codecs=vp8,opus",
    );
  });

  it("falls back to mp4 when webm is unsupported", () => {
    expect(pickRecordingMimeType((type) => type === "video/mp4")).toBe("video/mp4");
  });

  it("returns undefined so the browser uses its default when nothing matches", () => {
    expect(pickRecordingMimeType(() => false)).toBeUndefined();
  });
});
