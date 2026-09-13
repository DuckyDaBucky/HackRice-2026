"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  MicrophoneIcon,
  SpeakerHighIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { InterviewMood } from "@/lib/interview-config";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useMediaDeviceList } from "@/hooks/useMediaDeviceList";
import type { InterviewMode } from "@/lib/questions/types";
import {
  AUDIO_DEVICE_KEY,
  OUTPUT_DEVICE_KEY,
  VIDEO_DEVICE_KEY,
  friendlyDeviceLabel,
  readDeviceId,
  storeDeviceId,
} from "@/lib/media/devices";
import { MicCheck } from "@/components/lobby/MicCheck";
import { SpeakerCheck } from "@/components/lobby/SpeakerCheck";
import { SubtitlePicker } from "@/components/lobby/SubtitlePicker";

const MODE_LABEL: Record<InterviewMode, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

export function InterviewLobby({
  mode,
  recorder,
  resumeProgress,
}: {
  mode: InterviewMode;
  recorder: UseCameraRecorder;
  voiceId: string;
  mood: InterviewMood;
  /** Present only when re-entering a session that already has uploaded answers. */
  resumeProgress?: { answered: number; total: number };
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const { devices, refresh: refreshDevices } = useMediaDeviceList();
  const [videoId, setVideoId] = useState<string | null>(() => readDeviceId(VIDEO_DEVICE_KEY));
  const [audioId, setAudioId] = useState<string | null>(() => readDeviceId(AUDIO_DEVICE_KEY));
  const [outputId, setOutputId] = useState<string | null>(() => readDeviceId(OUTPUT_DEVICE_KEY));
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [requestingPreview, setRequestingPreview] = useState(false);
  const previewRef = useRef<MediaStream | null>(null);

  const isJoining = recorder.state === "requesting-permission";
  const joinError = recorder.state === "error";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/interviews");
  };

  const stopPreview = useCallback(() => {
    previewRef.current?.getTracks().forEach((track) => track.stop());
    previewRef.current = null;
    setPreviewStream(null);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream;
  }, [previewStream]);

  const acquire = useCallback(
    async (nextVideoId: string | null, nextAudioId: string | null) => {
      setRequestingPreview(true);
      setPreviewError(null);
      stopPreview();
      const constraints = (exact: boolean): MediaStreamConstraints => ({
        video: nextVideoId && exact ? { deviceId: { exact: nextVideoId } } : true,
        audio: nextAudioId && exact
          ? {
              deviceId: { exact: nextAudioId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      try {
        try {
          previewRef.current = await navigator.mediaDevices.getUserMedia(constraints(true));
        } catch (err) {
          if (err instanceof OverconstrainedError || (err instanceof Error && err.name === "OverconstrainedError")) {
            if (nextVideoId) {
              setVideoId(null);
              storeDeviceId(VIDEO_DEVICE_KEY, null);
            }
            if (nextAudioId) {
              setAudioId(null);
              storeDeviceId(AUDIO_DEVICE_KEY, null);
            }
            previewRef.current = await navigator.mediaDevices.getUserMedia(constraints(false));
          } else {
            throw err;
          }
        }
        setPreviewStream(previewRef.current);
        await refreshDevices();
      } catch {
        setPreviewError(
          "Could not access your camera or microphone. Check the browser permission icon in the address bar, then try again.",
        );
      } finally {
        setRequestingPreview(false);
      }
    },
    [refreshDevices, stopPreview],
  );

  const handleJoin = async () => {
    stopPreview();
    await recorder.start({ videoDeviceId: videoId, audioDeviceId: audioId });
  };

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const selectClass =
    "w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-sky-500";

  return (
    <div className="min-h-[100dvh] bg-[#0c0e12] text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-5 sm:px-8 sm:py-6 lg:gap-6">
        <header className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <ArrowLeftIcon size={16} weight="bold" />
            Back
          </button>

          <div className="max-w-2xl">
            <p className="text-[13px] font-medium tracking-wide text-sky-400/90">
              {MODE_LABEL[mode]} practice interview
            </p>
            <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              {resumeProgress ? "Resume your interview" : "Check your setup"}
            </h1>
            {resumeProgress && (
              <p className="mt-3 inline-flex rounded-full bg-amber-500/10 px-3.5 py-1.5 text-sm font-medium text-amber-300">
                {resumeProgress.answered} of {resumeProgress.total} answered — continuing from
                question {resumeProgress.answered + 1}
              </p>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)] lg:gap-6">
          <div className="flex flex-col gap-4">
            <section
              aria-labelledby="camera-preview"
              className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/40 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)]"
            >
              <div className="relative aspect-video w-full bg-black lg:min-h-[22rem] lg:aspect-auto">
                {previewStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
                    aria-label="Camera preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
                    <VideoCameraSlashIcon size={48} weight="light" className="text-zinc-600" />
                    <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
                      Enable your camera and microphone to preview yourself before the call starts.
                    </p>
                    <button
                      type="button"
                      onClick={() => void acquire(videoId, audioId)}
                      disabled={requestingPreview}
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white active:scale-[0.98] disabled:opacity-60"
                    >
                      <VideoCameraIcon size={18} weight="fill" />
                      {requestingPreview ? "Requesting access…" : "Enable preview"}
                    </button>
                  </div>
                )}
                {previewStream && (
                  <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                    <CheckCircleIcon size={14} weight="fill" className="text-emerald-400" />
                    Preview live
                  </span>
                )}
              </div>
              <h2 id="camera-preview" className="sr-only">
                Camera preview
              </h2>
            </section>

            <div className="flex flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={isJoining}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-sky-500 px-10 py-4 text-base font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-60"
              >
                <VideoCameraIcon size={20} weight="fill" />
                {isJoining ? "Joining…" : joinError ? "Try again" : "Enter call and start"}
              </button>
              {!previewStream && !previewError && (
                <p className="text-center text-sm text-zinc-500">You can join directly — checks are optional but recommended.</p>
              )}
            </div>

            {previewStream && (
              <section aria-label="Devices" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-xs font-medium tracking-wide text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <VideoCameraIcon size={15} /> Camera
                  </span>
                  <select
                    aria-label="Camera"
                    value={videoId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      setVideoId(next);
                      storeDeviceId(VIDEO_DEVICE_KEY, next);
                      void acquire(next, audioId);
                    }}
                    className={selectClass}
                  >
                    <option value="">Default camera</option>
                    {cameras.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {friendlyDeviceLabel(d, i)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium tracking-wide text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <MicrophoneIcon size={15} /> Microphone
                  </span>
                  <select
                    aria-label="Microphone"
                    value={audioId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      setAudioId(next);
                      storeDeviceId(AUDIO_DEVICE_KEY, next);
                      void acquire(videoId, next);
                    }}
                    className={selectClass}
                  >
                    <option value="">Default microphone</option>
                    {microphones.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {friendlyDeviceLabel(d, i)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium tracking-wide text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <SpeakerHighIcon size={15} /> Speaker
                  </span>
                  <select
                    aria-label="Speaker"
                    value={outputId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      setOutputId(next);
                      storeDeviceId(OUTPUT_DEVICE_KEY, next);
                    }}
                    className={selectClass}
                  >
                    <option value="">Default speaker</option>
                    {speakers.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {friendlyDeviceLabel(d, i)}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <MicCheck stream={previewStream} />
            <SpeakerCheck outputDeviceId={outputId} />
            <SubtitlePicker />
          </aside>
        </div>

        {(previewError || joinError) && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl bg-red-950/50 px-5 py-4 text-sm text-red-200 ring-1 ring-inset ring-red-900/80"
          >
            <WarningCircleIcon size={20} className="mt-0.5 shrink-0" />
            <span>
              {previewError ?? recorder.error?.message ?? "Could not access your camera or microphone."}
            </span>
          </div>
        )}

        <footer className="flex flex-col items-center gap-2 border-t border-zinc-900 pt-5 pb-2">
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={isJoining}
            className="inline-flex items-center gap-2.5 rounded-full bg-sky-500 px-10 py-3.5 text-base font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-60"
          >
            <VideoCameraIcon size={20} weight="fill" />
            {isJoining ? "Joining…" : joinError ? "Try again" : "Enter call and start"}
          </button>
          {!previewStream && !previewError && (
            <p className="text-sm text-zinc-500">You can join directly — checks are optional but recommended.</p>
          )}
        </footer>
      </div>
    </div>
  );
}
