"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ChatCircleDotsIcon, CodeIcon } from "@phosphor-icons/react";
import { VoicePicker } from "@/components/VoicePicker";
import { useVoicePreference } from "@/hooks/useVoicePreference";
import {
  MAX_CUSTOM_PROMPT_LENGTH,
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  MOOD_OPTIONS,
  DEFAULT_MOOD,
  type InterviewMood,
} from "@/lib/interview-config";
import type { InterviewMode } from "@/lib/questions/types";

const TYPE_OPTIONS: { mode: InterviewMode; label: string; icon: typeof CodeIcon }[] = [
  { mode: "technical", label: "Technical", icon: CodeIcon },
  { mode: "behavioral", label: "Behavioral", icon: ChatCircleDotsIcon },
];

const QUESTION_COUNT_OPTIONS = Array.from(
  { length: MAX_QUESTION_COUNT - MIN_QUESTION_COUNT + 1 },
  (_, i) => MIN_QUESTION_COUNT + i,
);

export default function InterviewSetupPage() {
  const router = useRouter();
  const { voiceId, setVoiceId } = useVoicePreference();
  const [mode, setMode] = useState<InterviewMode>("technical");
  const [questionCount, setQuestionCount] = useState(MIN_QUESTION_COUNT);
  const [mood, setMood] = useState<InterviewMood>(DEFAULT_MOOD);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleStart = () => {
    const params = new URLSearchParams({
      count: String(questionCount),
      voice: voiceId,
      mood,
    });
    if (customPrompt.trim()) params.set("prompt", customPrompt.trim());
    router.push(`/interview/${mode}?${params.toString()}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-12 sm:px-10 lg:py-16">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">
          New session
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Set up your practice interview
        </h1>
        <p className="text-base text-zinc-400">
          Choose what you want to practice, then join when you&apos;re ready.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-zinc-300">Interview type</span>
        <div className="grid grid-cols-2 gap-3">
          {TYPE_OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
            <button
              key={optionMode}
              type="button"
              onClick={() => setMode(optionMode)}
              className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
                mode === optionMode
                  ? "border-sky-600 bg-sky-500/10"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              <Icon
                size={20}
                weight="light"
                className={mode === optionMode ? "text-sky-400" : "text-zinc-500"}
              />
              <span
                className={`text-sm font-medium ${mode === optionMode ? "text-zinc-50" : "text-zinc-300"}`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-zinc-300">Number of questions</span>
        <div className="flex gap-2">
          {QUESTION_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setQuestionCount(count)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium transition ${
                questionCount === count
                  ? "border-sky-600 bg-sky-500/10 text-sky-400"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-zinc-300">Interviewer mood</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMood(option.id)}
              className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                mood === option.id
                  ? "border-sky-600 bg-sky-500/10"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
            >
              <span
                className={`text-sm font-medium ${mood === option.id ? "text-zinc-50" : "text-zinc-300"}`}
              >
                {option.label}
              </span>
              <span className="text-xs text-zinc-500">{option.description}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Shapes the interviewer&apos;s voice delivery and live follow-up questions.
        </p>
      </div>

      <VoicePicker voiceId={voiceId} onChange={setVoiceId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="focus-prompt" className="text-sm font-medium text-zinc-300">
          Focus area <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="focus-prompt"
          value={customPrompt}
          onChange={(event) => setCustomPrompt(event.target.value.slice(0, MAX_CUSTOM_PROMPT_LENGTH))}
          placeholder="e.g. Focus on distributed systems tradeoffs, or push harder on ownership stories."
          rows={3}
          className="resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <p className="text-xs text-zinc-500">
          {customPrompt.length}/{MAX_CUSTOM_PROMPT_LENGTH} — shapes live follow-up questions, not
          the core question set.
        </p>
      </div>

      <button
        type="button"
        onClick={handleStart}
        className="flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
      >
        Continue to lobby
        <ArrowRightIcon size={16} />
      </button>
    </div>
  );
}
