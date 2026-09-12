"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  EyeSlashIcon,
  MicrophoneIcon,
  PhoneDisconnectIcon,
  RobotIcon,
  SpeakerHighIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useLiveCaptions } from "@/hooks/useLiveCaptions";
import type { UseTextToSpeech } from "@/hooks/useTextToSpeech";
import type { InterviewMood } from "@/lib/interview-config";
import { formatDuration } from "@/lib/recording/format-duration";
import type { InterviewMode } from "@/lib/questions/types";
import { reconcileTranscripts } from "@/lib/transcription/reconcile";
import type { TranscribeResponse } from "@/lib/transcription/types";

const FOLLOW_UP_CHECK_INTERVAL_MS = 500;
const ANSWER_SILENCE_MS = 5_000;
const INTER_QUESTION_BUFFER_MS = 2_000;

export interface AnswerRecordedOutcome {
  followUp?: string;
}

function MeetingTimer({
  initialElapsedMs,
  budgetSeconds,
  paused,
  onBudgetReached,
}: {
  initialElapsedMs: number;
  budgetSeconds?: number;
  paused: boolean;
  onBudgetReached?: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);
  const elapsedRef = useRef(initialElapsedMs);
  const activeSinceRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (paused) {
      if (activeSinceRef.current !== null) {
        elapsedRef.current += Date.now() - activeSinceRef.current;
        activeSinceRef.current = null;
        setElapsedMs(elapsedRef.current);
      }
      return;
    }
    if (activeSinceRef.current === null) activeSinceRef.current = Date.now();
    const update = () => {
      const next = elapsedRef.current + (activeSinceRef.current === null ? 0 : Date.now() - activeSinceRef.current);
      setElapsedMs(next);
      if (budgetSeconds && next >= budgetSeconds * 1_000 && !notifiedRef.current) {
        notifiedRef.current = true;
        onBudgetReached?.();
      }
    };
    update();
    const id = window.setInterval(update, 1_000);
    return () => window.clearInterval(id);
  }, [budgetSeconds, onBudgetReached, paused]);

  const isOverBudget = Boolean(budgetSeconds && elapsedMs >= budgetSeconds * 1_000);
  return <span className={isOverBudget ? "text-amber-300" : undefined}>{formatDuration(elapsedMs)}{budgetSeconds ? ` / ${formatDuration(budgetSeconds * 1_000)}` : ""}</span>;
}

function RecordingTimer({ state }: { state: UseCameraRecorder["state"] }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (state !== "recording") return;
    const startedAt = Date.now() - elapsedMs;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
    // A new effect for each tick would reset the elapsed baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return <>{formatDuration(elapsedMs)}</>;
}

interface CameraRecorderProps {
  recorder: UseCameraRecorder;
  mode: InterviewMode;
  voiceId: string;
  mood: InterviewMood;
  tts: UseTextToSpeech;
  questionPrompt: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswerRecorded: (
    blob: Blob,
    mimeType: string,
    durationMs: number,
    transcript: string,
  ) => Promise<AnswerRecordedOutcome | void>;
  onSkip?: () => Promise<void>;
  onRephrase?: () => Promise<string>;
  onPauseChange?: (paused: boolean) => Promise<void> | void;
  initialElapsedMs?: number;
  timeBudgetSeconds?: number;
  onTimeBudgetReached?: () => void;
  onLeave: () => void;
  /** Spoken once before the first question so the session opens like a conversation. */
  introLine?: string | null;
}

export function CameraRecorder({
  recorder,
  mode,
  voiceId,
  mood,
  tts,
  questionPrompt,
  questionNumber,
  totalQuestions,
  onAnswerRecorded,
  onSkip,
  onRephrase,
  onPauseChange,
  initialElapsedMs = 0,
  timeBudgetSeconds,
  onTimeBudgetReached,
  onLeave,
  introLine,
}: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captions = useLiveCaptions();
  const { record, reset, state: recorderState, stop, pause, resume } = recorder;
  const {
    finalText,
    interimText,
    confidence: liveConfidence,
    lastSpeechAt,
    start: startCaptions,
    resume: resumeCaptions,
    stop: stopCaptions,
    correctTranscript,
  } = captions;
  const speak = tts.speak;
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [rephrasedQuestion, setRephrasedQuestion] = useState<string | null>(null);
  const [questionVisible, setQuestionVisible] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishRequested, setFinishRequested] = useState(false);
  const [finishSuggestionVisible, setFinishSuggestionVisible] = useState(false);
  const [skipConfirmationVisible, setSkipConfirmationVisible] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [refiningTranscript, setRefiningTranscript] = useState(false);
  const transcriptPanelRef = useRef<HTMLDivElement | null>(null);
  const currentQuestionRef = useRef<string | null>(null);
  const isRecording = recorderState === "recording";

  const stopCaptionsRef = useRef(captions.stop);
  useEffect(() => {
    stopCaptionsRef.current = stopCaptions;
  });
  useEffect(() => () => stopCaptionsRef.current(), []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  // Keep the newest spoken words visible instead of clipping them below the
  // fixed-height camera overlay. This also handles Chrome's interim text,
  // which updates many times before it becomes final.
  useEffect(() => {
    const panel = transcriptPanelRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [finalText, interimText]);

  const completeAnswer = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    stopCaptions();
    try {
      const artifact = await stop();
      // Live captions are provisional display only — the durable transcript
      // comes from batch-transcribing the recorded blob. Interim segments
      // are excluded here because they are frequently revised or dropped.
      const liveText = finalText.trim();
      let durableText = liveText;
      setRefiningTranscript(true);
      try {
        const form = new FormData();
        form.append(
          "audio",
          new Blob([artifact.blob], { type: artifact.mimeType || "audio/webm" }),
          "answer.webm",
        );
        const response = await fetch("/api/interview/transcribe", {
          method: "POST",
          body: form,
        });
        if (response.ok) {
          const batch = (await response.json()) as Partial<TranscribeResponse>;
          const reconciled = reconcileTranscripts({
            liveText,
            liveConfidence,
            batchText: typeof batch.transcript === "string" ? batch.transcript : null,
            batchConfidence: typeof batch.confidence === "number" ? batch.confidence : null,
            batchProvider: batch.provider ?? null,
          });
          durableText = reconciled.text;
          if (reconciled.source === "batch" && reconciled.text) {
            correctTranscript(reconciled.text);
          }
        }
      } catch {
        // Batch correction is best-effort — fall back to live finals.
      } finally {
        setRefiningTranscript(false);
      }
      const outcome = await onAnswerRecorded(
        artifact.blob,
        artifact.mimeType,
        artifact.durationMs,
        durableText,
      );
      if (outcome?.followUp) setFollowUp(outcome.followUp);
      reset();
      setControlError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not advance the interview.";
      setFinishRequested(false);
      setControlError(
        message === "Sign in to access this interview."
          ? "Your sign-in expired. Sign in again, then reload this interview to continue safely."
          : "We could not finish this turn. Reload this interview to resume from the saved session.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    correctTranscript,
    finalText,
    liveConfidence,
    onAnswerRecorded,
    reset,
    saving,
    stop,
    stopCaptions,
  ]);

  // The interviewer owns the turn: ask the question, then begin capturing
  // only after the prompt has played. There is no candidate "start" action.
  useEffect(() => {
    const questionKey = `${questionNumber}:${questionPrompt}`;
    if (recorderState !== "ready" || currentQuestionRef.current === questionKey) return;
    setFollowUp(null);
    setRephrasedQuestion(null);
    setFinishRequested(false);
    setFinishSuggestionVisible(false);
    setSkipConfirmationVisible(false);
    let cancelled = false;

    const beginAnswer = async () => {
      if (questionNumber > 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, INTER_QUESTION_BUFFER_MS);
        });
      }
      if (cancelled) return;
      // The interviewer opens with a greeting before the first question so
      // the session feels like a conversation, not a recording widget.
      if (questionNumber === 1 && introLine) {
        await speak(introLine, voiceId, mood);
        if (cancelled) return;
      }
      await speak(questionPrompt, voiceId, mood);
      if (cancelled) return;
      currentQuestionRef.current = questionKey;
      startCaptions();
      record();
    };
    void beginAnswer();

    return () => {
      cancelled = true;
    };
  }, [introLine, mood, questionNumber, questionPrompt, record, recorderState, speak, startCaptions, voiceId]);

  // Silence is a gentle prompt, not permission for the interviewer to submit
  // or advance the candidate's answer. The candidate explicitly finishes.
  useEffect(() => {
    if (!isRecording || saving || finishSuggestionVisible || !lastSpeechAt) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastSpeechAt >= ANSWER_SILENCE_MS) setFinishSuggestionVisible(true);
    }, FOLLOW_UP_CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [finalText, finishSuggestionVisible, isRecording, lastSpeechAt, saving]);

  const requestFinish = () => {
    if (!isRecording || saving || tts.isSpeaking) return;
    setFinishSuggestionVisible(false);
    setFinishRequested(true);
    void completeAnswer();
  };

  const requestSkip = async () => {
    if (!onSkip || !isRecording || saving || tts.isSpeaking) return;
    if (!skipConfirmationVisible) {
      setSkipConfirmationVisible(true);
      return;
    }
    setSaving(true);
    try {
      await onSkip();
      stopCaptions();
      await stop();
      reset();
      setControlError(null);
    } catch {
      setControlError("Could not skip this question. Your answer is still recording.");
    } finally {
      setSkipConfirmationVisible(false);
      setSaving(false);
    }
  };

  const replayQuestion = async (text: string) => {
    if (!isRecording || saving || tts.isSpeaking) return;
    pause();
    stopCaptions();
    try {
      await speak(text, voiceId, mood);
      setControlError(null);
    } catch {
      setControlError("The question is visible, but audio could not play.");
    } finally {
      resume();
      resumeCaptions();
    }
  };

  const requestRephrase = async () => {
    if (!onRephrase || !isRecording || saving || tts.isSpeaking) return;
    pause();
    stopCaptions();
    setSaving(true);
    try {
      const wording = await onRephrase();
      setRephrasedQuestion(wording);
      await speak(wording, voiceId, mood);
      setControlError(null);
    } catch {
      setControlError("Could not rephrase right now. The original question is still available.");
    } finally {
      setSaving(false);
      resume();
      resumeCaptions();
    }
  };

  const togglePause = async () => {
    if (saving || tts.isSpeaking) return;
    if (recorderState === "recording") {
      pause();
      stopCaptions();
      try {
        await onPauseChange?.(true);
        setControlError(null);
      } catch {
        resume();
        resumeCaptions();
        setControlError("Could not pause the interview. Please try again.");
      }
      return;
    }
    if (recorderState === "paused") {
      resume();
      resumeCaptions();
      try {
        await onPauseChange?.(false);
        setControlError(null);
      } catch {
        pause();
        stopCaptions();
        setControlError("Could not resume the interview. Please try again.");
      }
    }
  };

  const toggleTrack = (kind: "audio" | "video") => {
    const enabled = kind === "audio" ? !micEnabled : !cameraEnabled;
    const tracks = kind === "audio" ? recorder.stream?.getAudioTracks() : recorder.stream?.getVideoTracks();
    tracks?.forEach((track) => {
      track.enabled = enabled;
    });
    if (kind === "audio") setMicEnabled(enabled);
    else setCameraEnabled(enabled);
  };

  return (
    <div className="flex h-[100dvh] min-h-[600px] flex-col overflow-hidden bg-[#151515] text-[#f5f5f5]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#2d2d2d] px-4 sm:px-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">Practice interview</span>
          <span className="hidden text-zinc-400 sm:inline">
            {mode} · Question {questionNumber} of {totalQuestions}
          </span>
          <span className="font-mono text-xs text-zinc-300"><MeetingTimer initialElapsedMs={initialElapsedMs} budgetSeconds={timeBudgetSeconds} paused={recorderState === "paused"} onBudgetReached={onTimeBudgetReached} /></span>
        </div>
        <div className="flex items-center gap-2 text-zinc-200">
          <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`rounded-md p-2 ${cameraEnabled ? "hover:bg-white/10" : "bg-white/15 text-red-300"}`}><VideoCameraIcon size={20} weight="fill" /></button>
          <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`rounded-md p-2 ${micEnabled ? "hover:bg-white/10" : "bg-white/15 text-red-300"}`}><MicrophoneIcon size={20} weight="fill" /></button>
          <button type="button" onClick={onLeave} className="ml-1 flex items-center gap-2 rounded-md bg-[#c8325c] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#dc3d68]"><PhoneDisconnectIcon size={17} weight="fill" /> Leave</button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-1 bg-[#0b0b0b] p-1 md:grid-cols-2">
        <section className="relative min-h-0 overflow-hidden bg-[#1c1c1c]">
          {recorder.state === "error" ? (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-red-200">{recorder.error?.message ?? "Lost the camera connection."}</div>
          ) : (
            <>
              <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full scale-x-[-1] object-cover transition-opacity ${cameraEnabled ? "opacity-100" : "opacity-0"}`} />
              {!cameraEnabled && <div className="absolute inset-0 flex items-center justify-center text-zinc-500"><VideoCameraIcon size={48} /></div>}
              <span className="absolute bottom-3 left-3 rounded bg-black/65 px-2.5 py-1.5 text-xs font-medium">You</span>
              {isRecording && <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded bg-black/65 px-2.5 py-1.5 text-xs"><CircleIcon size={8} weight="fill" className="animate-pulse text-red-400" />Recording · <RecordingTimer key={questionNumber} state={recorderState} /></span>}
              {isRecording && (finalText || interimText) && (
                <div
                  ref={transcriptPanelRef}
                  aria-live="polite"
                  className="absolute bottom-12 left-3 right-3 max-h-28 overflow-y-auto overscroll-contain rounded-sm bg-black/70 px-3 py-2 text-sm leading-5 text-white shadow-sm [scrollbar-color:rgba(255,255,255,0.35)_transparent]"
                >
                  <p>
                    {finalText} {interimText && <span className="text-zinc-300">{interimText}</span>}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#33385d,transparent_42%),linear-gradient(135deg,#16182a,#0e1018)] p-6 text-center">
          <div className={`flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-sky-400 to-indigo-500 shadow-[0_0_0_10px_rgba(255,255,255,0.05)] transition ${tts.isSpeaking ? "scale-105 shadow-[0_0_0_10px_rgba(255,255,255,0.05),0_0_45px_rgba(95,186,255,0.35)]" : ""}`}><RobotIcon size={60} weight="duotone" className="text-white" /></div>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium">GetMeHired interviewer {tts.isSpeaking && <SpeakerHighIcon size={16} className="animate-pulse text-sky-300" />}</div>
          {questionVisible && <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-[#20222b]/90 p-4 text-left shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-zinc-400"><span className="capitalize">{mode} question</span><span>{questionNumber} / {totalQuestions}</span></div>
            <p className="text-base font-medium leading-6 text-zinc-50 sm:text-lg">{followUp ?? rephrasedQuestion ?? questionPrompt}</p>
          </div>}
        </section>
      </main>

      <footer className="flex h-[92px] shrink-0 items-center justify-start gap-3 overflow-x-auto bg-[#171717] px-4 sm:justify-center">
        <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${micEnabled ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#5d2630] text-red-100"}`}><MicrophoneIcon size={21} weight="fill" /></button>
        <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${cameraEnabled ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#5d2630] text-red-100"}`}><VideoCameraIcon size={21} weight="fill" /></button>
        <div aria-live="polite" className="min-w-32 text-center text-sm text-zinc-300">{controlError ?? (saving || finishRequested ? (refiningTranscript ? "Refining transcript…" : "Interviewer is reviewing…") : recorderState === "paused" ? "Interview paused" : tts.isSpeaking ? "Interviewer is asking…" : finishSuggestionVisible ? "Finished answering?" : isRecording ? "Listening…" : "Preparing next question…")}</div>
        {controlError && <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-full border border-amber-400/50 px-4 text-sm font-medium text-amber-100 transition hover:bg-amber-400/10">Reload</button>}
        <button type="button" onClick={() => void togglePause()} disabled={saving || tts.isSpeaking || (!isRecording && recorderState !== "paused")} className="h-12 rounded-full border border-white/15 px-4 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{recorderState === "paused" ? "Resume" : "Pause"}</button>
        <button type="button" onClick={() => void replayQuestion(followUp ?? rephrasedQuestion ?? questionPrompt)} disabled={!isRecording || saving || tts.isSpeaking} className="h-12 rounded-full border border-white/15 px-4 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Repeat</button>
        {onRephrase && <button type="button" onClick={() => void requestRephrase()} disabled={!isRecording || saving || tts.isSpeaking} className="h-12 rounded-full border border-white/15 px-4 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Rephrase</button>}
        <button type="button" onClick={requestFinish} disabled={!isRecording || saving || tts.isSpeaking} className="flex h-12 items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 text-sm font-medium text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircleIcon size={20} weight="fill" />Finish answer</button>
        {onSkip && <button type="button" onClick={() => void requestSkip()} disabled={!isRecording || saving || tts.isSpeaking} className={`h-12 rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${skipConfirmationVisible ? "border-amber-400/70 bg-amber-400/15 text-amber-100" : "border-white/15 hover:bg-white/10"}`}>{skipConfirmationVisible ? "Confirm skip" : "Skip"}</button>}
        <button type="button" onClick={() => setQuestionVisible((value) => !value)} className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${questionVisible ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#3b3b3b]"}`} aria-label={questionVisible ? "Hide question" : "Show question"}><EyeSlashIcon size={21} /></button>
      </footer>
    </div>
  );
}
