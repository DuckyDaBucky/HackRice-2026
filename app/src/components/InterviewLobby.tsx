"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClosedCaptioningIcon,
  GearSixIcon,
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

/** Single-open settings panel beneath the stage. */
type Panel = "mic" | "speaker" | "subtitles" | "devices" | null;

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
  // True from Join click until the call UI takes over: swaps the lobby for a
  // joining state instantly instead of lingering while the camera starts.
  const [leaving, setLeaving] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // When a check opens below the fold, bring it into view instead of
  // leaving the candidate to hunt for it.
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [panel]);

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
    if (leaving) return;
    setLeaving(true);
    stopPreview();
    const stream = await recorder.start({ videoDeviceId: videoId, audioDeviceId: audioId });
    // Null = permission denied/failed: back to the lobby to try again.
    if (!stream) setLeaving(false);
  };

  const togglePanel = (next: Exclude<Panel, null>) =>
    setPanel((current) => (current === next ? null : next));

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const microphones = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const selectClass =
    "w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-sky-500";

  const pillButton =
    "flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
  const pillIdle = "bg-zinc-800 text-zinc-200 hover:bg-zinc-700";
  const pillActive = "bg-sky-500/20 text-sky-300 ring-1 ring-inset ring-sky-400/50";
  const pillDanger = "bg-zinc-800 text-zinc-200 hover:bg-zinc-700";

  return (
    <div className="min-h-[100dvh] bg-[#0c0e12] text-zinc-50">
      <div
        className="pointer-events-none fixed inset-0 [background:radial-gradient(70%_50%_at_50%_0%,rgba(56,189,248,0.08),transparent_70%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-5 py-5 sm:px-8 sm:py-6">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <ArrowLeftIcon size={16} weight="bold" />
            Back
          </button>
          <p className="truncate text-[13px] font-medium tracking-wide text-sky-400/90">
            {MODE_LABEL[mode]} practice interview
          </p>
          <span className="w-[76px]" aria-hidden="true" />
        </header>

        <div className="mt-6 text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {resumeProgress ? "Resume your interview" : "Ready to join?"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
            {resumeProgress
              ? `Pick up right where you left off — question ${resumeProgress.answered + 1} of ${resumeProgress.total}.`
              : "Check your camera and mic, then join when you're ready."}
          </p>
          {resumeProgress && (
            <p className="mt-3 inline-flex rounded-full bg-amber-500/10 px-3.5 py-1.5 text-sm font-medium text-amber-300">
              {resumeProgress.answered} of {resumeProgress.total} answered
            </p>
          )}
        </div>

        {/* Stage */}
        <section
          aria-label="Your preview"
          className="relative mx-auto mt-6 aspect-video w-full overflow-hidden rounded-3xl bg-black ring-1 ring-zinc-800/90 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)]"
        >
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
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-inset ring-zinc-700">
                <VideoCameraSlashIcon size={34} weight="light" className="text-zinc-500" />
              </span>
              <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
                Your camera is off — enable it to preview yourself before joining.
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
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm">
            You
          </span>
          {previewStream && (
            <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <CheckCircleIcon size={14} weight="fill" className="text-emerald-400" />
              Preview live
            </span>
          )}
        </section>

        {(previewError || joinError) && (
          <div
            role="alert"
            className="mx-auto mt-4 flex w-full items-start gap-3 rounded-2xl bg-red-950/50 px-5 py-4 text-sm text-red-200 ring-1 ring-inset ring-red-900/80"
          >
            <WarningCircleIcon size={20} className="mt-0.5 shrink-0" />
            <span>
              {previewError ?? recorder.error?.message ?? "Could not access your camera or microphone."}
            </span>
          </div>
        )}

        {/* Control pill */}
        <div
          className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-2 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)] backdrop-blur-sm"
          role="toolbar"
          aria-label="Pre-join checks"
        >
          <button
            type="button"
            onClick={() => (previewStream ? stopPreview() : void acquire(videoId, audioId))}
            disabled={requestingPreview}
            aria-label={previewStream ? "Turn camera off" : "Turn camera on"}
            aria-pressed={Boolean(previewStream)}
            title={previewStream ? "Turn camera off" : "Turn camera on"}
            className={`${pillButton} ${previewStream ? pillDanger : "bg-red-500/15 text-red-300 hover:bg-red-500/25"}`}
          >
            {previewStream ? (
              <VideoCameraIcon size={20} weight="fill" />
            ) : (
              <VideoCameraSlashIcon size={20} weight="fill" />
            )}
          </button>
          <button
            type="button"
            onClick={() => togglePanel("mic")}
            aria-label="Check microphone"
            aria-pressed={panel === "mic"}
            title="Check microphone"
            className={`${pillButton} ${panel === "mic" ? pillActive : pillIdle}`}
          >
            <MicrophoneIcon size={20} weight="fill" />
          </button>
          <button
            type="button"
            onClick={() => togglePanel("speaker")}
            aria-label="Check speaker"
            aria-pressed={panel === "speaker"}
            title="Check speaker"
            className={`${pillButton} ${panel === "speaker" ? pillActive : pillIdle}`}
          >
            <SpeakerHighIcon size={20} weight="fill" />
          </button>
          <button
            type="button"
            onClick={() => togglePanel("subtitles")}
            aria-label="Subtitle options"
            aria-pressed={panel === "subtitles"}
            title="Subtitle options"
            className={`${pillButton} ${panel === "subtitles" ? pillActive : pillIdle}`}
          >
            <ClosedCaptioningIcon size={20} weight="fill" />
          </button>
          <button
            type="button"
            onClick={() => togglePanel("devices")}
            aria-label="Choose devices"
            aria-pressed={panel === "devices"}
            title="Choose devices"
            className={`${pillButton} ${panel === "devices" ? pillActive : pillIdle}`}
          >
            <GearSixIcon size={20} />
          </button>
        </div>

        {/* Single-open panel: internally scrollable so long checks never
            push the Join button out of reach. */}
        {panel && (
          <div
            ref={panelRef}
            className="mx-auto mt-4 max-h-[42dvh] w-full max-w-2xl scroll-mt-4 overflow-y-auto overscroll-contain pr-0.5"
          >
            {panel === "mic" &&
              (previewStream ? (
                <MicCheck stream={previewStream} />
              ) : (
                <p className="rounded-2xl border border-dashed border-zinc-800 px-5 py-4 text-center text-sm text-zinc-500">
                  Enable your preview first, then test your microphone level here.
                </p>
              ))}
            {panel === "speaker" && <SpeakerCheck outputDeviceId={outputId} />}
            {panel === "subtitles" && <SubtitlePicker />}
            {panel === "devices" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(
                  [
                    { label: "Camera", value: videoId, set: setVideoId, key: VIDEO_DEVICE_KEY, options: cameras },
                    { label: "Microphone", value: audioId, set: setAudioId, key: AUDIO_DEVICE_KEY, options: microphones },
                    { label: "Speaker", value: outputId, set: setOutputId, key: OUTPUT_DEVICE_KEY, options: speakers },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="flex flex-col gap-2 text-xs font-medium tracking-wide text-zinc-400">
                    {field.label}
                    <select
                      aria-label={field.label}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        field.set(next);
                        storeDeviceId(field.key, next);
                        if (field.key !== OUTPUT_DEVICE_KEY && previewStream) {
                          void acquire(field.key === VIDEO_DEVICE_KEY ? next : videoId, field.key === AUDIO_DEVICE_KEY ? next : audioId);
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="">Default {field.label.toLowerCase()}</option>
                      {field.options.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {friendlyDeviceLabel(d, i)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {!previewStream && (
                  <p className="text-sm text-zinc-600 sm:col-span-3">
                    Device names appear after you enable the preview.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Join */}
        <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col items-center gap-2 pb-8">
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={isJoining || leaving}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-sky-500 px-10 py-4 text-base font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98] disabled:opacity-60"
          >
            <VideoCameraIcon size={20} weight="fill" />
            {isJoining || leaving ? "Joining…" : joinError ? "Try again" : resumeProgress ? "Resume interview" : "Join now"}
          </button>
          {!previewStream && !previewError && (
            <p className="text-center text-sm text-zinc-600">
              Checks are optional — you can join directly.
            </p>
          )}
        </div>

        {leaving && (
          <div
            role="status"
            className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0c0e12]/95 backdrop-blur-sm"
          >
            <span
              aria-hidden="true"
              className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-sky-400"
            />
            <p className="text-[15px] font-medium text-zinc-100">Joining your interview…</p>
            <p className="text-sm text-zinc-500">Starting your camera and microphone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
