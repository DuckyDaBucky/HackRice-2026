"use client";

import { useEffect, useRef } from "react";
import { useCameraRecorder } from "@/hooks/useCameraRecorder";

interface CameraRecorderProps {
  questionPrompt: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswerRecorded: (blob: Blob, mimeType: string, durationMs: number) => void;
  onDone: () => void;
}

export function CameraRecorder({
  questionPrompt,
  questionNumber,
  totalQuestions,
  onAnswerRecorded,
  onDone,
}: CameraRecorderProps) {
  const recorder = useCameraRecorder();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isLastQuestion = questionNumber === totalQuestions;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = recorder.stream;
    }
  }, [recorder.stream]);

  const releaseRef = useRef(recorder.release);
  useEffect(() => {
    releaseRef.current = recorder.release;
  });

  useEffect(() => {
    return () => releaseRef.current();
  }, []);

  const handleStop = async () => {
    const artifact = await recorder.stop();
    onAnswerRecorded(artifact.blob, artifact.mimeType, artifact.durationMs);
    if (isLastQuestion) {
      recorder.release();
      onDone();
    } else {
      recorder.reset();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Question {questionNumber} of {totalQuestions}
      </p>
      <p className="text-lg font-medium">{questionPrompt}</p>

      {recorder.state === "idle" && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
          <p>
            This will turn on your camera and microphone to record your answer.
            No biometric or facial analysis is performed — only the video
            clip itself is captured, for later review. Recording stops the
            moment you end the session.
          </p>
          <button
            type="button"
            onClick={() => recorder.start()}
            className="self-start rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Enable camera to begin
          </button>
        </div>
      )}

      {recorder.state === "requesting-permission" && <p>Requesting camera access…</p>}

      {recorder.state === "error" && (
        <p className="text-red-600">
          {recorder.error?.message ?? "Something went wrong accessing the camera."}
        </p>
      )}

      {(recorder.state === "ready" ||
        recorder.state === "recording" ||
        recorder.state === "paused" ||
        recorder.state === "stopped") && (
        <div className="flex flex-col gap-3">
          <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="w-full" />
            {(recorder.state === "recording" || recorder.state === "paused") && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
                <span
                  className={`h-2 w-2 rounded-full bg-red-500 ${recorder.state === "recording" ? "animate-pulse" : ""}`}
                />
                {recorder.state === "recording" ? "Recording" : "Paused"}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {recorder.state === "ready" && (
              <button
                type="button"
                onClick={recorder.record}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Start recording
              </button>
            )}
            {recorder.state === "recording" && (
              <>
                <button
                  type="button"
                  onClick={recorder.pause}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  {isLastQuestion ? "Finish" : "Next question"}
                </button>
              </>
            )}
            {recorder.state === "paused" && (
              <>
                <button
                  type="button"
                  onClick={recorder.resume}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  {isLastQuestion ? "Finish" : "Next question"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
