"use client";

import { useCallback, useRef, useState } from "react";
import { pickRecordingMimeType } from "@/lib/recording/mime-type";
import { recorderReducer, type RecorderState } from "@/lib/recording/recorder-state";
import type { RecordingArtifact } from "@/lib/recording/types";

export interface UseCameraRecorder {
  state: RecorderState;
  error: Error | null;
  stream: MediaStream | null;
  /** Requests camera/mic permission and opens the stream. Call once per session. */
  start: () => Promise<void>;
  /** Begins recording the current question into a fresh MediaRecorder. */
  record: () => void;
  pause: () => void;
  resume: () => void;
  /** Stops the current MediaRecorder and resolves with the finished clip. */
  stop: () => Promise<RecordingArtifact>;
  /** Call after handling a stopped clip to go back to "ready" for the next question. */
  reset: () => void;
  /** Stops all tracks and releases the camera. Call on unmount / session end. */
  release: () => void;
}

export function useCameraRecorder(): UseCameraRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const stopResolveRef = useRef<((artifact: RecordingArtifact) => void) | null>(null);

  const dispatch = useCallback(
    (event: Parameters<typeof recorderReducer>[1]) =>
      setState((current) => recorderReducer(current, event)),
    [],
  );

  const start = useCallback(async () => {
    dispatch({ type: "REQUEST_PERMISSION" });
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);
      dispatch({ type: "PERMISSION_GRANTED" });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not access the camera"));
      dispatch({ type: "PERMISSION_DENIED" });
    }
  }, [dispatch]);

  const record = useCallback(() => {
    if (!stream) return;

    const mimeType = pickRecordingMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setError(new Error("Recording stopped unexpectedly"));
      dispatch({ type: "DEVICE_ERROR" });
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const artifact: RecordingArtifact = {
        id: crypto.randomUUID(),
        blob,
        mimeType: recorder.mimeType,
        durationMs: Date.now() - recordingStartedAtRef.current,
        createdAt: new Date().toISOString(),
      };
      stopResolveRef.current?.(artifact);
      stopResolveRef.current = null;
    };

    recorderRef.current = recorder;
    recordingStartedAtRef.current = Date.now();
    recorder.start();
    dispatch({ type: "START" });
  }, [stream, dispatch]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    dispatch({ type: "PAUSE" });
  }, [dispatch]);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    dispatch({ type: "RESUME" });
  }, [dispatch]);

  const stop = useCallback((): Promise<RecordingArtifact> => {
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      dispatch({ type: "STOP" });
      recorderRef.current?.stop();
    });
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET_FOR_NEXT_QUESTION" });
  }, [dispatch]);

  const release = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setStream(null);
    setState("idle");
  }, [stream]);

  return { state, error, stream, start, record, pause, resume, stop, reset, release };
}
