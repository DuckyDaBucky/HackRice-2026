"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLiveCaptions {
  isSupported: boolean;
  interimText: string;
  finalText: string;
  /** Timestamp of the last committed segment, or null before the first one. */
  lastFinalAt: number | null;
  /** Resets any prior transcript and begins listening for a new answer. */
  start: () => void;
  stop: () => void;
}

// Errors that mean "don't bother trying again" (permission revoked, no mic).
// Everything else (no-speech, network, aborted) is transient and expected —
// Chrome fires "no-speech" after even a brief natural pause mid-sentence.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

export function useLiveCaptions(): UseLiveCaptions {
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [lastFinalAt, setLastFinalAt] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Holds the latest beginListening so onend's restart can call it without
  // a "used before declared" self-reference (see beginListening below).
  const beginListeningRef = useRef<() => void>(() => {});

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  // Creates, wires up, and starts a fresh SpeechRecognition instance —
  // separate from start() below because auto-restarts must NOT clear the
  // transcript accumulated so far. Chrome does not reliably support
  // calling .start() again on an instance that has already ended, so a
  // fresh instance per restart is the standard workaround.
  const beginListening = useCallback(() => {
    if (!isSupported) return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          setFinalText((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript.trim()));
          setLastFinalAt(Date.now());
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (FATAL_ERRORS.has(event.error) && recognitionRef.current === recognition) {
        // Stop trying to restart — onend below checks this and backs off.
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      // Only restart if we still own this instance: not superseded by an
      // explicit stop() (which nulls this first) or a fatal error above.
      if (recognitionRef.current !== recognition) return;
      beginListeningRef.current();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
  });

  const start = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;
    setInterimText("");
    setFinalText("");
    setLastFinalAt(null);
    beginListening();
  }, [isSupported, beginListening]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
  }, []);

  return { isSupported, interimText, finalText, lastFinalAt, start, stop };
}
