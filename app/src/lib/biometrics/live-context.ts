export interface CameraObservation {
  cameraOn: boolean;
  presence: "visible" | "uncertain" | "absent" | "unknown";
  light: "dark" | "dim" | "ok" | "bright" | "unknown";
  motion: "still" | "moderate" | "active" | "unknown";
  capturedAt?: string;
}

const MAX_SNIPPET = 500;

function clip(value: string, max = MAX_SNIPPET): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function describeCameraObservations(
  observation: CameraObservation | null | undefined,
): string | null {
  if (!observation) return null;
  if (!observation.cameraOn) return "camera off";
  const parts: string[] = ["camera on"];
  if (observation.presence === "visible") parts.push("candidate visible");
  else if (observation.presence === "uncertain") parts.push("visibility uncertain");
  else if (observation.presence === "absent") parts.push("no candidate in frame");
  if (observation.light === "dark" || observation.light === "dim") {
    parts.push(`${observation.light} lighting`);
  }
  if (observation.motion === "active") parts.push("lots of movement");
  else if (observation.motion === "moderate") parts.push("some movement");
  else if (observation.motion === "still") parts.push("steady framing");
  return parts.join(", ");
}

export function buildCameraContextBlock(
  observation: CameraObservation | null | undefined,
): string | null {
  const summary = describeCameraObservations(observation);
  if (!summary) return null;
  return `Live camera: ${clip(summary)}.`;
}

export function buildPresageContextBlock(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? "").trim();
  if (!trimmed) return null;
  return `Presage SmartSpectra video biometrics so far: ${clip(trimmed)}.`;
}

export function buildLiveVisualContextBlock(input: {
  camera?: CameraObservation | null;
  presageNotes?: string | null;
}): string | null {
  const blocks = [
    buildCameraContextBlock(input.camera),
    buildPresageContextBlock(input.presageNotes),
  ].filter((block): block is string => Boolean(block));
  if (blocks.length === 0) return null;
  return (
    `${blocks.join("\n")}\n` +
    `Treat this visual context as weak practice cues only. It must never decide the next action on its own, ` +
    `never be used to score the candidate, and never be used to infer confidence, health, emotion, honesty, ` +
    `or protected traits. Do not mention vitals, heart rate, or breathing numbers to the candidate. ` +
    `When the transcript is thin, you may phrase one gentler clarifying follow-up; otherwise decide from the transcript.`
  );
}

export function buildLiveVisualPromptSection(
  cameraSummary: string | null | undefined,
  presageNotes: string | null | undefined,
): string | null {
  const summary = (cameraSummary ?? "").trim();
  const blocks = [
    summary ? `Live camera: ${clip(summary)}.` : null,
    buildPresageContextBlock(presageNotes),
  ].filter((block): block is string => Boolean(block));
  if (blocks.length === 0) return null;
  return (
    `${blocks.join("\n")}\n` +
    `Treat this visual context as weak practice cues only. It must never decide the next action on its own, ` +
    `never be used to score the candidate, and never be used to infer confidence, health, emotion, honesty, ` +
    `or protected traits. Do not mention vitals, heart rate, or breathing numbers to the candidate. ` +
    `When the transcript is thin, you may phrase one gentler clarifying follow-up; otherwise decide from the transcript.`
  );
}

export function sanitizeVisualNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return clip(trimmed);
}
