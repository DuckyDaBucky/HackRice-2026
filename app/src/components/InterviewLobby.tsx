"use client";

import { VideoCameraIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { VoicePicker } from "@/components/VoicePicker";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import type { UseTextToSpeech } from "@/hooks/useTextToSpeech";
import type { InterviewMode } from "@/lib/questions/types";

const MODE_LABEL: Record<InterviewMode, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

export function InterviewLobby({
  mode,
  recorder,
  voiceId,
  onVoiceIdChange,
  firstQuestionPrompt,
  tts,
}: {
  mode: InterviewMode;
  recorder: UseCameraRecorder;
  voiceId: string;
  onVoiceIdChange: (id: string) => void;
  firstQuestionPrompt: string;
  tts: UseTextToSpeech;
}) {
  const isRequesting = recorder.state === "requesting-permission";
  const isError = recorder.state === "error";

  const handleJoin = async () => {
    // Join click is the actual event that should trigger the first
    // question's audio — await the real outcome instead of reading
    // recorder.state afterward, which would be a stale closure.
    const stream = await recorder.start();
    if (stream) tts.speak(firstQuestionPrompt, voiceId);
  };

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-4 py-16 text-zinc-50">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-inset ring-zinc-800">
          <VideoCameraIcon size={36} weight="light" className="text-zinc-500" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-sky-400">
            {MODE_LABEL[mode]} practice interview
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ready to join your interview?
          </h1>
        </div>

        <p className="text-sm leading-relaxed text-zinc-400">
          Joining turns on your camera and microphone to record each answer.
          Nothing is analyzed for facial or biometric signals, only the video
          clip itself is captured for later review, and recording stops the
          moment you leave.
        </p>

        {isError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-950/60 px-4 py-3 text-left text-sm text-red-300 ring-1 ring-inset ring-red-900">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" />
            <span>
              {recorder.error?.message ?? "Could not access your camera or microphone."}
            </span>
          </div>
        )}

        <VoicePicker voiceId={voiceId} onChange={onVoiceIdChange} />

        <button
          type="button"
          onClick={handleJoin}
          disabled={isRequesting}
          className="flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
        >
          <VideoCameraIcon size={18} weight="fill" />
          {isRequesting ? "Requesting access…" : isError ? "Try again" : "Join interview"}
        </button>
      </div>
    </div>
  );
}
