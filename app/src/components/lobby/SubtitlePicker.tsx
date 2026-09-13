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
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3.5 transition hover:border-zinc-700"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500/40"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-zinc-500">{description}</span>
      </span>
    </label>
  );
}

/**
 * Subtitle source toggles plus a size picker when at least one source is on.
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
    <section aria-labelledby="subtitle-pick" className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5 sm:p-6">
      <h2 id="subtitle-pick" className="flex items-center gap-2.5 text-[15px] font-medium text-zinc-100">
        <ClosedCaptioningIcon size={18} /> Subtitles
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
        Choose what appears on screen during the call. Recording still runs either way.
      </p>

      <div className="mt-5 space-y-3">
        <Toggle
          id="subtitle-interviewee"
          label="Your captions"
          description="Live transcription of what you say."
          checked={intervieweeCaptions}
          onChange={setIntervieweeCaptions}
        />
        <Toggle
          id="subtitle-interviewer"
          label="Interviewer questions"
          description="On-screen text for each AI question."
          checked={interviewerCaptions}
          onChange={setInterviewerCaptions}
        />
      </div>

      {!captionsEnabled && (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-500">
          No subtitles will appear during the call.
        </p>
      )}

      {captionsEnabled && (
        <>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">Size</p>
          <div role="radiogroup" aria-label="Subtitle size" className="mt-2.5 grid grid-cols-3 gap-2.5">
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
                  className={`flex h-14 items-center justify-center rounded-xl border transition active:scale-[0.98] ${
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
            className={`mt-3 rounded-xl bg-black/50 px-4 py-3 leading-relaxed text-white ${SUBTITLE_SIZE_CLASS[size]}`}
          >
            This is how subtitles will look.
          </p>
        </>
      )}
    </section>
  );
}
