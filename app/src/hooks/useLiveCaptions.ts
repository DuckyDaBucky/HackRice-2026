"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLiveCaptions {
  isSupported: boolean;
  interimText: string;
  finalText: string;
  /** Mean confidence of committed final segments (0-1), or null if unknown. */
  confidence: number | null;
  /** Timestamp of the last committed segment, or null before the first one. */
  lastFinalAt: number | null;
  /** Timestamp of any detected speech, including a still-in-progress phrase. */
  lastSpeechAt: number | null;
  /** Resets any prior transcript and begins listening for a new answer. */
  start: () => void;
  /** Restarts recognition after a recording pause without clearing saved text. */
  resume: () => void;
  stop: () => void;
  /** Replaces the committed transcript (server correction or manual edit). */
  correctTranscript: (text: string) => void;
}

// Errors that mean "don't bother trying again" (permission revoked, no mic).
// Everything else (no-speech, network, aborted) is transient and expected —
// Chrome fires "no-speech" after even a brief natural pause mid-sentence.
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

export function useLiveCaptions(): UseLiveCaptions {
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [lastFinalAt, setLastFinalAt] = useState<number | null>(null);
  const [lastSpeechAt, setLastSpeechAt] = useState<number | null>(null);
  const confidenceAccumRef = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 });
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
      // A final segment can arrive while someone is continuing the same
      // thought. Treat interim speech as activity too, so the interviewer
      // never mistakes that commit for a completed answer.
      // NOTE: interim text is provisional display only. Durable logic
      // (silence detection, follow-ups, saved transcripts) must use
      // finalText — interim segments are frequently revised or dropped.
      setLastSpeechAt(Date.now());
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const segmentConfidence =
            typeof result[0].confidence === "number" ? result[0].confidence : null;
          if (segmentConfidence !== null) {
            confidenceAccumRef.current.sum += segmentConfidence;
            confidenceAccumRef.current.count += 1;
            setConfidence(
              confidenceAccumRef.current.sum / confidenceAccumRef.current.count,
            );
          }
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
    setConfidence(null);
    confidenceAccumRef.current = { sum: 0, count: 0 };
    setLastFinalAt(null);
    setLastSpeechAt(null);
    beginListening();
  }, [isSupported, beginListening]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
  }, []);

  const resume = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;
    beginListening();
  }, [beginListening, isSupported]);

  const correctTranscript = useCallback((text: string) => {
    setFinalText(text.trim());
    setInterimText("");
    setLastSpeechAt((prev) => prev ?? Date.now());
  }, []);

  return { isSupported, interimText, finalText, confidence, lastFinalAt, lastSpeechAt, start, resume, stop, correctTranscript };
}
