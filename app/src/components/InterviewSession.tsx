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
      <div className="flex h-[100dvh] items-center justify-center bg-[#0c0e12] px-6 text-center text-sm text-zinc-400">
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
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0c0e12] text-zinc-400">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-sky-400" aria-hidden="true" />
      <p className="text-sm">Loading questions…</p>
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
      <div className="flex h-[100dvh] flex-col items-center gap-8 overflow-y-auto bg-[#0c0e12] px-4 py-12 text-zinc-50 sm:py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 ring-1 ring-inset ring-sky-500/30">
            <CheckCircleIcon size={32} weight="fill" className="text-sky-400" />
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Interview complete</h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
            {answers.length} answers uploaded in {formatDuration(totalMs)}. Transcripts below
            were refined from the recordings — fix anything misheard before review.
            Analysis isn&apos;t wired up yet, so no feedback is available for this session.
          </p>
        </div>

        <ul className="flex w-full max-w-xl flex-col gap-3">
          {answers.map((answer, answerIndex) => (
            <li key={answer.question.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Question {answerIndex + 1}</span>
                  <span className="text-[15px] leading-relaxed text-zinc-100">{answer.question.prompt}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                  <span className="tabular-nums">{formatDuration(answer.durationMs)}</span>
                  <span className={`rounded-full px-2.5 py-1 font-medium ${answer.status === "uploaded" ? "bg-sky-500/10 text-sky-300" : "bg-red-500/10 text-red-300"}`}>
                    {answer.status}
                  </span>
                </div>
              </div>
              <label className="flex flex-col gap-2 text-xs font-medium text-zinc-400">
                Transcript (editable)
                <textarea
                  rows={3}
                  value={answer.transcript}
                  onChange={(event) => {
                    const next = event.target.value;
                    setAnswers((previousAnswers) =>
                      previousAnswers.map((previous, previousIndex) =>
                        previousIndex === answerIndex
                          ? { ...previous, transcript: next }
                          : previous,
                      ),
                    );
                  }}
                  className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
                  placeholder="No speech was transcribed for this answer."
                />
              </label>
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => router.push("/")} className="rounded-full bg-sky-500 px-8 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98]">
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
