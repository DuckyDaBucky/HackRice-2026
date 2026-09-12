"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatCircleIcon,
  CircleIcon,
  DotsThreeIcon,
  EyeSlashIcon,
  MicrophoneIcon,
  MonitorArrowUpIcon,
  PhoneDisconnectIcon,
  RobotIcon,
  SpeakerHighIcon,
  UsersThreeIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import type { UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useLiveCaptions } from "@/hooks/useLiveCaptions";
import type { UseTextToSpeech } from "@/hooks/useTextToSpeech";
import type { InterviewMood } from "@/lib/interview-config";
import { formatDuration } from "@/lib/recording/format-duration";
import type { InterviewMode } from "@/lib/questions/types";

const FOLLOW_UP_CHECK_INTERVAL_MS = 500;
const ANSWER_SILENCE_MS = 5_000;
const INTER_QUESTION_BUFFER_MS = 2_000;
const MIN_ANSWER_CHARACTERS = 80;
const MIN_ANSWER_WORDS = 12;
const INSUFFICIENT_ANSWER_PROMPT =
  "Take your time. Could you expand on that with a little more detail?";

function MeetingTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1_000);
    return () => window.clearInterval(id);
  }, []);

  return <>{formatDuration(elapsedMs)}</>;
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
  customPrompt: string | null;
  tts: UseTextToSpeech;
  questionPrompt: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswerRecorded: (
    blob: Blob,
    mimeType: string,
    durationMs: number,
    transcript: string,
  ) => Promise<void>;
  onLeave: () => void;
}

export function CameraRecorder({
  recorder,
  mode,
  voiceId,
  mood,
  customPrompt,
  tts,
  questionPrompt,
  questionNumber,
  totalQuestions,
  onAnswerRecorded,
  onLeave,
}: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captions = useLiveCaptions();
  const { record, reset, state: recorderState, stop } = recorder;
  const { finalText, interimText, lastSpeechAt, start: startCaptions, stop: stopCaptions } = captions;
  const speak = tts.speak;
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [questionVisible, setQuestionVisible] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasRequestedFollowUpRef = useRef(false);
  const currentQuestionRef = useRef<string | null>(null);
  const transcriptLengthBeforeFollowUpRef = useRef(0);
  const turnPendingRef = useRef(false);
  const hasPromptedForMoreRef = useRef(false);
  const isLastQuestion = questionNumber === totalQuestions;
  const isRecording = recorderState === "recording";

  const stopCaptionsRef = useRef(captions.stop);
  useEffect(() => {
    stopCaptionsRef.current = stopCaptions;
  });
  useEffect(() => () => stopCaptionsRef.current(), []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  const completeAnswer = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    stopCaptions();
    try {
      const artifact = await stop();
      await onAnswerRecorded(
        artifact.blob,
        artifact.mimeType,
        artifact.durationMs,
        `${finalText} ${interimText}`.trim(),
      );
      if (!isLastQuestion) reset();
    } finally {
      setSaving(false);
      turnPendingRef.current = false;
    }
  }, [
    finalText,
    interimText,
    isLastQuestion,
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
    hasRequestedFollowUpRef.current = false;
    hasPromptedForMoreRef.current = false;
    transcriptLengthBeforeFollowUpRef.current = 0;
    turnPendingRef.current = false;
    setFollowUp(null);
    let cancelled = false;

    const beginAnswer = async () => {
      if (questionNumber > 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, INTER_QUESTION_BUFFER_MS);
        });
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
  }, [mood, questionNumber, questionPrompt, record, recorderState, speak, startCaptions, voiceId]);

  // A spoken answer must be substantial and naturally paused before the
  // interviewer can move on. Partial responses receive one calm nudge.
  useEffect(() => {
    if (!isRecording || saving || tts.isSpeaking) return;
    const id = window.setInterval(() => {
      if (turnPendingRef.current || tts.isSpeaking) return;
      const transcript = finalText.trim();
      const transcriptLength = transcript.length;
      const wordCount = transcript ? transcript.split(/\s+/).length : 0;
      const hasNewSpeechAfterFollowUp = transcriptLength > transcriptLengthBeforeFollowUpRef.current;
      const hasSubstantiveAnswer =
        transcriptLength >= MIN_ANSWER_CHARACTERS && wordCount >= MIN_ANSWER_WORDS;
      const silenceMs = lastSpeechAt ? Date.now() - lastSpeechAt : 0;
      const answerHasNaturallyPaused =
        hasSubstantiveAnswer && hasNewSpeechAfterFollowUp && silenceMs >= ANSWER_SILENCE_MS;

      if (
        transcriptLength > 0 &&
        !hasSubstantiveAnswer &&
        silenceMs >= ANSWER_SILENCE_MS &&
        !hasPromptedForMoreRef.current
      ) {
        turnPendingRef.current = true;
        hasPromptedForMoreRef.current = true;
        setFollowUp(INSUFFICIENT_ANSWER_PROMPT);
        void speak(INSUFFICIENT_ANSWER_PROMPT, voiceId, mood).finally(() => {
          turnPendingRef.current = false;
        });
        return;
      }

      if (!answerHasNaturallyPaused) return;
      turnPendingRef.current = true;
      if (hasRequestedFollowUpRef.current) {
        void completeAnswer();
        return;
      }

      fetch("/api/interview/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, questionPrompt, transcriptSoFar: finalText, mood, customPrompt }),
      })
        .then((res) => res.json())
        .then(async (data: { followUp: string | null }) => {
          if (!data.followUp) {
            await completeAnswer();
            return;
          }
          hasRequestedFollowUpRef.current = true;
          transcriptLengthBeforeFollowUpRef.current = finalText.trim().length;
          setFollowUp(data.followUp);
          await speak(data.followUp, voiceId, mood);
          turnPendingRef.current = false;
        })
        .catch(() => completeAnswer());
    }, FOLLOW_UP_CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    completeAnswer,
    customPrompt,
    finalText,
    isRecording,
    lastSpeechAt,
    mode,
    mood,
    questionPrompt,
    saving,
    speak,
    tts.isSpeaking,
    voiceId,
  ]);

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
          <span className="font-mono text-xs text-zinc-300"><MeetingTimer /></span>
        </div>
        <div className="flex items-center gap-2 text-zinc-200">
          <button type="button" aria-label="Participants" className="hidden rounded-md p-2 hover:bg-white/10 sm:block"><UsersThreeIcon size={20} /></button>
          <button type="button" aria-label="Chat" className="hidden rounded-md p-2 hover:bg-white/10 sm:block"><ChatCircleIcon size={20} /></button>
          <button type="button" aria-label="More options" className="hidden rounded-md p-2 hover:bg-white/10 sm:block"><DotsThreeIcon size={20} weight="bold" /></button>
          <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`rounded-md p-2 ${cameraEnabled ? "hover:bg-white/10" : "bg-white/15 text-red-300"}`}><VideoCameraIcon size={20} weight="fill" /></button>
          <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`rounded-md p-2 ${micEnabled ? "hover:bg-white/10" : "bg-white/15 text-red-300"}`}><MicrophoneIcon size={20} weight="fill" /></button>
          <button type="button" aria-label="Share screen" className="hidden rounded-md p-2 hover:bg-white/10 md:block"><MonitorArrowUpIcon size={20} weight="fill" /></button>
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
              {isRecording && (finalText || interimText) && <p className="absolute bottom-12 left-3 right-3 max-h-20 overflow-hidden bg-black/70 px-3 py-2 text-sm text-white">{finalText} <span className="text-zinc-300">{interimText}</span></p>}
            </>
          )}
        </section>

        <section className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#33385d,transparent_42%),linear-gradient(135deg,#16182a,#0e1018)] p-6 text-center">
          <div className={`flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-sky-400 to-indigo-500 shadow-[0_0_0_10px_rgba(255,255,255,0.05)] transition ${tts.isSpeaking ? "scale-105 shadow-[0_0_0_10px_rgba(255,255,255,0.05),0_0_45px_rgba(95,186,255,0.35)]" : ""}`}><RobotIcon size={60} weight="duotone" className="text-white" /></div>
          <div className="mt-5 flex items-center gap-2 text-sm font-medium">GetMeHired interviewer {tts.isSpeaking && <SpeakerHighIcon size={16} className="animate-pulse text-sky-300" />}</div>
          {questionVisible && <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-[#20222b]/90 p-4 text-left shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-zinc-400"><span className="capitalize">{mode} question</span><span>{questionNumber} / {totalQuestions}</span></div>
            <p className="text-base font-medium leading-6 text-zinc-50 sm:text-lg">{followUp ?? questionPrompt}</p>
          </div>}
        </section>
      </main>

      <footer className="flex h-[92px] shrink-0 items-center justify-center gap-3 bg-[#171717] px-4">
        <button type="button" onClick={() => toggleTrack("audio")} aria-label="Toggle microphone" className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${micEnabled ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#5d2630] text-red-100"}`}><MicrophoneIcon size={21} weight="fill" /></button>
        <button type="button" onClick={() => toggleTrack("video")} aria-label="Toggle camera" className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${cameraEnabled ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#5d2630] text-red-100"}`}><VideoCameraIcon size={21} weight="fill" /></button>
        <div aria-live="polite" className="min-w-44 text-center text-sm text-zinc-300">{saving ? "Interviewer is moving on…" : tts.isSpeaking ? "Interviewer is asking…" : isRecording ? "Listening…" : "Preparing next question…"}</div>
        <button type="button" onClick={() => setQuestionVisible((value) => !value)} className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/15 ${questionVisible ? "bg-[#2d2d2d] hover:bg-[#3b3b3b]" : "bg-[#3b3b3b]"}`} aria-label={questionVisible ? "Hide question" : "Show question"}><EyeSlashIcon size={21} /></button>
      </footer>
    </div>
  );
}
