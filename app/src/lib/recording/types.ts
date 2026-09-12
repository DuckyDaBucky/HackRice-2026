export interface RecordingArtifact {
  id: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: string;
}

export interface RecordingSink {
  submit(
    artifact: RecordingArtifact,
    context: { sessionId: string; questionId: string },
  ): Promise<void>;
}
