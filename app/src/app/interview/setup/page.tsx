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

export default function InterviewSetupPage() {
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-12 sm:px-10 lg:py-16">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">New session</span>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Build your practice interview</h1>
        <p className="max-w-xl text-base leading-relaxed text-zinc-400">
          Choose what you want to practice. Your interviewer creates a saved plan before you join,
          so you can safely leave and resume later.
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="interview-tracks">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="interview-tracks" className="text-sm font-medium text-zinc-300">Interview tracks</h2>
          <span className="text-xs text-zinc-500">Choose one or more</span>
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
                className={`relative flex min-h-28 flex-col gap-1 rounded-2xl border p-4 pr-10 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${selected ? "border-sky-600 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
              >
                {selected && <CheckIcon size={17} weight="bold" className="absolute right-4 top-4 text-sky-400" />}
                <span className={`text-sm font-medium ${selected ? "text-zinc-50" : "text-zinc-300"}`}>{option.label}</span>
                <span className="text-xs leading-relaxed text-zinc-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interview-length">
        <h2 id="interview-length" className="text-sm font-medium text-zinc-300">Time available</h2>
        <div className="grid grid-cols-3 gap-3">
          {TIME_OPTIONS.map((option) => {
            const selected = timeBudgetSeconds === option.seconds;
            return (
              <button
                key={option.seconds}
                type="button"
                onClick={() => setTimeBudgetSeconds(option.seconds)}
                className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${selected ? "border-sky-600 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
              >
                <span className={`text-sm font-medium ${selected ? "text-zinc-50" : "text-zinc-300"}`}>{option.label}</span>
                <span className="text-xs text-zinc-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-sky-900/60 bg-sky-500/[0.04] p-5" aria-labelledby="interview-context">
        <div className="flex flex-col gap-1">
          <h2 id="interview-context" className="text-base font-semibold text-zinc-100">What role are you practicing for?</h2>
          <p className="text-sm text-zinc-400">Click the field for popular roles, or start typing to narrow them down — or write your own.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="target-role" className="text-sm font-medium text-zinc-300">Target role</label>
          <RoleCombobox value={targetRole} onChange={setTargetRole} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SENIORITY_OPTIONS.map((option) => {
            const selected = seniority === option.id;
            return (
              <button key={option.id} type="button" onClick={() => setSeniority(option.id)} className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${selected ? "border-sky-600 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}>
                <span className={`text-sm font-medium ${selected ? "text-zinc-50" : "text-zinc-300"}`}>{option.label}</span>
                <span className="text-xs text-zinc-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interviewer-settings">
        <h2 id="interviewer-settings" className="text-sm font-medium text-zinc-300">Interviewer settings</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MOOD_OPTIONS.map((option) => {
            const selected = mood === option.id;
            return (
              <button key={option.id} type="button" onClick={() => setMood(option.id)} className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${selected ? "border-sky-600 bg-sky-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}>
                <span className={`text-sm font-medium ${selected ? "text-zinc-50" : "text-zinc-300"}`}>{option.label}</span>
                <span className="text-xs text-zinc-500">{option.description}</span>
              </button>
            );
          })}
        </div>
        <VoicePicker voiceId={voiceId} onChange={setVoiceId} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="interview-biometrics">
        <h2 id="interview-biometrics" className="text-sm font-medium text-zinc-300">Experimental</h2>
        <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <input
            type="checkbox"
            checked={biometricsEnabled}
            onChange={(event) => setBiometricsEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-sky-500"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-200">Biometric readout (beta)</span>
            <span className="text-xs leading-relaxed text-zinc-500">
              Analyzes your recorded video with presage-api after the session for a heart
              rate/breathing summary on your report. Off by default.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-2">
        <label htmlFor="focus-area" className="text-sm font-medium text-zinc-300">Focus area <span className="font-normal text-zinc-500">(optional)</span></label>
        <textarea id="focus-area" value={focusArea} onChange={(event) => setFocusArea(event.target.value.slice(0, MAX_CUSTOM_PROMPT_LENGTH))} placeholder="e.g. Distributed systems tradeoffs, ownership stories, or API reliability." rows={3} className="resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-600" />
        <p className="text-xs text-zinc-500">You can adjust this later; it affects only future questions.</p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-950/60 px-4 py-3 text-sm text-red-200 ring-1 ring-inset ring-red-900">{error}</p>}

      <button type="button" onClick={handleStart} disabled={submitting} className="flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
        {submitting ? "Creating your interview…" : "Create interview"}
        {!submitting && <ArrowRightIcon size={16} />}
      </button>
    </div>
  );
}
