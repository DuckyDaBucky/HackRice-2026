/** Shared transcription contract for live + batch providers. */

export type TranscriptSource = "live" | "batch" | "corrected";

export interface ReconciledTranscript {
  text: string;
  source: TranscriptSource;
  /** 0-1 when the winning provider reports it, otherwise null. */
  confidence: number | null;
  /** Which batch provider produced the text ("deepgram" | "gemini"), if any. */
  provider: string | null;
}

export interface TranscribeResponse {
  transcript: string;
  confidence: number | null;
  provider: "deepgram" | "gemini";
}
