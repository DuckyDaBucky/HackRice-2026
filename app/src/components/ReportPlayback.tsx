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
    return <video controls preload="metadata" className="mt-3 w-full rounded-lg bg-black" src={url} />;
  }
  return (
    <div className="mt-3 flex items-center gap-3">
      <button type="button" onClick={() => void openPlayback()} className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/10">
        <PlayIcon size={14} weight="fill" /> Play recording
      </button>
      {error && <span role="status" className="text-xs text-amber-200">{error}</span>}
    </div>
  );
}
