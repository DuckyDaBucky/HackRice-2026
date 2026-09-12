import type { ReconciledTranscript } from "./types";

/**
 * Picks the durable transcript after an answer is recorded.
 *
 * The browser's Web Speech live captions are provisional — they drop words
 * on pauses, mis-hear domain terms, and revise interim segments. The batch
 * transcript (Deepgram / Gemini over the recorded blob) hears the full clip
 * with punctuation and smart-formatting, so it wins whenever it is
 * non-empty. Live text is kept as the fallback when batch fails or is empty.
 *
 * Word-count guard: a batch result that is dramatically shorter than live
 * (e.g. clipped upload) is treated as a failed transcription rather than a
 * "concise" answer, so we don't silently discard most of what was said.
 */
export function reconcileTranscripts(input: {
  liveText: string;
  liveConfidence?: number | null;
  batchText?: string | null;
  batchConfidence?: number | null;
  batchProvider?: string | null;
}): ReconciledTranscript {
  const liveText = input.liveText.trim();
  const batchText = (input.batchText ?? "").trim();

  if (!batchText) {
    return {
      text: liveText,
      source: "live",
      confidence: input.liveConfidence ?? null,
      provider: null,
    };
  }

  const liveWords = liveText ? liveText.split(/\s+/).length : 0;
  const batchWords = batchText.split(/\s+/).length;
  // Batch heard less than a third of live — likely a clipped/failed upload.
  if (liveWords > 0 && batchWords < liveWords / 3) {
    return {
      text: liveText,
      source: "live",
      confidence: input.liveConfidence ?? null,
      provider: null,
    };
  }

  return {
    text: batchText,
    source: "batch",
    confidence: input.batchConfidence ?? null,
    provider: input.batchProvider ?? null,
  };
}
