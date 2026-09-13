"use client";

import { useState } from "react";
import { SpeakerHighIcon } from "@phosphor-icons/react";
import { playTestTone } from "@/lib/media/test-tone";

/**
 * Speaker check: plays a short tone through the selected output device.
 * Falls back to the default output where setSinkId is unavailable.
 */
export function SpeakerCheck({ outputDeviceId }: { outputDeviceId: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const playTone = async () => {
    setNote(null);
    setPlaying(true);
    const result = await playTestTone(outputDeviceId);
    if (!result.played) {
      setNote("Could not play the test sound.");
    } else if (result.usedFallbackOutput) {
      setNote("This browser can't switch speakers, so the tone plays on your default output.");
    }
    setPlaying(false);
  };

  return (
    <section aria-labelledby="speaker-check" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 id="speaker-check" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <SpeakerHighIcon size={17} /> Speaker check
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Plays a short tone{outputDeviceId ? " on your chosen speaker" : " on your default speaker"}. You should hear the interviewer through the same output.
      </p>
      <button
        type="button"
        onClick={() => void playTone()}
        disabled={playing}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3.5 py-1.5 text-sm transition hover:bg-zinc-800 disabled:opacity-50"
      >
        <SpeakerHighIcon size={15} weight="fill" />
        {playing ? "Playing…" : "Play test sound"}
      </button>
      {note && <p role="status" className="mt-2 text-xs text-amber-300">{note}</p>}
    </section>
  );
}
