import {
  confirmAnswerFailed,
  confirmAnswerUploaded,
  getAnswerUploadUrl,
} from "@/app/interview/actions";
import type { RecordingSink } from "./types";

/** Uploads a clip straight to R2 from the browser, then records the result — replaces inMemorySink. */
export const r2Sink: RecordingSink = {
  async submit(artifact, context) {
    const { sessionId, questionId } = context;
    try {
      const { url, key, mode } = await getAnswerUploadUrl(sessionId, questionId, artifact.mimeType);

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": artifact.mimeType },
        body: artifact.blob,
      });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);

      await confirmAnswerUploaded({
        sessionId,
        questionId,
        mode,
        mediaRef: key,
        mimeType: artifact.mimeType,
        durationMs: artifact.durationMs,
      });
    } catch (error) {
      await confirmAnswerFailed(sessionId, questionId).catch(() => {});
      throw error;
    }
  },
};
