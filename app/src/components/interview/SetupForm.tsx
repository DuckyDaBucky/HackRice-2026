"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  "relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const OPTION_SELECTED = "border-accent bg-dash-nav-active ring-1 ring-accent/30";
const OPTION_IDLE = "border-dash-border bg-dash-surface hover:bg-dash-surface-hover";

function SectionHeading({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
        <span className="mr-2 text-accent-deep">{step}</span>
        {title}
      </h2>
      {hint && <span className="text-xs text-dash-text-faint">{hint}</span>}
    </div>
  );
}

export function SetupForm() {
  const router = useRouter();
  const { voiceId, setVoiceId } = useVoicePreference();
  const [contentTypes, setContentTypes] = useState<InterviewContentType[]>(["technical_concepts"]);
  const [timeBudgetSeconds, setTimeBudgetSeconds] = useState<600 | 1200 | 1800>(1200);
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
      router.push(`/interview/session/${data.sessionId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the interview.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">
          Build your practice interview
        </h1>
        <p className="mt-1 text-sm text-dash-text-muted">
          Your interviewer creates a saved plan before you join, so you can safely leave and resume later.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-dash-border bg-dash-surface px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_100%_at_100%_0%,color-mix(in_srgb,var(--color-accent)_10%,transparent),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-3">
          <SectionHeading step="1" title="What role are you practicing for?" />
          <RoleCombobox value={targetRole} onChange={setTargetRole} />
          <p className="text-xs text-dash-text-faint">
            Click the field for popular roles, or start typing to narrow them down — or write your own.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step="2" title="Interview tracks" hint="Choose one or more" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTENT_OPTIONS.map((option) => {
            const selected = contentTypes.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleContentType(option.id)}
                className={`${OPTION_CARD} min-h-24 pr-10 ${selected ? OPTION_SELECTED : OPTION_IDLE}`}
              >
                {selected && <CheckIcon size={17} weight="bold" className="absolute right-4 top-4 text-accent-deep" />}
                <span className="text-sm font-medium text-dash-text">{option.label}</span>
                <span className="text-xs leading-relaxed text-dash-text-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step="3" title="Time available" />
        <div className="grid grid-cols-3 gap-3">
          {TIME_OPTIONS.map((option) => {
            const selected = timeBudgetSeconds === option.seconds;
            return (
              <button
                key={option.seconds}
                type="button"
                aria-pressed={selected}
                onClick={() => setTimeBudgetSeconds(option.seconds)}
                className={`${OPTION_CARD} ${selected ? OPTION_SELECTED : OPTION_IDLE}`}
              >
                <span className="text-sm font-medium text-dash-text">{option.label}</span>
                <span className="text-xs text-dash-text-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step="4" title="Seniority" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SENIORITY_OPTIONS.map((option) => {
            const selected = seniority === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSeniority(option.id)}
                className={`${OPTION_CARD} ${selected ? OPTION_SELECTED : OPTION_IDLE}`}
              >
                <span className="text-sm font-medium text-dash-text">{option.label}</span>
                <span className="text-xs text-dash-text-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step="5" title="Interviewer settings" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MOOD_OPTIONS.map((option) => {
            const selected = mood === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setMood(option.id)}
                className={`${OPTION_CARD} ${selected ? OPTION_SELECTED : OPTION_IDLE}`}
              >
                <span className="text-sm font-medium text-dash-text">{option.label}</span>
              </button>
            );
          })}
        </div>
        <VoicePicker voiceId={voiceId} onChange={setVoiceId} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading step="6" title="Focus & extras" hint="Optional" />
        <label className="flex items-start gap-3 rounded-xl border border-dash-border bg-dash-surface p-4">
          <input
            type="checkbox"
            checked={biometricsEnabled}
            onChange={(event) => setBiometricsEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-dash-border-strong bg-dash-surface accent-[#14b8a6]"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-dash-text">Biometric readout (beta)</span>
            <span className="text-xs leading-relaxed text-dash-text-muted">
              Analyzes your recorded video with presage-api after the session for a heart
              rate/breathing summary on your report. Off by default.
            </span>
          </span>
        </label>
        <label htmlFor="focus-area" className="text-sm font-medium text-dash-text">
          Focus area
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
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={submitting}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-6 text-sm font-semibold text-dash-on-accent transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Creating your interview…" : "Create interview"}
        {!submitting && <ArrowRightIcon size={16} />}
      </button>
    </div>
  );
}
