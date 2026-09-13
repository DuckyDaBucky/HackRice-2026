"use client";

import { useEffect, useRef, useState } from "react";
import { MicrophoneIcon, PlayIcon, RecordIcon, StopIcon } from "@phosphor-icons/react";
import { pickRecordingMimeType } from "@/lib/recording/mime-type";
import type { TranscribeResponse } from "@/lib/transcription/types";

const TEST_SECONDS = 3;

/**
 * Mic check: live level meter, 3-second record-and-playback, and a real
 * server-transcription demo of the recorded clip.
 */
export function MicCheck({ stream }: { stream: MediaStream | null }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "ready">("idle");
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(TEST_SECONDS);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Live level meter — drives the bar directly, no re-renders per frame.
  // Skipped entirely under reduced motion (OS setting or site toggle).
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const reduced =
      document.documentElement.hasAttribute("data-motion") ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduced) {
      if (barRef.current) barRef.current.style.transform = "scaleX(0.4)";
      return;
    }
    let context: AudioContext | null = null;
    let raf = 0;
    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const value of data) peak = Math.max(peak, Math.abs(value - 128) / 128);
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, peak * 1.6)})`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Meter is a nicety — recording still works without it.
    }
    return () => {
      cancelAnimationFrame(raf);
      void context?.close().catch(() => undefined);
    };
  }, [stream]);

  useEffect(() => () => {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
  }, [clipUrl]);

  if (!stream) return null;

  const startTest = () => {
    setNote(null);
    setTranscript(null);
    let recorder: MediaRecorder;
    try {
      const audioOnly = new MediaStream(stream.getAudioTracks());
      const mimeType = pickRecordingMimeType();
      recorder = mimeType ? new MediaRecorder(audioOnly, { mimeType }) : new MediaRecorder(audioOnly);
    } catch {
      setNote("Recording is not supported in this browser.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      setClipUrl(URL.createObjectURL(blob));
      setPhase("ready");
    };
    recorderRef.current = recorder;
    recorder.start();
    setPhase("recording");
    setCountdown(TEST_SECONDS);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = TEST_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
      if (left <= 0) {
        window.clearInterval(id);
        recorderRef.current?.stop();
      } else {
        setCountdown(left);
      }
    }, 250);
  };

  const runTranscriptionDemo = async () => {
    if (!clipUrl) return;
    setTranscribing(true);
    setTranscript(null);
    setNote(null);
    try {
      const blob = await (await fetch(clipUrl)).blob();
      const form = new FormData();
      form.append("audio", blob, "mic-test.webm");
      const response = await fetch("/api/interview/transcribe", { method: "POST", body: form });
      if (!response.ok) throw new Error("transcription failed");
      const data = (await response.json()) as Partial<TranscribeResponse>;
      const text = typeof data.transcript === "string" ? data.transcript.trim() : "";
      setTranscript(text || "No speech detected in the clip — try again, a little louder.");
    } catch {
      setNote("Could not reach the transcription service. Your mic recording still plays back above.");
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <section aria-labelledby="mic-check" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 id="mic-check" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <MicrophoneIcon size={17} /> Microphone check
      </h2>

      <div className="mt-3">
        <div
          className="h-2 overflow-hidden rounded-full bg-zinc-800"
          role="meter"
          aria-label="Microphone input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={phase === "recording" ? "Listening" : "Speak to see your level"}
        >
          <div ref={barRef} className="h-full w-full origin-left rounded-full bg-sky-400" style={{ transform: "scaleX(0)" }} />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {phase === "recording" ? `Recording… ${countdown}s — say something` : "Speak to see your level move."}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTest}
          disabled={phase === "recording"}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3.5 py-1.5 text-sm transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {phase === "recording" ? <StopIcon size={15} weight="fill" /> : <RecordIcon size={15} weight="fill" />}
          {phase === "recording" ? "Recording…" : "Record 3s test"}
        </button>
        {clipUrl && (
          <audio controls src={clipUrl} className="h-9 w-full min-w-0 flex-1" aria-label="Play back your mic test recording" />
        )}
      </div>

      {phase === "ready" && clipUrl && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={() => void runTranscriptionDemo()}
            disabled={transcribing}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/10 px-3.5 py-1.5 text-sm text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
          >
            <PlayIcon size={15} weight="fill" />
            {transcribing ? "Transcribing…" : "Try live transcription"}
          </button>
          {transcript && (
            <p aria-live="polite" className="mt-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-200">
              “{transcript}”
            </p>
          )}
        </div>
      )}

      {note && <p role="status" className="mt-2 text-xs text-amber-300">{note}</p>}
    </section>
  );
}
