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
    <section aria-labelledby="speaker-check" className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5 sm:p-6">
      <h2 id="speaker-check" className="flex items-center gap-2.5 text-[15px] font-medium text-zinc-100">
        <SpeakerHighIcon size={18} /> Speaker
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
        Plays a short tone{outputDeviceId ? " on your chosen speaker" : " on your default speaker"}. You should hear
        the interviewer through the same output.
      </p>
      <button
        type="button"
        onClick={() => void playTone()}
        disabled={playing}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:opacity-50"
      >
        <SpeakerHighIcon size={16} weight="fill" />
        {playing ? "Playing…" : "Play test sound"}
      </button>
      {note && <p role="status" className="mt-3 text-sm text-amber-300">{note}</p>}
    </section>
  );
}
