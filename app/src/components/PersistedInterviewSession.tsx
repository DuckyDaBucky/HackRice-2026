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
  decidePersistedInterviewNextTurn,
  failPersistedAnswerUpload,
  pausePersistedInterview,
  preparePersistedAnswerUpload,
  rephrasePersistedInterviewQuestion,
  skipPersistedInterviewQuestion,
} from "@/app/interview/v2-actions";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import { buildExitLine, buildIntroLine } from "@/lib/interview-dialog";
import type { V2ResumeState } from "@/lib/interviews/persistence";
import type { InterviewMode, Question } from "@/lib/questions/types";

function legacyModeFor(state: V2ResumeState): InterviewMode {
  return state.config.contentTypes.length === 1 && state.config.contentTypes[0] === "behavioral"
    ? "behavioral"
    : "technical";
}

export function PersistedInterviewSession({ initialState }: { initialState: V2ResumeState }) {
  const router = useRouter();
  const recorder = useCameraRecorder();
  const tts = useTextToSpeech();
  const stateRef = useRef(initialState);
  const cleanupRef = useRef({ release: recorder.release, stop: tts.stop });
  const [joined, setJoined] = useState(initialState.session.status === "in_progress");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(() =>
    initialState.questions.filter((question) => question.status === "answered").length,
  );
  const [timeBudgetReached, setTimeBudgetReached] = useState(
    initialState.session.elapsedActiveMs >= initialState.config.timeBudgetSeconds * 1_000,
  );
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(initialState.activeFollowUp?.wording ?? null);
  const [index, setIndex] = useState(() => {
    const next = initialState.questions.findIndex(
      (question) => question.status !== "answered" && question.status !== "skipped",
    );
    return next === -1 ? initialState.questions.length : next;
  });

  const questions: Question[] = initialState.questions.map((question) => ({
    id: question.id,
    mode: legacyModeFor(initialState),
    prompt: question.prompt,
  }));
  const mode = legacyModeFor(initialState);
  const voiceId = initialState.config.voiceId ?? DEFAULT_VOICE_ID;
  const done = index >= questions.length;
  const introLine = buildIntroLine({
    targetRole: initialState.config.targetRole,
    seniority: initialState.config.seniority,
    timeBudgetSeconds: initialState.config.timeBudgetSeconds,
    questionCount: questions.length,
  });

  // Spoken outro on the completion screen, once per session.
  const exitSpokenRef = useRef(false);
  useEffect(() => {
    if (!done || exitSpokenRef.current) return;
    exitSpokenRef.current = true;
    void tts.speak(
      buildExitLine({
        answeredCount: uploadCount,
        totalQuestions: questions.length,
        timeBudgetSeconds: initialState.config.timeBudgetSeconds,
      }),
      voiceId,
      initialState.config.mood,
    );
  }, [done, initialState.config.mood, initialState.config.timeBudgetSeconds, questions.length, tts, uploadCount, voiceId]);

  useEffect(() => {
    if (!recorder.stream || joined) return;
    let cancelled = false;
    void beginOrResumePersistedInterview(initialState.session.id)
      .then((started) => {
        if (cancelled) return;
        if (!started) {
          recorder.release();
          setJoinError("This interview is no longer available to resume.");
          return;
        }
        setJoined(true);
      })
      .catch(() => {
        if (!cancelled) {
          recorder.release();
          setJoinError("We could not start the interview. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialState.session.id, joined, recorder]);

  useEffect(() => {
    cleanupRef.current = { release: recorder.release, stop: tts.stop };
  });

  useEffect(() => () => {
    cleanupRef.current.release();
    cleanupRef.current.stop();
  }, []);

  const leave = () => {
    recorder.release();
    tts.stop();
    void pausePersistedInterview(initialState.session.id);
    router.push("/");
  };

  if (done) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
        <CheckCircleIcon size={40} weight="fill" className="text-sky-400" />
        <h1 className="text-2xl font-semibold tracking-tight">Interview complete</h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">
          Your recording and saved caption evidence are ready for review.
        </p>
        {timeBudgetReached && (
          <p role="status" className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            Time budget was reached — the interview closed automatically after your last answer.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/interview/session/${initialState.session.id}/report`)}
            className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
          >
            Answer review
          </button>
          <button
            type="button"
            onClick={() => router.push(`/reports/${initialState.session.id}`)}
            className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.98]"
          >
            Evidence
          </button>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!joined || recorder.stream === null) {
    return (
      <div className="relative">
        {joinError && (
          <p className="absolute left-4 right-4 top-4 z-10 rounded-lg bg-red-950/90 px-4 py-3 text-center text-sm text-red-200">
            {joinError}
          </p>
        )}
        <InterviewLobby
          mode={mode}
          recorder={recorder}
          voiceId={voiceId}
          mood={initialState.config.mood}
          resumeProgress={uploadCount > 0 ? { answered: uploadCount, total: questions.length } : undefined}
        />
      </div>
    );
  }

  const currentQuestion = questions[index];
  const currentPrompt = initialState.activeFollowUp?.planQuestionId === currentQuestion.id
    ? (followUpPrompt ?? initialState.activeFollowUp.wording)
    : (followUpPrompt ?? currentQuestion.prompt);
  return (
    <div className="flex flex-col">
      {timeBudgetReached && !done && (
        <p role="status" className="mx-auto mt-4 w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200">
          Time budget reached — finish this answer and the interview will close automatically.
        </p>
      )}
    <CameraRecorder
      recorder={recorder}
      mode={mode}
      voiceId={voiceId}
      mood={initialState.config.mood}
      tts={tts}
      questionPrompt={currentPrompt}
      questionNumber={index + 1}
      totalQuestions={questions.length}
      introLine={introLine}
      onLeave={leave}
      onPauseChange={async (paused) => {
        const changed = paused
          ? await pausePersistedInterview(stateRef.current.session.id)
          : await beginOrResumePersistedInterview(stateRef.current.session.id);
        if (!changed) throw new Error("Interview session could not change state.");
      }}
      initialElapsedMs={initialState.session.elapsedActiveMs}
      timeBudgetSeconds={initialState.config.timeBudgetSeconds}
      onTimeBudgetReached={() => setTimeBudgetReached(true)}
      onSkip={async () => {
        await skipPersistedInterviewQuestion(stateRef.current.session.id, currentQuestion.id);
        const nextIndex = index + 1;
        if (nextIndex >= questions.length || timeBudgetReached) {
          recorder.release();
          tts.stop();
          await completePersistedInterview(stateRef.current.session.id);
        }
        setIndex(nextIndex);
      }}
      onRephrase={() => rephrasePersistedInterviewQuestion(stateRef.current.session.id, currentQuestion.id)}
      onAnswerRecorded={async (blob, mimeType, durationMs, transcript) => {
        const artifactId = crypto.randomUUID();
        let prepared: { key: string; turnId: string; url: string } | null = null;
        try {
          prepared = await preparePersistedAnswerUpload({
            sessionId: stateRef.current.session.id,
            planQuestionId: currentQuestion.id,
            artifactId,
            mimeType,
            transcript,
          });
          const response = await fetch(prepared.url, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: blob,
          });
          if (!response.ok) throw new Error(`Recording upload failed with status ${response.status}.`);
          await confirmPersistedAnswerUpload({
            sessionId: stateRef.current.session.id,
            artifactId,
            turnId: prepared.turnId,
            durationMs,
            transcript,
          });
        } catch (error) {
          if (prepared) {
            await failPersistedAnswerUpload(stateRef.current.session.id, artifactId).catch(() => {});
          }
          throw error;
        }

        const decision = await decidePersistedInterviewNextTurn({
          sessionId: stateRef.current.session.id,
          turnId: prepared.turnId,
          planQuestionId: currentQuestion.id,
          transcript,
        });

        const nextIndex = index + 1;
        setUploadCount((count) => count + 1);
        if (decision.action === "ask_follow_up") {
          setFollowUpPrompt(decision.wording);
          return { followUp: decision.wording };
        }
        setFollowUpPrompt(null);
        if (decision.action === "close_interview" || nextIndex >= questions.length || timeBudgetReached) {
          recorder.release();
          tts.stop();
          await completePersistedInterview(stateRef.current.session.id);
          setIndex(nextIndex);
          return;
        }
        setIndex(nextIndex);
      }}
    />
    </div>
  );
}
