"use client";

import { ClosedCaptioningIcon } from "@phosphor-icons/react";
import { SUBTITLE_SIZE_CLASS, useSubtitleSize, type SubtitleSize } from "@/hooks/useSubtitleSize";

const OPTIONS: Array<{ id: SubtitleSize; label: string; sampleClass: string }> = [
  { id: "small", label: "Small subtitles", sampleClass: "text-sm" },
  { id: "medium", label: "Medium subtitles", sampleClass: "text-xl" },
  { id: "large", label: "Large subtitles", sampleClass: "text-3xl" },
];

/**
 * Subtitle size picker. The three choices are told apart by how big the
 * sample glyph renders — never by a visible size word. Saved for the call.
 */
export function SubtitlePicker() {
  const { size, setSize } = useSubtitleSize();

  return (
    <section aria-labelledby="subtitle-pick" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 id="subtitle-pick" className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <ClosedCaptioningIcon size={17} /> Subtitles
      </h2>
      <div role="radiogroup" aria-label="Subtitle size" className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
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
              className={`flex h-16 items-center justify-center rounded-lg border transition active:scale-[0.98] ${
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
      <p aria-live="polite" className={`mt-3 rounded-lg bg-black/50 px-3 py-2 leading-relaxed text-white ${SUBTITLE_SIZE_CLASS[size]}`}>
        This is how subtitles will look.
      </p>
    </section>
  );
}
