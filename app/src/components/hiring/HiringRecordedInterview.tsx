"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { CameraRecorder } from "@/components/CameraRecorder";
import { InterviewLobby } from "@/components/InterviewLobby";
import { useCameraRecorder } from "@/hooks/useCameraRecorder";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import {
  beginOrResumePersistedInterview,
  completePersistedInterview,
  confirmPersistedAnswerUpload,
  failPersistedAnswerUpload,
  pausePersistedInterview,
  preparePersistedAnswerUpload,
  skipPersistedInterviewQuestion,
} from "@/app/interview/v2-actions";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import type { V2ResumeState } from "@/lib/interviews/persistence";

type QuestionStatus = "not_started" | "draft" | "uploading" | "submitted" | "skipped";

const SUBTITLE_CLASS = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
  "extra-large": "text-xl",
} as const;

export function HiringRecordedInterview({ initialState }: { initialState: V2ResumeState }) {
  const router = useRouter();
  const recorder = useCameraRecorder();
  const tts = useTextToSpeech();
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [subtitleSize, setSubtitleSize] = useState<keyof typeof SUBTITLE_CLASS>("medium");
  const [draftBlob, setDraftBlob] = useState<{ blob: Blob; mimeType: string; durationMs: number; transcript: string } | null>(null);
  const [statuses, setStatuses] = useState<QuestionStatus[]>(() =>
    initialState.questions.map((q) =>
      q.status === "answered" ? "submitted" : q.status === "skipped" ? "skipped" : "not_started",
    ),
  );
  const [uploading, setUploading] = useState(false);
  const sessionId = initialState.session.id;
  const voiceId = initialState.config.voiceId ?? DEFAULT_VOICE_ID;
  const done = index >= initialState.questions.length || initialState.questions.every((_, i) => statuses[i] === "submitted" || statuses[i] === "skipped");

  useEffect(() => {
    if (!recorder.stream || joined) return;
    void beginOrResumePersistedInterview(sessionId).then((started) => {
      if (!started) setJoinError("This interview is no longer available.");
      else setJoined(true);
    });
  }, [recorder.stream, joined, sessionId]);

  if (done) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
        <CheckCircleIcon size={40} weight="fill" className="text-sky-400" />
        <h1 className="text-2xl font-semibold tracking-tight">Interview submitted</h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          Your answers are locked and processing has been queued. You will be notified when feedback is released.
        </p>
      </div>
    );
  }

  if (!joined || !recorder.stream) {
    return (
      <div className="relative">
        {joinError && <p className="absolute inset-x-4 top-4 z-10 rounded-lg bg-red-950/90 px-4 py-3 text-center text-sm text-red-200">{joinError}</p>}
        <InterviewLobby mode="behavioral" recorder={recorder} voiceId={voiceId} mood="neutral" />
      </div>
    );
  }

  const current = initialState.questions[index];
  const currentStatus = statuses[index];

  async function submitDraft() {
    if (!draftBlob || uploading) return;
    setUploading(true);
    setStatuses((s) => s.map((st, i) => (i === index ? "uploading" : st)));
    const artifactId = crypto.randomUUID();
    try {
      const prepared = await preparePersistedAnswerUpload({
        sessionId,
        planQuestionId: current!.id,
        artifactId,
        mimeType: draftBlob.mimeType,
        transcript: draftBlob.transcript,
      });
      const response = await fetch(prepared.url, {
        method: "PUT",
        headers: { "Content-Type": draftBlob.mimeType },
        body: draftBlob.blob,
      });
      if (!response.ok) throw new Error("Upload failed");
      await confirmPersistedAnswerUpload({
        sessionId,
        artifactId,
        turnId: prepared.turnId,
        durationMs: draftBlob.durationMs,
        transcript: draftBlob.transcript,
      });
      setDraftBlob(null);
      setStatuses((s) => s.map((st, i) => (i === index ? "submitted" : st)));
      setIndex((i) => i + 1);
    } catch {
      await failPersistedAnswerUpload(sessionId, artifactId).catch(() => {});
      setStatuses((s) => s.map((st, i) => (i === index ? "draft" : st)));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">Recorded screening</p>
            <p className="text-sm font-medium">Question {index + 1} of {initialState.questions.length}</p>
          </div>
          <select
            value={subtitleSize}
            onChange={(e) => setSubtitleSize(e.target.value as keyof typeof SUBTITLE_CLASS)}
            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
            aria-label="Subtitle size"
          >
            <option value="small">Small subtitles</option>
            <option value="medium">Medium subtitles</option>
            <option value="large">Large subtitles</option>
            <option value="extra-large">Extra-large subtitles</option>
          </select>
        </div>
        <nav className="mx-auto mt-3 flex max-w-4xl gap-2 overflow-x-auto pb-1" aria-label="Question progress">
          {initialState.questions.map((q, i) => {
            const hidden = i > index && statuses[i] === "not_started";
            if (hidden) return null;
            return (
              <button
                key={q.id}
                type="button"
                disabled={statuses[i] === "submitted" || statuses[i] === "skipped"}
                onClick={() => i <= index && setIndex(i)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs ${i === index ? "bg-sky-500/20 text-sky-300" : "bg-zinc-900 text-zinc-500"}`}
              >
                {i + 1} · {statuses[i]?.replace("_", " ")}
              </button>
            );
          })}
        </nav>
      </header>

      <div className={`mx-auto w-full max-w-4xl flex-1 px-4 py-4 ${SUBTITLE_CLASS[subtitleSize]}`}>
        <p className="mb-4 leading-relaxed text-zinc-100" aria-live="polite">{current.prompt}</p>

        {draftBlob && currentStatus !== "submitted" && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setDraftBlob(null)} className="rounded-full border border-zinc-700 px-4 py-2 text-sm">
              Retake
            </button>
            <button type="button" disabled={uploading} onClick={() => void submitDraft()} className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950">
              {uploading ? "Uploading…" : "Submit answer"}
            </button>
          </div>
        )}

        <CameraRecorder
          recorder={recorder}
          mode="behavioral"
          voiceId={voiceId}
          mood="neutral"
          tts={tts}
          questionPrompt={current.prompt}
          questionNumber={index + 1}
          totalQuestions={initialState.questions.length}
          onLeave={() => {
            recorder.release();
            tts.stop();
            void pausePersistedInterview(sessionId);
            router.push("/");
          }}
          onPauseChange={async (paused) => {
            if (paused) await pausePersistedInterview(sessionId);
            else await beginOrResumePersistedInterview(sessionId);
          }}
          initialElapsedMs={initialState.session.elapsedActiveMs}
          timeBudgetSeconds={initialState.config.timeBudgetSeconds}
          onSkip={async () => {
            if (!confirm("Skip this question? You cannot change a skipped answer later.")) return;
            await skipPersistedInterviewQuestion(sessionId, current.id);
            setStatuses((s) => s.map((st, i) => (i === index ? "skipped" : st)));
            setIndex((i) => i + 1);
          }}
          onAnswerRecorded={async (blob, mimeType, durationMs, transcript) => {
            setDraftBlob({ blob, mimeType, durationMs, transcript });
            setStatuses((s) => s.map((st, i) => (i === index ? "draft" : st)));
            return undefined;
          }}
        />
      </div>

      {index === initialState.questions.length - 1 && statuses[index] === "submitted" && (
        <footer className="border-t border-zinc-800 p-4 text-center">
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Submit the full interview? All answers will be locked.")) return;
              recorder.release();
              tts.stop();
              await completePersistedInterview(sessionId);
              setIndex(initialState.questions.length);
            }}
            className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950"
          >
            Finish interview
          </button>
        </footer>
      )}
    </div>
  );
}
