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
import { LogoMark } from "@/components/marketing/Logo";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useLiveCaptions } from "@/hooks/useLiveCaptions";
import { SUBTITLE_SIZE_CLASS, useSubtitleSize } from "@/hooks/useSubtitleSize";
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
  const {
    size: subtitleSize,
    intervieweeCaptions,
    interviewerCaptions,
  } = useSubtitleSize();
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
  const [transcriptNotice, setTranscriptNotice] = useState<string | null>(null);
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
    setTranscriptNotice(null);
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
        } else {
          setTranscriptNotice("Batch transcription was unavailable — saved live captions instead (lower accuracy).");
        }
      } catch {
        // Batch correction is best-effort — fall back to live finals.
        setTranscriptNotice("Batch transcription was unavailable — saved live captions instead (lower accuracy).");
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

  const progressPct = totalQuestions > 0 ? Math.min(100, (questionNumber / totalQuestions) * 100) : 0;
  const statusText =
    controlError ??
    transcriptNotice ??
    (saving || finishRequested
      ? refiningTranscript
        ? "Refining transcript…"
        : "Interviewer is reviewing…"
      : recorderState === "paused"
        ? "Interview paused"
        : tts.isSpeaking
          ? "Interviewer is asking…"
          : finishSuggestionVisible
            ? "Finished answering?"
            : isRecording
              ? "Listening…"
              : "Preparing next question…");
  const statusDot = controlError
    ? "bg-red-500"
    : recorderState === "paused"
      ? "bg-amber-400"
      : tts.isSpeaking
        ? "bg-sky-400"
        : isRecording
          ? "bg-red-500 animate-pulse"
          : "bg-zinc-600";

  return (
    <div className="flex h-[100dvh] min-h-[560px] flex-col overflow-hidden bg-[#0c0e12] text-zinc-50">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 bg-[#0c0e12] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={22} />
          <span className="truncate text-sm font-semibold tracking-tight">Practice interview</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-400 md:inline-flex">
            <span className="capitalize">{mode}</span>
            <span aria-hidden="true">·</span>
            <span>
              Question {questionNumber} of {totalQuestions}
            </span>
          </span>
          <span className="hidden rounded-full bg-zinc-900/60 px-3 py-1 font-mono text-xs tabular-nums text-zinc-400 ring-1 ring-inset ring-zinc-800 sm:inline-block">
            <MeetingTimer initialElapsedMs={initialElapsedMs} budgetSeconds={timeBudgetSeconds} paused={recorderState === "paused"} onBudgetReached={onTimeBudgetReached} />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`rounded-full p-2.5 transition ${cameraEnabled ? "text-zinc-300 hover:bg-zinc-800" : "bg-red-500/15 text-red-300"}`}><VideoCameraIcon size={19} weight="fill" /></button>
          <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`rounded-full p-2.5 transition ${micEnabled ? "text-zinc-300 hover:bg-zinc-800" : "bg-red-500/15 text-red-300"}`}><MicrophoneIcon size={19} weight="fill" /></button>
          <button type="button" onClick={onLeave} className="ml-1 flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)] transition hover:bg-red-500 active:scale-[0.98]"><PhoneDisconnectIcon size={16} weight="fill" /> Leave</button>
        </div>
      </header>
      <div className="h-0.5 w-full shrink-0 bg-zinc-900" role="progressbar" aria-valuenow={questionNumber} aria-valuemin={1} aria-valuemax={totalQuestions} aria-label="Interview progress">
        <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto bg-[#0c0e12] p-4 sm:p-5 md:min-h-0 md:overflow-hidden md:grid-cols-2 lg:gap-5">
        <section className="relative min-h-[300px] overflow-hidden rounded-2xl border border-zinc-800/90 bg-black shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] md:min-h-0" aria-label="Your camera">
          {recorder.state === "error" ? (
            <div className="flex h-full min-h-[300px] items-center justify-center px-8 text-center text-sm text-red-200">{recorder.error?.message ?? "Lost the camera connection."}</div>
          ) : (
            <>
              <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity ${cameraEnabled ? "opacity-100" : "opacity-0"}`} />
              {!cameraEnabled && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/60 text-zinc-500"><VideoCameraIcon size={44} weight="light" /><span className="text-xs font-medium">Camera off</span></div>}
              <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">You</span>
              {isRecording && <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"><CircleIcon size={8} weight="fill" className="animate-pulse text-red-400" />REC · <RecordingTimer key={questionNumber} state={recorderState} /></span>}
              {isRecording && intervieweeCaptions && (finalText || interimText) && (
                <div
                  ref={transcriptPanelRef}
                  aria-live="polite"
                  className={`absolute bottom-4 left-4 right-4 max-h-28 overflow-y-auto overscroll-contain rounded-xl bg-black/70 px-4 py-2.5 leading-6 backdrop-blur-sm [scrollbar-color:rgba(255,255,255,0.35)_transparent] ${SUBTITLE_SIZE_CLASS[subtitleSize]}`}
                >
                  <p>
                    {finalText} {interimText && <span className="text-zinc-300">{interimText}</span>}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-6 text-center shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] md:min-h-0" aria-label="Interviewer">
          <div
            className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(56,189,248,0.12),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-[0_16px_48px_-16px_rgba(56,189,248,0.6)] transition-transform duration-300 sm:h-24 sm:w-24 ${tts.isSpeaking ? "scale-105" : ""}`}><RobotIcon size={48} weight="duotone" className="text-zinc-950" /></div>
            <div className="mt-4 flex items-center gap-2 text-[15px] font-medium text-zinc-100">GetMeHired interviewer {tts.isSpeaking && <SpeakerHighIcon size={16} className="animate-pulse text-sky-400" />}</div>
            <p className="mt-1 text-sm text-zinc-500">{tts.isSpeaking ? "Speaking…" : isRecording ? "Listening to your answer" : recorderState === "paused" ? "Paused" : "Preparing…"}</p>
          </div>
          {questionVisible && interviewerCaptions && (
            <div className={`relative mx-auto mt-6 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-left backdrop-blur-sm ${SUBTITLE_SIZE_CLASS[subtitleSize]}`}>
              <div className="mb-2.5 flex items-center justify-between gap-4 text-xs font-medium text-zinc-500"><span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 capitalize text-sky-300">{mode} question</span><span className="tabular-nums">{questionNumber} / {totalQuestions}</span></div>
              <p className="font-medium leading-7 text-zinc-50">{followUp ?? rephrasedQuestion ?? questionPrompt}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="shrink-0 border-t border-zinc-900 bg-[#0c0e12] px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${micEnabled ? "border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800" : "border-red-500/40 bg-red-500/15 text-red-200"}`}><MicrophoneIcon size={19} weight="fill" /></button>
            <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${cameraEnabled ? "border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800" : "border-red-500/40 bg-red-500/15 text-red-200"}`}><VideoCameraIcon size={19} weight="fill" /></button>
            <button type="button" onClick={() => setQuestionVisible((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/60 text-zinc-200 transition hover:bg-zinc-800" aria-label={questionVisible ? "Hide question" : "Show question"} aria-pressed={questionVisible}><EyeSlashIcon size={19} /></button>
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px bg-zinc-800 sm:block" />
          <div aria-live="polite" className="flex min-w-36 items-center justify-center gap-2 text-xs font-medium text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />{statusText}</div>
          {controlError && <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-full border border-amber-400/50 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-400/10">Reload</button>}
          <button type="button" onClick={() => void togglePause()} disabled={saving || tts.isSpeaking || (!isRecording && recorderState !== "paused")} className="h-11 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">{recorderState === "paused" ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => void replayQuestion(followUp ?? rephrasedQuestion ?? questionPrompt)} disabled={!isRecording || saving || tts.isSpeaking} className="h-11 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Repeat</button>
          {onRephrase && <button type="button" onClick={() => void requestRephrase()} disabled={!isRecording || saving || tts.isSpeaking} className="h-11 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Rephrase</button>}
          {onSkip && <button type="button" onClick={() => void requestSkip()} disabled={!isRecording || saving || tts.isSpeaking} className={`h-11 rounded-full border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${skipConfirmationVisible ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"}`}>{skipConfirmationVisible ? "Confirm skip" : "Skip"}</button>}
          <button type="button" onClick={requestFinish} disabled={!isRecording || saving || tts.isSpeaking} className="flex h-11 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"><CheckCircleIcon size={19} weight="fill" />Finish answer</button>
        </div>
      </footer>
    </div>
  );
}
