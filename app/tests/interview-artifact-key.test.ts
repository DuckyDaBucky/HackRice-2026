import { describe, expect, it } from "vitest";
import { artifactClipKey } from "../src/lib/storage/r2";

describe("v2 recording object keys", () => {
  it("keeps retries stable while isolating separate answer attempts", () => {
    const firstTry = artifactClipKey("session-1", "artifact-a", "video/webm");
    const retry = artifactClipKey("session-1", "artifact-a", "video/webm");
    const revisit = artifactClipKey("session-1", "artifact-b", "video/webm");

    expect(firstTry).toBe("interviews/session-1/artifacts/artifact-a.webm");
    expect(retry).toBe(firstTry);
    expect(revisit).not.toBe(firstTry);
  });
});
