"use client";

import { useEffect, useRef, useState } from "react";
import {
  describeCameraObservations,
  type CameraObservation,
} from "@/lib/biometrics/live-context";

const SAMPLE_INTERVAL_MS = 4000;
const SAMPLE_WIDTH = 96;

function luminanceOf(data: Uint8ClampedArray): number {
  let sum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return pixels === 0 ? 0 : sum / pixels;
}

function frameDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const pixels = a.length / 4;
  for (let i = 0; i < a.length; i += 12) {
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  return pixels === 0 ? 0 : sum / Math.ceil(pixels / 3) / 3;
}

export interface CameraObservationState {
  observation: CameraObservation | null;
  summary: string | null;
}

/**
 * Samples the live camera stream on a hidden canvas every few seconds and
 * reports coarse, honest signals (presence, light, motion) the interview LLM
 * can use as weak delivery cues. Never performs identity, emotion, or
 * physiology inference — that stays in presage-api's native SDK path.
 */
export function useCameraObservations(stream: MediaStream | null): CameraObservationState {
  const [observation, setObservation] = useState<CameraObservation | null>(null);
  const previousRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    if (!stream || typeof document === "undefined") {
      setObservation(null);
      previousRef.current = null;
      return;
    }
    const videoTracks = stream.getVideoTracks().filter((track) => track.readyState === "live");
    if (videoTracks.length === 0) {
      setObservation({ cameraOn: false, presence: "unknown", light: "unknown", motion: "unknown" });
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
    video.srcObject = stream;
    const canvas = document.createElement("canvas");
    let stopped = false;
    let interval = 0;

    const sample = () => {
      if (stopped || video.videoWidth === 0 || video.videoHeight === 0) return;
      const scale = SAMPLE_WIDTH / video.videoWidth;
      canvas.width = SAMPLE_WIDTH;
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const luminance = luminanceOf(pixels);
      const previous = previousRef.current;
      previousRef.current = new Uint8ClampedArray(pixels);
      const motion = previous && previous.length === pixels.length ? frameDifference(pixels, previous) : 0;
      const next: CameraObservation = {
        cameraOn: true,
        presence: luminance < 8 ? "uncertain" : "visible",
        light: luminance < 8 ? "dark" : luminance < 40 ? "dim" : luminance > 180 ? "bright" : "ok",
        motion: motion > 28 ? "active" : motion > 10 ? "moderate" : "still",
        capturedAt: new Date().toISOString(),
      };
      setObservation(next);
    };

    video.play().catch(() => {});
    interval = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    const kickoff = window.setTimeout(sample, 1200);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.clearTimeout(kickoff);
      video.srcObject = null;
      previousRef.current = null;
    };
  }, [stream]);

  return { observation, summary: describeCameraObservations(observation) };
}
