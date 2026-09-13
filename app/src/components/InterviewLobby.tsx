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
import { getVoiceLabel } from "@/lib/voice/presets";
import { MOOD_OPTIONS, type InterviewMood } from "@/lib/interview-config";
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
  voiceId,
  mood,
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
  const moodLabel = MOOD_OPTIONS.find((option) => option.id === mood)?.label ?? "Neutral";

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
          // A saved device may be gone — drop it and open the default.
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
    // The meeting view owns the first prompt after a successful camera join,
    // which prevents duplicate speech and immediately begins the live turn.
    // The lobby preview is separate so checking devices never starts the call.
    stopPreview();
    await recorder.start({ videoDeviceId: videoId, audioDeviceId: audioId });
  };

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const selectClass =
    "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-600";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 px-4 py-6 text-zinc-50 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <ArrowLeftIcon size={16} weight="bold" />
            Back
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-sm font-medium text-sky-400">{MODE_LABEL[mode]} practice interview</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {resumeProgress ? "Resume your interview" : "Check your setup, then join"}
            </h1>
            {resumeProgress && (
              <span className="mt-2 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                {resumeProgress.answered} of {resumeProgress.total} answered — continuing from
                question {resumeProgress.answered + 1}
              </span>
            )}
          </div>
        </div>

        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-zinc-400 sm:mx-0 sm:text-left">
          Joining turns on your camera and microphone to record each answer.
          Nothing is analyzed for facial or biometric signals, only the video
          clip itself is captured for later review, and recording stops the
          moment you leave.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 sm:justify-start">
          <span className="rounded-full bg-zinc-900 px-3 py-1 ring-1 ring-inset ring-zinc-800">
            Voice: {getVoiceLabel(voiceId)}
          </span>
          <span className="rounded-full bg-zinc-900 px-3 py-1 ring-1 ring-inset ring-zinc-800">
            Mood: {moodLabel}
          </span>
        </div>

        <div className="grid flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:gap-5">
          <div className="flex min-h-[280px] flex-col gap-4 lg:min-h-0">
            <section
              aria-labelledby="camera-preview"
              className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 lg:min-h-0"
            >
              <div className="relative min-h-[220px] flex-1 bg-black lg:min-h-0">
                {previewStream ? (
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" aria-label="Camera preview" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
                    <VideoCameraSlashIcon size={40} weight="light" className="text-zinc-600" />
                    <p className="max-w-xs text-sm text-zinc-400">
                      Enable your camera and microphone to preview yourself before the call starts.
                    </p>
                    <button
                      type="button"
                      onClick={() => void acquire(videoId, audioId)}
                      disabled={requestingPreview}
                      className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <VideoCameraIcon size={17} weight="fill" />
                      {requestingPreview ? "Requesting access…" : "Enable preview"}
                    </button>
                  </div>
                )}
                {previewStream && (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded bg-black/65 px-2.5 py-1.5 text-xs font-medium">
                    <CheckCircleIcon size={13} weight="fill" className="text-emerald-400" /> Preview live
                  </span>
                )}
              </div>
              <h2 id="camera-preview" className="sr-only">Camera preview</h2>
            </section>

            {previewStream && (
              <section aria-label="Devices" className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
                  <span className="inline-flex items-center gap-1.5"><VideoCameraIcon size={14} /> Camera</span>
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
                      <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
                  <span className="inline-flex items-center gap-1.5"><MicrophoneIcon size={14} /> Microphone</span>
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
                      <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
                  <span className="inline-flex items-center gap-1.5"><SpeakerHighIcon size={14} /> Speaker</span>
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
                      <option key={d.deviceId || i} value={d.deviceId}>{friendlyDeviceLabel(d, i)}</option>
                    ))}
                  </select>
                </label>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:gap-4">
            <MicCheck stream={previewStream} />
            <SpeakerCheck outputDeviceId={outputId} />
            <SubtitlePicker />
            {!previewStream && (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-center text-xs leading-relaxed text-zinc-500">
                Mic and speaker checks unlock once the preview is on — they use your live devices.
              </p>
            )}
          </div>
        </div>

        {(previewError || joinError) && (
          <div role="alert" className="flex w-full items-start gap-2 rounded-xl bg-red-950/60 px-4 py-3 text-left text-sm text-red-300 ring-1 ring-inset ring-red-900">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
            <span>{previewError ?? recorder.error?.message ?? "Could not access your camera or microphone."}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={isJoining}
            className="flex items-center gap-2 rounded-full bg-sky-500 px-8 py-3.5 text-base font-medium text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
          >
            <VideoCameraIcon size={19} weight="fill" />
            {isJoining ? "Joining…" : joinError ? "Try again" : "Enter call and start"}
          </button>
          {!previewStream && !previewError && (
            <p className="text-xs text-zinc-500">You can join directly — checks are optional but recommended.</p>
          )}
        </div>
      </div>
    </div>
  );
}
