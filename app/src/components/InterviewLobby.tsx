"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import type { InterviewMode } from "@/lib/questions/types";
import { MicCheck } from "@/components/lobby/MicCheck";
import { SpeakerCheck } from "@/components/lobby/SpeakerCheck";
import { SubtitlePicker } from "@/components/lobby/SubtitlePicker";

const MODE_LABEL: Record<InterviewMode, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

/** Labels are empty until camera/mic permission is granted — fall back to numbered names. */
export function friendlyDeviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label) return device.label;
  if (device.kind === "videoinput") return `Camera ${index + 1}`;
  if (device.kind === "audiooutput") return `Speaker ${index + 1}`;
  return `Microphone ${index + 1}`;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Non-fatal; the choice still applies to this visit.
  }
}

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState<string | null>(() => readStored("gmh-video-device"));
  const [audioId, setAudioId] = useState<string | null>(() => readStored("gmh-audio-device"));
  const [outputId, setOutputId] = useState<string | null>(() => readStored("gmh-output-device"));
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [requestingPreview, setRequestingPreview] = useState(false);
  const previewRef = useRef<MediaStream | null>(null);

  const isJoining = recorder.state === "requesting-permission";
  const joinError = recorder.state === "error";
  const moodLabel = MOOD_OPTIONS.find((option) => option.id === mood)?.label ?? "Neutral";

  const stopPreview = useCallback(() => {
    previewRef.current?.getTracks().forEach((track) => track.stop());
    previewRef.current = null;
    setPreviewStream(null);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream;
  }, [previewStream]);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch {
      // Leave the last-known list in place.
    }
  }, []);

  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

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
              store("gmh-video-device", null);
            }
            if (nextAudioId) {
              setAudioId(null);
              store("gmh-audio-device", null);
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
    <div className="flex min-h-[100dvh] flex-col items-center bg-zinc-950 px-4 py-10 text-zinc-50 sm:py-14">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm font-medium text-sky-400">{MODE_LABEL[mode]} practice interview</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {resumeProgress ? "Resume your interview" : "Check your setup, then join"}
          </h1>
          {resumeProgress && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              {resumeProgress.answered} of {resumeProgress.total} answered — continuing from
              question {resumeProgress.answered + 1}
            </span>
          )}
          <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
            Joining turns on your camera and microphone to record each answer.
            Nothing is analyzed for facial or biometric signals, only the video
            clip itself is captured for later review, and recording stops the
            moment you leave.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-zinc-900 px-3 py-1 ring-1 ring-inset ring-zinc-800">
              Voice: {getVoiceLabel(voiceId)}
            </span>
            <span className="rounded-full bg-zinc-900 px-3 py-1 ring-1 ring-inset ring-zinc-800">
              Mood: {moodLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-4">
            <section aria-labelledby="camera-preview" className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="relative aspect-video bg-black">
                {previewStream ? (
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" aria-label="Camera preview" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
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
              <section aria-label="Devices" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
                  <span className="inline-flex items-center gap-1.5"><VideoCameraIcon size={14} /> Camera</span>
                  <select
                    aria-label="Camera"
                    value={videoId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      setVideoId(next);
                      store("gmh-video-device", next);
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
                      store("gmh-audio-device", next);
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
                      store("gmh-output-device", next);
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

            <SubtitlePicker />
          </div>

          <div className="flex flex-col gap-4">
            <MicCheck stream={previewStream} />
            <SpeakerCheck outputDeviceId={outputId} />
            {!previewStream && (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-center text-xs leading-relaxed text-zinc-500">
                Mic and speaker checks unlock once the preview is on — they use your live devices.
              </p>
            )}
          </div>
        </div>

        {(previewError || joinError) && (
          <div role="alert" className="mx-auto flex w-full max-w-xl items-start gap-2 rounded-xl bg-red-950/60 px-4 py-3 text-left text-sm text-red-300 ring-1 ring-inset ring-red-900">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
            <span>{previewError ?? recorder.error?.message ?? "Could not access your camera or microphone."}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
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
