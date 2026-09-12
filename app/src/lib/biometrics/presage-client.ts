import "server-only";
import { getObjectBuffer } from "@/lib/storage/r2";
import { PresageBusyError, videoAnalysisSchema, type VideoAnalysis } from "./contracts";

function presageApiUrl() {
  return process.env.PRESAGE_API_URL || "http://presage-api:8080";
}

/**
 * Relays an already-uploaded recorded clip to presage-api's whole-video analysis endpoint.
 * Runs server-to-server only (docker-compose internal network) — the vendor SDK has no browser
 * build, so this must never be called from client code.
 */
export async function analyzeArtifactClip(r2Key: string): Promise<VideoAnalysis> {
  const { buffer, contentType } = await getObjectBuffer(r2Key);
  const form = new FormData();
  form.append("video", new Blob([new Uint8Array(buffer)], { type: contentType ?? "video/webm" }), "clip");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${presageApiUrl()}/v1/videos/analyze?includeRawProtobuf=false`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (response.status === 409) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "5");
      throw new PresageBusyError(Number.isFinite(retryAfter) ? retryAfter : 5);
    }
    if (!response.ok) {
      throw new Error(`presage-api analysis failed with status ${response.status}.`);
    }
    return videoAnalysisSchema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
