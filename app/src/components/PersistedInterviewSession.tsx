"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // The spoken intro is session-opening state: it plays exactly once, when a
  // brand-new interview starts. Resumes and reloads skip it and go straight
  // to the current question.
  const [introPending, setIntroPending] = useState(initialState.session.status === "planned");
  // True while the final answer's decision/completion runs behind an
  // already-shown done screen (see onAnswerRecorded's optimistic flip).
  const [finishingFinal, setFinishingFinal] = useState(false);
  // Stable identity: CameraRecorder's turn effect must not restart when the
  // parent re-renders (timer ticks every second).
  const handleIntroSpoken = useCallback(() => setIntroPending(false), []);
  const [index, setIndex] = useState(() => {
    // An unanswered follow-up outranks plan status: reopening lands back on
    // the follow-up instead of skipping past it (or "finishing" the session
    // with it unanswered). Without this, a plan flipped to answered on
    // upload-confirm would look done while its follow-up was still pending.
    const pendingFollowUp = initialState.activeFollowUp;
    if (pendingFollowUp) {
      const at = initialState.questions.findIndex(
        (question) => question.id === pendingFollowUp.planQuestionId,
      );
      if (at !== -1) return at;
    }
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

  // Self-heal: every question answered/skipped means finished, even if the
  // explicit completion call never landed (closed tab, failed request). Flip
  // the session to completed so the list stops offering "Resume" for a done
  // interview. Server-side completion is idempotent and reads live status.
  const autoCompletedRef = useRef(false);
  useEffect(() => {
    if (!done || questions.length === 0 || autoCompletedRef.current) return;
    // The optimistic done screen (finishingFinal) is provisional: the agent
    // decision is still in flight and may un-flip back to a follow-up.
    // Completing here would close the session under it, and the follow-up
    // answer would then be rejected (prepare requires in_progress).
    if (finishingFinal) return;
    if (initialState.session.status === "completed") return;
    autoCompletedRef.current = true;
    void completePersistedInterview(initialState.session.id).catch(() => {
      autoCompletedRef.current = false;
    });
  }, [done, finishingFinal, joined, initialState.session.id, initialState.session.status, questions.length]);

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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#0c0e12] px-6 py-12 text-center text-zinc-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 ring-1 ring-inset ring-sky-500/30">
          <CheckCircleIcon size={32} weight="fill" className="text-sky-400" />
        </div>
        <div>
          <p className="text-[13px] font-medium tracking-wide text-sky-400/90">
            {uploadCount} of {questions.length} answered
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Interview complete</h1>
          {finishingFinal ? (
            <p role="status" className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-sky-300">
              Wrapping up your report — this takes a few seconds.
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Your recording and saved caption evidence are ready for review.
            </p>
          )}
        </div>
        {timeBudgetReached && (
          <p role="status" className="max-w-md rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Time budget was reached — the interview closed automatically after your last answer.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/interview/session/${initialState.session.id}/report`)}
            className="rounded-full bg-sky-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.55)] transition hover:bg-sky-400 active:scale-[0.98]"
          >
            Answer review
          </button>
          <button
            type="button"
            onClick={() => router.push(`/interview/session/${initialState.session.id}/report`)}
            className="rounded-full border border-zinc-700 bg-zinc-900/60 px-7 py-3.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.98]"
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
      <div className="relative min-h-[100dvh] bg-[#0c0e12]">
        {joinError && (
          <p className="absolute left-4 right-4 top-4 z-10 mx-auto max-w-xl rounded-2xl border border-red-900/80 bg-red-950/80 px-4 py-3 text-center text-sm text-red-200 backdrop-blur-sm">
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
    <div className="flex min-h-[100dvh] flex-col bg-[#0c0e12]">
      {timeBudgetReached && !done && (
        <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-center text-xs font-medium text-amber-200" role="status">
          Time budget reached — finish this answer and the interview will close automatically.
        </div>
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
      introLine={introPending ? introLine : null}
      onIntroSpoken={handleIntroSpoken}
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

        const decision = await (async () => {
          // If this may be the final answer, swap to the done screen as soon
          // as the recording is durable — the agent decision + completion run
          // behind it instead of holding the call UI open. A follow-up verdict
          // flips back to the question (see below); anything left unfinished
          // self-heals via the done-screen auto-complete on next open.
          const mayBeLast = index + 1 >= questions.length || timeBudgetReached;
          if (mayBeLast) {
            setUploadCount((count) => count + 1);
            setFinishingFinal(true);
            setIndex(questions.length);
          }
          try {
            return await decidePersistedInterviewNextTurn({
              sessionId: stateRef.current.session.id,
              turnId: prepared.turnId,
              planQuestionId: currentQuestion.id,
              transcript,
            });
          } catch (error) {
            // Recording is durable; rethrow for the call UI unless the done
            // screen is already showing (decision will self-heal on next open).
            if (mayBeLast) {
              setFinishingFinal(false);
              return { action: "close_interview", rationale: "coverage_complete" } as const;
            }
            throw error;
          }
        })();

        const nextIndex = index + 1;
        const mayBeLast = index + 1 >= questions.length || timeBudgetReached;
        if (!mayBeLast) setUploadCount((count) => count + 1);
        if (decision.action === "ask_follow_up") {
          // Not done after all — back to the question for the follow-up.
          if (mayBeLast) {
            setFinishingFinal(false);
            setIndex(index);
          }
          setFollowUpPrompt(decision.wording);
          return { followUp: decision.wording };
        }
        setFollowUpPrompt(null);
        if (decision.action === "close_interview" || nextIndex >= questions.length || timeBudgetReached) {
          recorder.release();
          tts.stop();
          await completePersistedInterview(stateRef.current.session.id);
          // Explicitly completed here: keep the done-screen self-heal from
          // firing a redundant second completion (and report run) afterwards.
          autoCompletedRef.current = true;
          if (!mayBeLast) setIndex(nextIndex);
          setFinishingFinal(false);
          return;
        }
        setIndex(nextIndex);
      }}
    />
    </div>
  );
}
