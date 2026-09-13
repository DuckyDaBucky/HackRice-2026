import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUBTITLE_PREFS,
  SUBTITLE_SIZE_CLASS,
  parseSubtitlePrefs,
  subtitlesEnabled,
} from "@/hooks/useSubtitleSize";
import { friendlyDeviceLabel } from "@/lib/media/devices";

function device(kind: MediaDeviceKind, label: string): MediaDeviceInfo {
  return { deviceId: "id", groupId: "g", kind, label } as MediaDeviceInfo;
}

describe("lobby helpers", () => {
  it("maps all three subtitle sizes to classes", () => {
    expect(Object.keys(SUBTITLE_SIZE_CLASS).sort()).toEqual(["large", "medium", "small"]);
    expect(new Set(Object.values(SUBTITLE_SIZE_CLASS)).size).toBe(3);
  });

  it("defaults both caption sources on with medium size", () => {
    expect(DEFAULT_SUBTITLE_PREFS).toEqual({
      intervieweeCaptions: true,
      interviewerCaptions: true,
      size: "medium",
    });
    expect(subtitlesEnabled(DEFAULT_SUBTITLE_PREFS)).toBe(true);
  });

  it("treats neither caption source as the no-subtitles state", () => {
    const none = parseSubtitlePrefs(
      JSON.stringify({ intervieweeCaptions: false, interviewerCaptions: false, size: "large" }),
    );
    expect(none.intervieweeCaptions).toBe(false);
    expect(none.interviewerCaptions).toBe(false);
    expect(none.size).toBe("large");
    expect(subtitlesEnabled(none)).toBe(false);
  });

  it("allows independent caption source toggles", () => {
    const intervieweeOnly = parseSubtitlePrefs(
      JSON.stringify({ intervieweeCaptions: true, interviewerCaptions: false }),
    );
    expect(subtitlesEnabled(intervieweeOnly)).toBe(true);

    const interviewerOnly = parseSubtitlePrefs(
      JSON.stringify({ intervieweeCaptions: false, interviewerCaptions: true }),
    );
    expect(subtitlesEnabled(interviewerOnly)).toBe(true);
  });

  it("migrates legacy subtitle size storage", () => {
    expect(parseSubtitlePrefs(null, "large")).toEqual({
      intervieweeCaptions: true,
      interviewerCaptions: true,
      size: "large",
    });
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
