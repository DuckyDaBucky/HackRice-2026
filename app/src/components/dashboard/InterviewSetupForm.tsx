"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { RoleCombobox } from "@/components/RoleCombobox";
import { VoicePicker } from "@/components/VoicePicker";
import { useVoicePreference } from "@/hooks/useVoicePreference";
import {
  MAX_CUSTOM_PROMPT_LENGTH,
  MOOD_OPTIONS,
  DEFAULT_MOOD,
  type InterviewMood,
} from "@/lib/interview-config";
import type { InterviewContentType, Seniority } from "@/lib/interviews/contracts";

const CONTENT_OPTIONS: Array<{ id: InterviewContentType; label: string; description: string }> = [
  { id: "behavioral", label: "Behavioral", description: "Ownership, collaboration, conflict, learning, and outcomes." },
  { id: "technical_concepts", label: "Technical concepts", description: "Technical reasoning, debugging, and tradeoffs." },
  { id: "system_design", label: "System design", description: "Architecture, scale, reliability, and constraints." },
  { id: "code_explanation", label: "Code explanation", description: "Explain and defend a coding approach without a live editor." },
];

const TIME_OPTIONS = [
  { seconds: 180, label: "Blitz ⚡", description: "1 question + follow-up · ~3 min demo" },
  { seconds: 600, label: "10 min", description: "A focused warm-up" },
  { seconds: 1200, label: "20 min", description: "A full practice round" },
  { seconds: 1800, label: "30 min", description: "A deeper interview" },
] as const;

const SENIORITY_OPTIONS: Array<{ id: Seniority; label: string; description: string }> = [
  { id: "junior", label: "Junior", description: "Early-career fundamentals" },
  { id: "mid_level", label: "Mid-level", description: "Ownership and tradeoffs" },
  { id: "senior", label: "Senior", description: "Scope, systems, and leadership" },
];

const OPTION_CARD =
  "flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const OPTION_CARD_SELECTED = "border-accent bg-accent/10";
const OPTION_CARD_UNSELECTED = "border-dash-border bg-dash-surface hover:border-dash-border-strong";
const OPTION_CARD_BLITZ = "border-amber-500/50 bg-amber-500/5 hover:border-amber-500";

export function InterviewSetupForm() {
  return (
    <Suspense fallback={<div className="text-sm text-dash-text-muted">Loading setup…</div>}>
      <SetupFormBody />
    </Suspense>
  );
}

function SetupFormBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("code")?.trim() ?? "";
  const { voiceId, setVoiceId } = useVoicePreference();
  const [contentTypes, setContentTypes] = useState<InterviewContentType[]>(["technical_concepts"]);
  const [timeBudgetSeconds, setTimeBudgetSeconds] = useState<180 | 600 | 1200 | 1800>(1200);
  const [targetRole, setTargetRole] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("junior");
  const [mood, setMood] = useState<InterviewMood>(DEFAULT_MOOD);
  const [focusArea, setFocusArea] = useState("");
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleContentType = (type: InterviewContentType) => {
    setContentTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  };

  const handleStart = async () => {
    if (!targetRole.trim()) {
      setError("Add the role you are practicing for.");
      return;
    }
    if (contentTypes.length === 0) {
      setError("Choose at least one interview track.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentTypes,
          targetRole: targetRole.trim(),
          seniority,
          focusArea: focusArea.trim() || null,
          timeBudgetSeconds,
          voiceId,
          mood,
          biometricsEnabled,
        }),
      });
      const data = await response.json() as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error ?? "Could not create the interview.");
      // Replace (not push): going back from the interview must land on the
      // interviews list, never on this stale form (which would resubmit and
      // create a duplicate session).
      router.replace(`/interview/session/${data.sessionId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the interview.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">New session</span>
        <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">Build your practice interview</h1>
        {inviteCode && (
          <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            Invite code &ldquo;{inviteCode}&rdquo; isn&apos;t redeemable yet — corporate invites haven&apos;t
            landed. Continue below to start a personal practice session instead.
          </p>
        )}
        <p className="max-w-xl text-sm leading-relaxed text-dash-text-muted">
          Choose what you want to practice. Your interviewer creates a saved plan before you join,
          so you can safely leave and resume later.
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="interview-tracks">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="interview-tracks" className="text-sm font-medium text-dash-text">Interview tracks</h2>
          <span className="text-xs text-dash-text-faint">Choose one or more</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTENT_OPTIONS.map((option) => {
            const selected = contentTypes.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleContentType(option.id)}
                className={`relative min-h-28 pr-10 ${OPTION_CARD} ${selected ? OPTION_CARD_SELECTED : OPTION_CARD_UNSELECTED}`}
              >
                {selected && <CheckIcon size={17} weight="bold" className="absolute right-4 top-4 text-accent-deep" />}
                <span className={`text-sm font-medium ${selected ? "text-dash-text" : "text-dash-text-muted"}`}>{option.label}</span>
                <span className="text-xs leading-relaxed text-dash-text-faint">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interview-length">
        <h2 id="interview-length" className="text-sm font-medium text-dash-text">Time available</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TIME_OPTIONS.map((option) => {
            const selected = timeBudgetSeconds === option.seconds;
            const isBlitz = option.seconds === 180;
            return (
              <button
                key={option.seconds}
                type="button"
                onClick={() => setTimeBudgetSeconds(option.seconds)}
                className={`${OPTION_CARD} ${selected ? OPTION_CARD_SELECTED : isBlitz ? OPTION_CARD_BLITZ : OPTION_CARD_UNSELECTED}`}
              >
                <span className={`text-sm font-medium ${selected ? "text-dash-text" : "text-dash-text-muted"}`}>{option.label}</span>
                <span className="text-xs text-dash-text-faint">{option.description}</span>
              </button>
            );
          })}
        </div>
        {timeBudgetSeconds === 180 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-600">
            Blitz demo: one question plus at most one follow-up, about three minutes end to end —
            ideal for showing the full loop on stage.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="interview-context">
        <h2 id="interview-context" className="text-sm font-medium text-dash-text">Interview context</h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="target-role" className="text-sm text-dash-text-muted">Target role</label>
          <RoleCombobox value={targetRole} onChange={setTargetRole} />
          <p className="text-xs text-dash-text-faint">
            Pick a popular role or type your own.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SENIORITY_OPTIONS.map((option) => {
            const selected = seniority === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSeniority(option.id)}
                className={`px-4 py-3 ${OPTION_CARD} ${selected ? OPTION_CARD_SELECTED : OPTION_CARD_UNSELECTED}`}
              >
                <span className={`text-sm font-medium ${selected ? "text-dash-text" : "text-dash-text-muted"}`}>{option.label}</span>
                <span className="text-xs text-dash-text-faint">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interviewer-settings">
        <h2 id="interviewer-settings" className="text-sm font-medium text-dash-text">Interviewer settings</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MOOD_OPTIONS.map((option) => {
            const selected = mood === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setMood(option.id)}
                className={`px-4 py-3 ${OPTION_CARD} ${selected ? OPTION_CARD_SELECTED : OPTION_CARD_UNSELECTED}`}
              >
                <span className={`text-sm font-medium ${selected ? "text-dash-text" : "text-dash-text-muted"}`}>{option.label}</span>
                <span className="text-xs text-dash-text-faint">{option.description}</span>
              </button>
            );
          })}
        </div>
        <VoicePicker voiceId={voiceId} onChange={setVoiceId} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interview-biometrics">
        <h2 id="interview-biometrics" className="text-sm font-medium text-dash-text">Experimental</h2>
        <label className="flex items-start gap-3 rounded-xl border border-dash-border bg-dash-surface p-4">
          <input
            type="checkbox"
            checked={biometricsEnabled}
            onChange={(event) => setBiometricsEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-dash-border-strong bg-dash-surface accent-accent"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-dash-text">Biometric readout (beta)</span>
            <span className="text-xs leading-relaxed text-dash-text-faint">
              Analyzes your recorded video with presage-api after the session for a heart
              rate/breathing summary on your report. Off by default.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-2">
        <label htmlFor="focus-area" className="text-sm font-medium text-dash-text">
          Focus area <span className="font-normal text-dash-text-faint">(optional)</span>
        </label>
        <textarea
          id="focus-area"
          value={focusArea}
          onChange={(event) => setFocusArea(event.target.value.slice(0, MAX_CUSTOM_PROMPT_LENGTH))}
          placeholder="e.g. Distributed systems tradeoffs, ownership stories, or API reliability."
          rows={3}
          className="resize-none rounded-lg border border-dash-border-strong bg-dash-surface px-3 py-2 text-sm text-dash-text outline-none placeholder:text-dash-text-faint focus:border-accent"
        />
        <p className="text-xs text-dash-text-faint">You can adjust this later; it affects only future questions.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/30">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-dash-on-accent transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Creating your interview…" : "Create interview"}
        {!submitting && <ArrowRightIcon size={16} />}
      </button>
    </div>
  );
}
