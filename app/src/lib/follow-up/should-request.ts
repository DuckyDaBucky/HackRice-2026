const SILENCE_THRESHOLD_MS = 1500;
const MIN_TRANSCRIPT_LENGTH = 20;

export function shouldRequestFollowUp(state: {
  hasFollowUpAlready: boolean;
  msSinceLastFinalSegment: number;
  transcriptLength: number;
}): boolean {
  if (state.hasFollowUpAlready) return false;
  if (state.msSinceLastFinalSegment < SILENCE_THRESHOLD_MS) return false;
  if (state.transcriptLength < MIN_TRANSCRIPT_LENGTH) return false;
  return true;
}
