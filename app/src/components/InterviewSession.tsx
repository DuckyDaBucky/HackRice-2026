"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { CameraRecorder } from "@/components/CameraRecorder";
import { InterviewLobby } from "@/components/InterviewLobby";
import { useCameraRecorder, type UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useTextToSpeech, type UseTextToSpeech } from "@/hooks/useTextToSpeech";
import { r2Sink } from "@/lib/recording/r2-sink";
import { formatDuration } from "@/lib/recording/format-duration";
import { staticQuestionSource } from "@/lib/questions/static-source";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import {
  abandonInterviewSession,
  completeInterviewSession,
  getResumeState,
  startInterviewSession,
} from "@/app/interview/actions";
import type { SessionConfig } from "@/lib/sessions";
import type { InterviewMode, Question } from "@/lib/questions/types";

interface AnsweredQuestion {
  question: Question;
  durationMs: number;
  mimeType: string;
  status: "uploaded" | "failed";
}

type InterviewSessionProps =
  | { mode: InterviewMode; resumeSessionId: string; setup?: undefined }
  | { mode: InterviewMode; resumeSessionId?: undefined; setup: SessionConfig };

export function InterviewSession(props: InterviewSessionProps) {
  const { mode, resumeSessionId } = props;
  const router = useRouter();
  const recorder = useCameraRecorder();
  const tts = useTextToSpeech();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [sessionId] = useState(() => resumeSessionId ?? crypto.randomUUID());
  // null until a fresh setup's implicit "nothing uploaded yet" applies, or the resume fetch resolves.
  const [resolved, setResolved] = useState<{
    uploadedQuestionIds: Set<string>;
    config: SessionConfig;
  } | null>(resumeSessionId ? null : { uploadedQuestionIds: new Set(), config: props.setup });

  useEffect(() => {
    staticQuestionSource.getQuestions(mode).then(setQuestions);
  }, [mode]);

  useEffect(() => {
    if (!resumeSessionId) return;
    getResumeState(resumeSessionId)
      .then((state) => {
        if (!state) {
          router.push("/");
          return;
        }
        setResolved({ uploadedQuestionIds: new Set(state.uploadedQuestionIds), config: state.config });
      })
      .catch(() => router.push("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSessionId]);

  const cleanupRef = useRef({ release: recorder.release, stopSpeech: tts.stop });
  useEffect(() => {
    cleanupRef.current = { release: recorder.release, stopSpeech: tts.stop };
  });
  useEffect(() => {
    return () => {
      cleanupRef.current.release();
      cleanupRef.current.stopSpeech();
    };
  }, []);

  if (!questions || !resolved) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading questions…
      </div>
    );
  }

  const activeQuestions = questions.slice(0, resolved.config.questionCount);

  if (activeQuestions.length === 0) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        No questions are available for this mode yet.
      </div>
    );
  }

  return (
    <ActiveInterview
      mode={mode}
      sessionId={sessionId}
      questions={activeQuestions}
      uploadedQuestionIds={resolved.uploadedQuestionIds}
      config={resolved.config}
      recorder={recorder}
      tts={tts}
    />
  );
}

/** Only mounts once questions and any resume point are known, so the starting index can be a plain lazy initializer instead of an effect-driven setState. */
function ActiveInterview({
  mode,
  sessionId,
  questions,
  uploadedQuestionIds,
  config,
  recorder,
  tts,
}: {
  mode: InterviewMode;
  sessionId: string;
  questions: Question[];
  uploadedQuestionIds: Set<string>;
  config: SessionConfig;
  recorder: UseCameraRecorder;
  tts: UseTextToSpeech;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => !uploadedQuestionIds.has(q.id));
    return firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  });
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [done, setDone] = useState(() => uploadedQuestionIds.size >= questions.length);

  useEffect(() => {
    // The session row is only created once the candidate actually joins (camera granted),
    // not just for loading the lobby — otherwise every visit that bounces off the lobby
    // leaves a permanent zero-progress "Incomplete" entry on the dashboard. Idempotent via
    // ON CONFLICT DO NOTHING, so this is also a safe no-op when resuming an existing row.
    if (recorder.stream) startInterviewSession(sessionId, mode, config).catch(() => {});
  }, [recorder.stream, sessionId, mode, config]);

  const leaveInterview = () => {
    recorder.release();
    tts.stop();
    abandonInterviewSession(sessionId).catch(() => {});
    router.push("/");
  };

  if (done) {
    const totalMs = answers.reduce((sum, a) => sum + a.durationMs, 0);
    return (
      <div className="flex h-[100dvh] flex-col items-center gap-8 overflow-y-auto bg-zinc-950 px-4 py-16 text-zinc-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircleIcon size={40} weight="fill" className="text-sky-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Interview complete</h1>
          <p className="max-w-sm text-sm text-zinc-400">
            {answers.length} answers uploaded in {formatDuration(totalMs)}. Analysis isn&apos;t
            wired up yet, so no feedback is available for this session.
          </p>
        </div>

        <ul className="flex w-full max-w-lg flex-col gap-2">
          {answers.map((answer, i) => (
            <li
              key={answer.question.id}
              className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-inset ring-zinc-800"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-500">Question {i + 1}</span>
                <span className="text-sm text-zinc-200">{answer.question.prompt}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                <span>{formatDuration(answer.durationMs)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    answer.status === "uploaded"
                      ? "bg-sky-500/10 text-sky-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {answer.status}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
        >
          Return home
        </button>
      </div>
    );
  }

  const voiceId = config.voiceId ?? DEFAULT_VOICE_ID;

  if (recorder.stream === null) {
    return (
      <InterviewLobby
        mode={mode}
        recorder={recorder}
        voiceId={voiceId}
        mood={config.mood}
        firstQuestionPrompt={questions[index].prompt}
        tts={tts}
        resumeProgress={
          uploadedQuestionIds.size > 0
            ? { answered: uploadedQuestionIds.size, total: questions.length }
            : undefined
        }
      />
    );
  }

  const currentQuestion = questions[index];

  return (
    <CameraRecorder
      recorder={recorder}
      mode={mode}
      voiceId={voiceId}
      mood={config.mood}
      customPrompt={config.customPrompt}
      tts={tts}
      questionPrompt={currentQuestion.prompt}
      questionNumber={index + 1}
      totalQuestions={questions.length}
      onLeave={leaveInterview}
      onAnswerRecorded={(blob, mimeType, durationMs) => {
        const artifact = {
          id: crypto.randomUUID(),
          blob,
          mimeType,
          durationMs,
          createdAt: new Date().toISOString(),
        };
        r2Sink
          .submit(artifact, { sessionId, questionId: currentQuestion.id })
          .then(() =>
            setAnswers((prev) => [
              ...prev,
              { question: currentQuestion, durationMs, mimeType, status: "uploaded" },
            ]),
          )
          .catch(() =>
            setAnswers((prev) => [
              ...prev,
              { question: currentQuestion, durationMs, mimeType, status: "failed" },
            ]),
          );

        if (index + 1 >= questions.length) {
          recorder.release();
          tts.stop();
          completeInterviewSession(sessionId).catch(() => {});
          setDone(true);
        } else {
          // Advancing to the next question is the event that should speak
          // it — called directly here, not derived from an effect
          // watching questionPrompt after the fact.
          tts.speak(questions[index + 1].prompt, voiceId, config.mood);
          setIndex((prev) => prev + 1);
        }
      }}
    />
  );
}
