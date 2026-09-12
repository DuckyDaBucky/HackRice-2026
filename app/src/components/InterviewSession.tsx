"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { CameraRecorder } from "@/components/CameraRecorder";
import { InterviewLobby } from "@/components/InterviewLobby";
import { useCameraRecorder } from "@/hooks/useCameraRecorder";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useVoicePreference } from "@/hooks/useVoicePreference";
import { inMemorySink } from "@/lib/recording/mock-sink";
import { formatDuration } from "@/lib/recording/format-duration";
import { staticQuestionSource } from "@/lib/questions/static-source";
import type { InterviewMode, Question } from "@/lib/questions/types";

interface AnsweredQuestion {
  question: Question;
  durationMs: number;
  mimeType: string;
  status: "queued" | "failed";
}

export function InterviewSession({ mode }: { mode: InterviewMode }) {
  const router = useRouter();
  const recorder = useCameraRecorder();
  const tts = useTextToSpeech();
  const { voiceId, setVoiceId } = useVoicePreference();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [done, setDone] = useState(false);

  // sessionId is per-mount for now — sessions aren't persisted yet (see docs/16).
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    staticQuestionSource.getQuestions(mode).then(setQuestions);
  }, [mode]);

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

  const leaveInterview = () => {
    recorder.release();
    tts.stop();
    router.push("/interview");
  };

  if (!questions) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Loading questions…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        No questions are available for this mode yet.
      </div>
    );
  }

  if (done) {
    const totalMs = answers.reduce((sum, a) => sum + a.durationMs, 0);
    return (
      <div className="flex h-[100dvh] flex-col items-center gap-8 overflow-y-auto bg-zinc-950 px-4 py-16 text-zinc-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircleIcon size={40} weight="fill" className="text-sky-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Interview complete</h1>
          <p className="max-w-sm text-sm text-zinc-400">
            {answers.length} answers recorded in {formatDuration(totalMs)}. Each was queued
            for analysis as soon as it was recorded, no analyzer is wired up yet, so this
            just lists what would have been sent.
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
                    answer.status === "queued"
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

  if (recorder.stream === null) {
    return (
      <InterviewLobby
        mode={mode}
        recorder={recorder}
        voiceId={voiceId}
        onVoiceIdChange={setVoiceId}
        firstQuestionPrompt={questions[0].prompt}
        tts={tts}
      />
    );
  }

  const currentQuestion = questions[index];

  return (
    <CameraRecorder
      recorder={recorder}
      mode={mode}
      voiceId={voiceId}
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
        inMemorySink
          .submit(artifact, { sessionId, questionId: currentQuestion.id })
          .then(() =>
            setAnswers((prev) => [
              ...prev,
              { question: currentQuestion, durationMs, mimeType, status: "queued" },
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
          setDone(true);
        } else {
          // Advancing to the next question is the event that should speak
          // it — called directly here, not derived from an effect
          // watching questionPrompt after the fact.
          tts.speak(questions[index + 1].prompt, voiceId);
          setIndex((prev) => prev + 1);
        }
      }}
    />
  );
}
