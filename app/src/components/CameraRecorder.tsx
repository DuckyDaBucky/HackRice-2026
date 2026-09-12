"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleIcon,
  PauseIcon,
  PhoneDisconnectIcon,
  PlayIcon,
  RecordIcon,
  SignOutIcon,
  SpeakerHighIcon,
} from "@phosphor-icons/react";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useLiveCaptions } from "@/hooks/useLiveCaptions";
import type { UseTextToSpeech } from "@/hooks/useTextToSpeech";
import { formatDuration } from "@/lib/recording/format-duration";
import { shouldRequestFollowUp } from "@/lib/follow-up/should-request";
import type { InterviewMode } from "@/lib/questions/types";

const FOLLOW_UP_CHECK_INTERVAL_MS = 500;

const MODE_LABEL: Record<InterviewMode, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

/** Keyed by question number at the call site so a new question remounts (and resets) this. */
function RecordingTimer({ state }: { state: UseCameraRecorder["state"] }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = Date.now() - elapsedMs;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
    // Intentionally excludes elapsedMs: re-running this effect every tick
    // would reset startedAt and the timer would never advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return <>{formatDuration(elapsedMs)}</>;
}

interface CameraRecorderProps {
  recorder: UseCameraRecorder;
  mode: InterviewMode;
  voiceId: string;
  tts: UseTextToSpeech;
  questionPrompt: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswerRecorded: (blob: Blob, mimeType: string, durationMs: number) => void;
  onLeave: () => void;
}

export function CameraRecorder({
  recorder,
  mode,
  voiceId,
  tts,
  questionPrompt,
  questionNumber,
  totalQuestions,
  onAnswerRecorded,
  onLeave,
}: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isLastQuestion = questionNumber === totalQuestions;
  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";

  const captions = useLiveCaptions();
  const [followUp, setFollowUp] = useState<string | null>(null);
  const hasRequestedFollowUpRef = useRef(false);

  const stopCaptionsRef = useRef(captions.stop);
  useEffect(() => {
    stopCaptionsRef.current = captions.stop;
  });
  useEffect(() => {
    return () => stopCaptionsRef.current();
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = recorder.stream;
    }
  }, [recorder.stream]);

  // While recording, watch for a natural pause long enough to ask (at most)
  // one live follow-up for this question. See docs/16's analysis-pipeline
  // decision and src/lib/follow-up/should-request.ts for the thresholds.
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      if (hasRequestedFollowUpRef.current) return;
      const msSinceLastFinalSegment = captions.lastFinalAt
        ? Date.now() - captions.lastFinalAt
        : 0;
      if (
        !shouldRequestFollowUp({
          hasFollowUpAlready: hasRequestedFollowUpRef.current,
          msSinceLastFinalSegment,
          transcriptLength: captions.finalText.length,
        })
      ) {
        return;
      }
      hasRequestedFollowUpRef.current = true;
      fetch("/api/interview/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          questionPrompt,
          transcriptSoFar: captions.finalText,
        }),
      })
        .then((res) => res.json())
        .then((data: { followUp: string | null }) => {
          // Speak it the moment it arrives — this fetch resolving is the
          // event, not a state change for a separate effect to react to.
          if (data.followUp) {
            setFollowUp(data.followUp);
            tts.speak(data.followUp, voiceId);
          }
        })
        .catch(() => {
          // No follow-up this time is fine; the interview continues either way.
        });
    }, FOLLOW_UP_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isRecording, mode, questionPrompt, voiceId, captions.finalText, captions.lastFinalAt, tts]);

  const handleStartRecording = () => {
    hasRequestedFollowUpRef.current = false;
    setFollowUp(null);
    captions.start();
    recorder.record();
  };

  const handleStop = async () => {
    captions.stop();
    const artifact = await recorder.stop();
    onAnswerRecorded(artifact.blob, artifact.mimeType, artifact.durationMs);
    if (!isLastQuestion) recorder.reset();
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-sky-400 ring-1 ring-inset ring-zinc-800">
            {MODE_LABEL[mode]}
          </span>
          <span className="text-sm text-zinc-500">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 active:scale-[0.98]"
        >
          <SignOutIcon size={14} />
          Leave interview
        </button>
      </header>

      <div className="flex flex-1 flex-col px-6 pb-6">
        <div className="mb-4 flex h-1 shrink-0 gap-1.5">
          {Array.from({ length: totalQuestions }, (_, i) => (
            <div
              key={i}
              className={`h-full flex-1 rounded-full ${
                i < questionNumber - 1
                  ? "bg-sky-500"
                  : i === questionNumber - 1
                    ? "bg-sky-500/60"
                    : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-inset ring-zinc-800">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-lg font-semibold text-white ${
                tts.isSpeaking ? "ring-4 ring-sky-500/30" : ""
              }`}
            >
              AI
            </div>
            <div className="flex flex-col gap-2">
              <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500">
                AI Interviewer
                {tts.isSpeaking && <SpeakerHighIcon size={12} className="text-sky-400" />}
              </span>
              <p className="text-lg font-medium leading-relaxed text-zinc-100">
                {questionPrompt}
              </p>
              {followUp && (
                <p className="mt-2 text-sm leading-relaxed text-sky-300">
                  Follow-up: {followUp}
                </p>
              )}
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-inset ring-zinc-800">
            {recorder.state === "error" ? (
              <p className="max-w-xs px-6 text-center text-sm text-red-300">
                {recorder.error?.message ?? "Lost the camera connection."}
              </p>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                  You
                </span>
                {(isRecording || isPaused) && (
                  <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                    <CircleIcon
                      size={8}
                      weight="fill"
                      className={isRecording ? "text-red-500 animate-pulse" : "text-zinc-400"}
                    />
                    {isRecording ? "REC" : "PAUSED"}{" "}
                    <RecordingTimer key={questionNumber} state={recorder.state} />
                  </span>
                )}
                {isRecording && (captions.finalText || captions.interimText) && (
                  <p className="absolute bottom-12 left-3 right-3 max-h-20 overflow-hidden rounded-lg bg-black/70 px-3 py-2 text-sm text-white">
                    {captions.finalText}{" "}
                    <span className="text-zinc-400">{captions.interimText}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-3 pb-10">
        {recorder.state === "ready" && (
          <button
            type="button"
            onClick={handleStartRecording}
            className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-medium text-white transition active:scale-[0.98]"
          >
            <RecordIcon size={18} weight="fill" />
            Start recording
          </button>
        )}

        {isRecording && (
          <>
            <button
              type="button"
              onClick={recorder.pause}
              className="flex items-center gap-2 rounded-full bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-100 transition active:scale-[0.98]"
            >
              <PauseIcon size={18} weight="fill" />
              PauseIcon
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
            >
              {isLastQuestion ? <PhoneDisconnectIcon size={18} weight="fill" /> : null}
              {isLastQuestion ? "Finish interview" : "Next question"}
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              type="button"
              onClick={recorder.resume}
              className="flex items-center gap-2 rounded-full bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-100 transition active:scale-[0.98]"
            >
              <PlayIcon size={18} weight="fill" />
              Resume
            </button>
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
            >
              {isLastQuestion ? "Finish interview" : "Next question"}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
