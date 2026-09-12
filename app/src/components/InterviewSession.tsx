"use client";

import { useEffect, useState } from "react";
import { CameraRecorder } from "@/components/CameraRecorder";
import { inMemorySink } from "@/lib/recording/mock-sink";
import { staticQuestionSource } from "@/lib/questions/static-source";
import type { InterviewMode, Question } from "@/lib/questions/types";

interface AnsweredQuestion {
  question: Question;
  durationMs: number;
  mimeType: string;
  status: "queued" | "failed";
}

export function InterviewSession({ mode }: { mode: InterviewMode }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [done, setDone] = useState(false);

  // sessionId is per-mount for now — sessions aren't persisted yet (see docs/16).
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    staticQuestionSource.getQuestions(mode).then(setQuestions);
  }, [mode]);

  if (!questions) {
    return <p>Loading questions…</p>;
  }

  if (questions.length === 0) {
    return <p>No questions are available for this mode yet.</p>;
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Session complete</h2>
        <p className="text-sm text-zinc-500">
          Each answer was queued for analysis as soon as it was recorded — no
          analyzer is wired up yet, so this just lists what would be sent.
        </p>
        <ul className="flex flex-col gap-2">
          {answers.map((answer) => (
            <li
              key={answer.question.id}
              className="rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700"
            >
              <p className="font-medium">{answer.question.prompt}</p>
              <p className="text-zinc-500">
                {(answer.durationMs / 1000).toFixed(1)}s · {answer.mimeType} · {answer.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const currentQuestion = questions[index];

  return (
    <CameraRecorder
      key={currentQuestion.id}
      questionPrompt={currentQuestion.prompt}
      questionNumber={index + 1}
      totalQuestions={questions.length}
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
        setIndex((prev) => prev + 1);
      }}
      onDone={() => setDone(true)}
    />
  );
}
