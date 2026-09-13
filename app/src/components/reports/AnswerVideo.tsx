"use client";

import { useEffect, useState } from "react";
import { getPersistedArtifactPlaybackUrl } from "@/app/interview/v2-actions";

/**
 * Plays a review clip with a fresh signed URL: the SSR-signed URL expires
 * after ~1h, so refresh it on mount when we know the artifact id.
 */
export function AnswerVideo({
  sessionId,
  artifactId,
  initialUrl,
  turnId,
}: {
  sessionId: string;
  artifactId: string | null;
  initialUrl: string | null;
  turnId: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artifactId) return;
    let cancelled = false;
    void getPersistedArtifactPlaybackUrl(sessionId, artifactId)
      .then((fresh) => {
        if (!cancelled) setUrl(fresh);
      })
      .catch(() => {
        if (!cancelled) setError("This recording link expired and could not be refreshed.");
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId, sessionId]);

  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
        {error ?? "No recording was saved for this answer"}
      </div>
    );
  }
  return (
    <video
      key={turnId}
      src={url}
      controls
      preload="metadata"
      playsInline
      className="aspect-video w-full rounded-xl bg-black"
    />
  );
}
