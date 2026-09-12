import type { TranscriptSegment } from "@/lib/interviews/contracts";

/**
 * Transcript-level review markers: self-review only, per docs/23's "pace and filler-word review
 * markers are deliberately deferred from MVP ... will not influence any score." Never persisted,
 * never merged into report findings.
 */

const LONG_PAUSE_THRESHOLD_MS = 3_000;
const FILLER_WORD_PATTERN = /\b(um|uh|like|you know)\b/gi;

export interface PauseMarker {
  afterSegmentIndex: number;
  gapMs: number;
  atMs: number;
}

export interface TranscriptMarkers {
  longPauses: PauseMarker[];
  fillerWordCount: number;
  wordCount: number;
  fillerWordRate: number;
}

export function deriveTranscriptMarkers(segments: TranscriptSegment[]): TranscriptMarkers {
  const longPauses: PauseMarker[] = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    const gapMs = segments[index + 1].startMs - segments[index].endMs;
    if (gapMs > LONG_PAUSE_THRESHOLD_MS) {
      longPauses.push({ afterSegmentIndex: index, gapMs, atMs: segments[index].endMs });
    }
  }

  const fullText = segments.map((segment) => segment.text).join(" ");
  const fillerWordCount = fullText.match(FILLER_WORD_PATTERN)?.length ?? 0;
  const wordCount = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;

  return {
    longPauses,
    fillerWordCount,
    wordCount,
    fillerWordRate: wordCount > 0 ? fillerWordCount / wordCount : 0,
  };
}
