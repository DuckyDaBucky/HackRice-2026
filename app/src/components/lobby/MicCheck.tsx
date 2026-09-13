"use client";

import { useEffect, useRef, useState } from "react";
import { MicrophoneIcon, PlayIcon, RecordIcon, StopIcon } from "@phosphor-icons/react";
import { pickRecordingMimeType } from "@/lib/recording/mime-type";
import type { TranscribeResponse } from "@/lib/transcription/types";

const TEST_SECONDS = 3;

/**
 * Mic check: live level meter, short record/playback, optional transcription demo.
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
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, peak * 2.2)})`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Meter is optional — recording still works.
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
    <section aria-labelledby="mic-check" className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5 sm:p-6">
      <h2 id="mic-check" className="flex items-center gap-2.5 text-[15px] font-medium text-zinc-100">
        <MicrophoneIcon size={18} /> Microphone
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
        Watch the meter while you speak, then optionally record a short clip.
      </p>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">Input level</p>
          <p className="text-sm text-zinc-400">
            {phase === "recording" ? `Recording… ${countdown}s` : "Speak to test"}
          </p>
        </div>
        <div
          className="mt-3 h-5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-inset ring-zinc-800"
          role="meter"
          aria-label="Microphone input level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={phase === "recording" ? "Listening" : "Speak to see your level"}
        >
          <div
            ref={barRef}
            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-300 shadow-[0_0_16px_rgba(56,189,248,0.4)]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={startTest}
            disabled={phase === "recording"}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {phase === "recording" ? <StopIcon size={15} weight="fill" /> : <RecordIcon size={15} weight="fill" />}
            {phase === "recording" ? "Recording…" : "Record 3s"}
          </button>
          {phase === "ready" && clipUrl && (
            <button
              type="button"
              onClick={() => void runTranscriptionDemo()}
              disabled={transcribing}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50"
            >
              <PlayIcon size={15} weight="fill" />
              {transcribing ? "Transcribing…" : "Test transcription"}
            </button>
          )}
        </div>
        {clipUrl && (
          <audio controls src={clipUrl} className="h-10 w-full" aria-label="Play back your mic test recording" />
        )}
      </div>

      {transcript && (
        <p aria-live="polite" className="mt-4 rounded-xl bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200">
          “{transcript}”
        </p>
      )}

      {note && <p role="status" className="mt-3 text-sm text-amber-300">{note}</p>}
    </section>
  );
}
