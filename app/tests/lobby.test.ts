import { describe, expect, it } from "vitest";
import { SUBTITLE_SIZE_CLASS } from "@/hooks/useSubtitleSize";
import { friendlyDeviceLabel } from "@/lib/media/devices";

function device(kind: MediaDeviceKind, label: string): MediaDeviceInfo {
  return { deviceId: "id", groupId: "g", kind, label } as MediaDeviceInfo;
}

describe("lobby helpers", () => {
  it("maps all three subtitle sizes to classes", () => {
    expect(Object.keys(SUBTITLE_SIZE_CLASS).sort()).toEqual(["large", "medium", "small"]);
    expect(new Set(Object.values(SUBTITLE_SIZE_CLASS)).size).toBe(3);
  });

  it("prefers real device labels", () => {
    expect(friendlyDeviceLabel(device("videoinput", "FaceTime HD Camera"), 0)).toBe("FaceTime HD Camera");
  });

  it("falls back to numbered names before permission", () => {
    expect(friendlyDeviceLabel(device("videoinput", ""), 0)).toBe("Camera 1");
    expect(friendlyDeviceLabel(device("audioinput", ""), 1)).toBe("Microphone 2");
    expect(friendlyDeviceLabel(device("audiooutput", ""), 0)).toBe("Speaker 1");
  });
});
