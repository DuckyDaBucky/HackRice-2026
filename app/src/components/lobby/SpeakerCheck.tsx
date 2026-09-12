"use client";

import { useState } from "react";
import { SpeakerHighIcon } from "@phosphor-icons/react";

type SinkableAudio = HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> };

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
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) throw new Error("unsupported");
      const context = new Context();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 660;
      const gain = context.createGain();
      gain.gain.value = 0.12;
      oscillator.connect(gain);
      const destination = context.createMediaStreamDestination();
      gain.connect(destination);
      const audio: SinkableAudio = new Audio();
      audio.srcObject = destination.stream;
      if (outputDeviceId) {
        if (typeof audio.setSinkId === "function") {
          await audio.setSinkId(outputDeviceId);
        } else {
          setNote("This browser can't switch speakers, so the tone plays on your default output.");
        }
      }
      await audio.play().catch(() => undefined);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.6);
      window.setTimeout(() => {
        void context.close().catch(() => undefined);
        setPlaying(false);
      }, 900);
    } catch {
      setNote("Could not play the test sound.");
      setPlaying(false);
    }
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
