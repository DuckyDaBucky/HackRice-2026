"use client";

import { ClosedCaptioningIcon } from "@phosphor-icons/react";
import { SUBTITLE_SIZE_CLASS, useSubtitleSize, type SubtitleSize } from "@/hooks/useSubtitleSize";

const SIZE_OPTIONS: Array<{ id: SubtitleSize; label: string; sampleClass: string }> = [
  { id: "small", label: "Small subtitles", sampleClass: "text-sm" },
  { id: "medium", label: "Medium subtitles", sampleClass: "text-xl" },
  { id: "large", label: "Large subtitles", sampleClass: "text-3xl" },
];

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 transition hover:border-zinc-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500/40"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{description}</span>
      </span>
    </label>
  );
}

/**
 * Subtitle source toggles plus a compact size picker when at least one source is on.
 * Neither source enabled is the no-subtitles state for the call UI.
 */
export function SubtitlePicker() {
  const {
    size,
    setSize,
    intervieweeCaptions,
    interviewerCaptions,
    setIntervieweeCaptions,
    setInterviewerCaptions,
    captionsEnabled,
  } = useSubtitleSize();

  return (
    <section aria-labelledby="subtitle-pick" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 id="subtitle-pick" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <ClosedCaptioningIcon size={17} /> Subtitles
      </h2>

      <div className="mt-3 space-y-2">
        <Toggle
          id="subtitle-interviewee"
          label="Your captions"
          description="Live transcription of what you say during the call."
          checked={intervieweeCaptions}
          onChange={setIntervieweeCaptions}
        />
        <Toggle
          id="subtitle-interviewer"
          label="Interviewer questions"
          description="On-screen text for each question the AI asks."
          checked={interviewerCaptions}
          onChange={setInterviewerCaptions}
        />
      </div>

      {!captionsEnabled && (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-800 px-3 py-2 text-xs leading-relaxed text-zinc-500">
          No subtitles will appear during the call. Recording and transcription still run in the background.
        </p>
      )}

      {captionsEnabled && (
        <>
          <div role="radiogroup" aria-label="Subtitle size" className="mt-3 grid grid-cols-3 gap-2">
            {SIZE_OPTIONS.map((option) => {
              const selected = size === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setSize(option.id)}
                  className={`flex h-12 items-center justify-center rounded-lg border transition active:scale-[0.98] ${
                    selected
                      ? "border-sky-400/60 bg-sky-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  <span aria-hidden="true" className={`font-semibold text-zinc-100 ${option.sampleClass}`}>
                    Aa
                  </span>
                </button>
              );
            })}
          </div>
          <p
            aria-live="polite"
            className={`mt-2 rounded-lg bg-black/50 px-3 py-2 leading-relaxed text-white ${SUBTITLE_SIZE_CLASS[size]}`}
          >
            This is how subtitles will look.
          </p>
        </>
      )}
    </section>
  );
}
