import type { RecordingSink } from "./types";

/** Stands in for the real analysis pipeline until an upload endpoint exists. */
export const inMemorySink: RecordingSink = {
  async submit(artifact, context) {
    console.log("[inMemorySink] recording ready for upload", context, {
      id: artifact.id,
      mimeType: artifact.mimeType,
      durationMs: artifact.durationMs,
      sizeBytes: artifact.blob.size,
    });
  },
};
