"use client";

import { useCallback, useRef, useState } from "react";
import type { InterviewMood } from "@/lib/interview-config";

export interface UseTextToSpeech {
  isSpeaking: boolean;
  speak: (text: string, voiceId?: string, mood?: InterviewMood) => Promise<void>;
  stop: () => void;
}

export function useTextToSpeech(): UseTextToSpeech {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playbackResolveRef = useRef<(() => void) | null>(null);
  // Bumped on every stop()/speak(). A speak() call whose token has since
  // been superseded discards its result instead of playing — otherwise an
  // in-flight fetch from an effect React Strict Mode double-invoked (or a
  // rapid question change) would still play after the fact, overlapping
  // with whatever spoke after it. This is the actual fix for that, not a
  // cleanup-based workaround, since cleanup can't cancel a resolved fetch.
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    audioRef.current?.pause();
    playbackResolveRef.current?.();
    playbackResolveRef.current = null;
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string, mood?: InterviewMood) => {
      stop();
      const requestId = requestIdRef.current;
      try {
        const response = await fetch("/api/interview/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId, mood }),
        });
        if (requestId !== requestIdRef.current) return;
        if (!response.ok) return;

        const blob = await response.blob();
        if (requestId !== requestIdRef.current) return;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          // Some browsers (and headless environments) can play an audio
          // element without ever delivering `ended`. Keep the interview
          // moving if that happens; normal playback still completes through
          // `onended` first.
          const fallbackMs = Math.min(
            20_000,
            Math.max(3_000, text.trim().split(/\s+/).length * 500 + 2_000),
          );
          let fallbackId: number | null = null;
          const finish = () => {
            if (fallbackId !== null) window.clearTimeout(fallbackId);
            if (requestId === requestIdRef.current) setIsSpeaking(false);
            if (playbackResolveRef.current === finish) playbackResolveRef.current = null;
            resolve();
          };

          fallbackId = window.setTimeout(finish, fallbackMs);
          playbackResolveRef.current = finish;
          audio.onended = finish;
          audio.onerror = finish;
          setIsSpeaking(true);
          audio.play().catch(finish);
        });
      } catch {
        if (requestId === requestIdRef.current) setIsSpeaking(false);
      }
    },
    [stop],
  );

  return { isSpeaking, speak, stop };
}
