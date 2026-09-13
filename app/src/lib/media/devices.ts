/** Shared device-preference storage keys and label helpers for lobby + settings. */

export const VIDEO_DEVICE_KEY = "gmh-video-device";
export const AUDIO_DEVICE_KEY = "gmh-audio-device";
export const OUTPUT_DEVICE_KEY = "gmh-output-device";

export function readDeviceId(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeDeviceId(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Non-fatal; the choice still applies to this visit.
  }
}

/** Labels are empty until camera/mic permission is granted — fall back to numbered names. */
export function friendlyDeviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label) return device.label;
  if (device.kind === "videoinput") return `Camera ${index + 1}`;
  if (device.kind === "audiooutput") return `Speaker ${index + 1}`;
  return `Microphone ${index + 1}`;
}
