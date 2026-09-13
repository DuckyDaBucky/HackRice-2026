"use client";

import { useState } from "react";
import { PlayIcon } from "@phosphor-icons/react";
import { getPersistedArtifactPlaybackUrl } from "@/app/interview/v2-actions";

export function ReportPlayback({ sessionId, artifactId }: { sessionId: string; artifactId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPlayback = async () => {
    try {
      setError(null);
      setUrl(await getPersistedArtifactPlaybackUrl(sessionId, artifactId));
    } catch {
      setError("Recording playback is unavailable right now.");
    }
  };

  if (url) {
    return <video controls preload="metadata" className="mt-4 aspect-video w-full rounded-lg bg-black" src={url} />;
  }
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        onClick={() => void openPlayback()}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-accent/35 px-3 text-xs font-semibold text-accent-deep transition-colors duration-150 hover:bg-accent/10"
      >
        <PlayIcon size={14} weight="fill" /> Play recording
      </button>
      {error && <span role="status" className="text-xs text-amber-600">{error}</span>}
    </div>
  );
}
