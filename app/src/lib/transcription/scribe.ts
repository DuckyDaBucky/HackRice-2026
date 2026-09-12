import "server-only";
import type { TranscriptSegment } from "@/lib/interviews/contracts";

/** Recycles the ElevenLabs xi-api-key fetch pattern from /api/interview/speak. */
export async function transcribeWithScribe(params: {
  audioBuffer: Buffer;
  mimeType: string;
}): Promise<{ fullText: string; segments: TranscriptSegment[] }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const form = new FormData();
  const blob = new Blob([Uint8Array.from(params.audioBuffer)], { type: params.mimeType });
  form.append("file", blob, "recording.webm");
  form.append("model_id", "scribe_v1");
  form.append("timestamps_granularity", "word");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs Scribe failed: ${response.status} ${text}`);
  }

  const json = await response.json() as {
    text?: string;
    words?: Array<{ text: string; start: number; end: number }>;
  };

  const fullText = json.text?.trim() ?? "";
  const segments: TranscriptSegment[] = (json.words ?? []).reduce<TranscriptSegment[]>((acc, word, index, arr) => {
    if (index === 0 || index % 8 === 0) {
      const chunk = arr.slice(index, index + 8);
      const startMs = Math.round((chunk[0]?.start ?? 0) * 1000);
      const endMs = Math.round((chunk[chunk.length - 1]?.end ?? 0) * 1000);
      acc.push({
        startMs,
        endMs,
        text: chunk.map((w) => w.text).join(" "),
      });
    }
    return acc;
  }, []);

  return { fullText, segments };
}
