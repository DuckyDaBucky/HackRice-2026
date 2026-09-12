const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export function pickRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
): string | undefined {
  return PREFERRED_MIME_TYPES.find(isTypeSupported);
}
