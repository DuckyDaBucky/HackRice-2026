"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { CameraRecorder } from "@/components/CameraRecorder";
import { InterviewLobby } from "@/components/InterviewLobby";
import { useCameraRecorder, type UseCameraRecorder } from "@/hooks/useCameraRecorder";
import { useTextToSpeech, type UseTextToSpeech } from "@/hooks/useTextToSpeech";
import {
  abandonInterviewSession,
  completeInterviewSession,
  getResumeState,
  startInterviewSession,
} from "@/app/interview/actions";
import type { SessionConfig } from "@/lib/sessions";
import { r2Sink } from "@/lib/recording/r2-sink";
import { formatDuration } from "@/lib/recording/format-duration";
import { staticQuestionSource } from "@/lib/questions/static-source";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import type { InterviewMode, Question } from "@/lib/questions/types";

interface AnsweredQuestion {
  question: Question;
  durationMs: number;
  mimeType: string;
  status: "uploaded" | "failed";
  transcript: string;
}

interface GeneratedQuestionResponse {
  question?: unknown;
}

async function generateQuestion(
  mode: InterviewMode,
  questionNumber: number,
  previous: Array<{ question: string; answer: string }>,
  config: SessionConfig,
): Promise<string | null> {
  try {
    const response = await fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        questionNumber,
        previous,
        mood: config.mood,
        customPrompt: config.customPrompt,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as GeneratedQuestionResponse;
    return typeof data.question === "string" && data.question.trim() ? data.question.trim() : null;
  } catch {
    return null;
  }
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
  const [resolved, setResolved] = useState<{
    uploadedQuestionIds: Set<string>;
    config: SessionConfig;
  } | null>(resumeSessionId ? null : { uploadedQuestionIds: new Set(), config: props.setup! });

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      const fallbackQuestions = await staticQuestionSource.getQuestions(mode);
      const setup = props.setup;
      // Existing sessions use their stable question pack so their uploaded
      // attempts remain resumable. Fresh interviews are generated live.
      const openingQuestion = resumeSessionId || !setup
        ? null
        : await generateQuestion(mode, 1, [], setup);
      if (cancelled) return;
      setQuestions(
        openingQuestion && fallbackQuestions[0]
          ? [{ ...fallbackQuestions[0], prompt: openingQuestion }, ...fallbackQuestions.slice(1)]
          : fallbackQuestions,
      );
    };
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [mode, props.setup, resumeSessionId]);

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
    return <LoadingState />;
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
      replaceQuestion={(questionIndex, prompt) => {
        setQuestions((current) =>
          current?.map((question, index) =>
            index === questionIndex ? { ...question, prompt } : question,
          ) ?? current,
        );
      }}
      uploadedQuestionIds={resolved.uploadedQuestionIds}
      config={resolved.config}
      canGenerateQuestions={!resumeSessionId}
      recorder={recorder}
      tts={tts}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
      Loading questions…
    </div>
  );
}

function ActiveInterview({
  mode,
  sessionId,
  questions,
  replaceQuestion,
  uploadedQuestionIds,
  config,
  canGenerateQuestions,
  recorder,
  tts,
}: {
  mode: InterviewMode;
  sessionId: string;
  questions: Question[];
  replaceQuestion: (questionIndex: number, prompt: string) => void;
  uploadedQuestionIds: Set<string>;
  config: SessionConfig;
  canGenerateQuestions: boolean;
  recorder: UseCameraRecorder;
  tts: UseTextToSpeech;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((question) => !uploadedQuestionIds.has(question.id));
    return firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  });
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [done, setDone] = useState(() => uploadedQuestionIds.size >= questions.length);

  useEffect(() => {
    if (recorder.stream) startInterviewSession(sessionId, mode, config).catch(() => {});
  }, [recorder.stream, sessionId, mode, config]);

  const leaveInterview = () => {
    recorder.release();
    tts.stop();
    abandonInterviewSession(sessionId).catch(() => {});
    router.push("/");
  };

  if (done) {
    const totalMs = answers.reduce((sum, answer) => sum + answer.durationMs, 0);
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
          {answers.map((answer, answerIndex) => (
            <li key={answer.question.id} className="flex items-center justify-between gap-4 rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-inset ring-zinc-800">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-500">Question {answerIndex + 1}</span>
                <span className="text-sm text-zinc-200">{answer.question.prompt}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                <span>{formatDuration(answer.durationMs)}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${answer.status === "uploaded" ? "bg-sky-500/10 text-sky-400" : "bg-red-500/10 text-red-400"}`}>
                  {answer.status}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => router.push("/")} className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]">
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
      onAnswerRecorded={async (blob, mimeType, durationMs, transcript) => {
        const artifact = {
          id: crypto.randomUUID(),
          blob,
          mimeType,
          durationMs,
          createdAt: new Date().toISOString(),
        };
        let status: AnsweredQuestion["status"] = "uploaded";
        try {
          await r2Sink.submit(artifact, { sessionId, questionId: currentQuestion.id });
        } catch {
          status = "failed";
        }
        setAnswers((previousAnswers) => [
          ...previousAnswers,
          { question: currentQuestion, durationMs, mimeType, status, transcript },
        ]);

        if (index + 1 >= questions.length) {
          recorder.release();
          tts.stop();
          completeInterviewSession(sessionId).catch(() => {});
          setDone(true);
          return;
        }

        if (canGenerateQuestions) {
          const previous = [
            ...answers.map((answer) => ({
              question: answer.question.prompt,
              answer: answer.transcript,
            })),
            { question: currentQuestion.prompt, answer: transcript },
          ];
          const generatedQuestion = await generateQuestion(mode, index + 2, previous, config);
          if (generatedQuestion) replaceQuestion(index + 1, generatedQuestion);
        }
        setIndex((current) => current + 1);
      }}
    />
  );
}
