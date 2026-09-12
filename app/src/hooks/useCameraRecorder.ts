"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecordingMimeType } from "@/lib/recording/mime-type";
import { recorderReducer, type RecorderState } from "@/lib/recording/recorder-state";
import type { RecordingArtifact } from "@/lib/recording/types";

export interface UseCameraRecorder {
  state: RecorderState;
  error: Error | null;
  stream: MediaStream | null;
  /**
   * Requests camera/mic permission and opens the stream. Call once per
   * session. Resolves with the stream on success, null on denial/failure
   * — callers that need to act on the outcome (e.g. speak the first
   * question) should use the return value, not read `state`/`stream`
   * afterward, since that's a stale closure in an event handler.
   */
  start: () => Promise<MediaStream | null>;
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
  const stopResolveRef = useRef<((artifact: RecordingArtifact) => void) | null>(null);
  // Active (non-paused) recording time for the current clip, in ms.
  // Tracked explicitly so pausing doesn't inflate durationMs.
  const activeMsRef = useRef(0);
  const segmentStartedAtRef = useRef(0);
  const isSegmentActiveRef = useRef(false);
  // The stream this hook instance currently owns, checked by both the
  // getUserMedia continuation (unmount-during-request race) and track
  // "ended" listeners (device loss vs. our own release()).
  const currentStreamRef = useRef<MediaStream | null>(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    // React Strict Mode runs an extra setup → cleanup → setup cycle in
    // development. Reset this in setup so that rehearsal cleanup does not
    // leave the live hook permanently disposed and reject every camera stream.
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  const dispatch = useCallback(
    (event: Parameters<typeof recorderReducer>[1]) =>
      setState((current) => recorderReducer(current, event)),
    [],
  );

  const start = useCallback(async (): Promise<MediaStream | null> => {
    setError(null);
    dispatch({ type: "REQUEST_PERMISSION" });
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // The component using this hook may have unmounted while permission
      // was pending. Stop the tracks we just acquired instead of leaking
      // an active camera/mic that nothing will ever release.
      if (disposedRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return null;
      }

      currentStreamRef.current = mediaStream;
      mediaStream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          // Only a real device loss if we still own this stream — our own
          // release() clears the ref before stopping tracks, so a track
          // ending as a result of that is correctly ignored here.
          if (currentStreamRef.current !== mediaStream) return;
          setError(new Error("Camera or microphone disconnected"));
          dispatch({ type: "DEVICE_ERROR" });
        });
      });

      setStream(mediaStream);
      dispatch({ type: "PERMISSION_GRANTED" });
      return mediaStream;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not access the camera"));
      dispatch({ type: "PERMISSION_DENIED" });
      return null;
    }
  }, [dispatch]);

  const record = useCallback(() => {
    if (!stream) return;

    let recorder: MediaRecorder;
    try {
      const mimeType = pickRecordingMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Recording is not supported on this device"),
      );
      dispatch({ type: "DEVICE_ERROR" });
      return;
    }

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
        durationMs: activeMsRef.current,
        createdAt: new Date().toISOString(),
      };
      stopResolveRef.current?.(artifact);
      stopResolveRef.current = null;
    };

    recorderRef.current = recorder;
    activeMsRef.current = 0;
    segmentStartedAtRef.current = Date.now();
    isSegmentActiveRef.current = true;

    try {
      recorder.start();
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Recording is not supported on this device"),
      );
      recorderRef.current = null;
      isSegmentActiveRef.current = false;
      dispatch({ type: "DEVICE_ERROR" });
      return;
    }
    dispatch({ type: "START" });
  }, [stream, dispatch]);

  const pause = useCallback(() => {
    recorderRef.current?.pause();
    if (isSegmentActiveRef.current) {
      activeMsRef.current += Date.now() - segmentStartedAtRef.current;
      isSegmentActiveRef.current = false;
    }
    dispatch({ type: "PAUSE" });
  }, [dispatch]);

  const resume = useCallback(() => {
    recorderRef.current?.resume();
    segmentStartedAtRef.current = Date.now();
    isSegmentActiveRef.current = true;
    dispatch({ type: "RESUME" });
  }, [dispatch]);

  const stop = useCallback((): Promise<RecordingArtifact> => {
    if (isSegmentActiveRef.current) {
      activeMsRef.current += Date.now() - segmentStartedAtRef.current;
      isSegmentActiveRef.current = false;
    }
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
    currentStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    setStream(null);
    setError(null);
    setState("idle");
  }, [stream]);

  return { state, error, stream, start, record, pause, resume, stop, reset, release };
}
