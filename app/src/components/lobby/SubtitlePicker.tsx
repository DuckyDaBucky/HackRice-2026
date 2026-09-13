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
  tone,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  tone: "dark" | "light";
}) {
  return (
    <label
      htmlFor={id}
      className={
        tone === "light"
          ? "flex cursor-pointer items-start gap-3.5 rounded-xl border border-dash-border bg-dash-surface px-4 py-3.5 transition hover:border-dash-border-strong"
          : "flex cursor-pointer items-start gap-3.5 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3.5 transition hover:border-zinc-700"
      }
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={
          tone === "light"
            ? "mt-1 h-4 w-4 shrink-0 rounded border-dash-border-strong bg-dash-surface accent-[#14b8a6]"
            : "mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500/40"
        }
      />
      <span className="min-w-0">
        <span className={tone === "light" ? "block text-sm font-medium text-dash-text" : "block text-sm font-medium text-zinc-100"}>{label}</span>
        <span className={tone === "light" ? "mt-1 block text-sm leading-relaxed text-dash-text-muted" : "mt-1 block text-sm leading-relaxed text-zinc-500"}>{description}</span>
      </span>
    </label>
  );
}

/**
 * Subtitle source toggles plus a size picker when at least one source is on.
 * Neither source enabled is the no-subtitles state for the call UI.
 * Tone "dark" matches the pre-join lobby; "light" matches dashboard surfaces
 * like Settings (same prefs store either way).
 */
export function SubtitlePicker({ tone = "dark" }: { tone?: "dark" | "light" }) {
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
    <section aria-labelledby="subtitle-pick" className={tone === "light"
      ? "rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6"
      : "rounded-2xl border border-zinc-800/90 bg-zinc-900/35 p-5 sm:p-6"}>
      <h2 id="subtitle-pick" className={tone === "light"
        ? "flex items-center gap-2.5 text-[15px] font-medium text-dash-text"
        : "flex items-center gap-2.5 text-[15px] font-medium text-zinc-100"}>
        <ClosedCaptioningIcon size={18} /> Subtitles
      </h2>
      <p className={tone === "light"
        ? "mt-1.5 text-sm leading-relaxed text-dash-text-muted"
        : "mt-1.5 text-sm leading-relaxed text-zinc-500"}>
        Choose what appears on screen during the call. Recording still runs either way.
      </p>

      <div className="mt-5 space-y-3">
        <Toggle
          id="subtitle-interviewee"
          label="Your captions"
          description="Live transcription of what you say."
          checked={intervieweeCaptions}
          onChange={setIntervieweeCaptions}
          tone={tone}
        />
        <Toggle
          id="subtitle-interviewer"
          label="Interviewer questions"
          description="On-screen text for each AI question."
          checked={interviewerCaptions}
          onChange={setInterviewerCaptions}
          tone={tone}
        />
      </div>

      {!captionsEnabled && (
        <p className={tone === "light"
          ? "mt-4 rounded-xl border border-dashed border-dash-border-strong px-4 py-3 text-sm leading-relaxed text-dash-text-muted"
          : "mt-4 rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-500"}>
          No subtitles will appear during the call.
        </p>
      )}

      {captionsEnabled && (
        <>
          <p className={tone === "light"
            ? "mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-dash-text-muted"
            : "mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500"}>Size</p>
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
                    tone === "light"
                      ? selected
                        ? "border-accent bg-dash-nav-active"
                        : "border-dash-border bg-dash-surface hover:border-dash-border-strong"
                      : selected
                        ? "border-sky-400/60 bg-sky-500/10"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  <span aria-hidden="true" className={`font-semibold ${tone === "light" ? "text-dash-text" : "text-zinc-100"} ${option.sampleClass}`}>
                    Aa
                  </span>
                </button>
              );
            })}
          </div>
          <p
            aria-live="polite"
            className={`mt-3 rounded-xl px-4 py-3 leading-relaxed ${tone === "light" ? "bg-dash-solid text-dash-solid-text" : "bg-black/50 text-white"} ${SUBTITLE_SIZE_CLASS[size]}`}
          >
            This is how subtitles will look.
          </p>
        </>
      )}
    </section>
  );
}
