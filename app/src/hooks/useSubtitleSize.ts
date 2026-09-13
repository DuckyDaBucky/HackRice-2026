"use client";

import { useState } from "react";

export type SubtitleSize = "small" | "medium" | "large";

export type SubtitlePrefs = {
  intervieweeCaptions: boolean;
  interviewerCaptions: boolean;
  size: SubtitleSize;
};

/** Caption overlay classes for each size. */
export const SUBTITLE_SIZE_CLASS: Record<SubtitleSize, string> = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

const PREFS_KEY = "gmh-subtitle-prefs";
const LEGACY_SIZE_KEY = "gmh-subtitle-size";

export const DEFAULT_SUBTITLE_PREFS: SubtitlePrefs = {
  intervieweeCaptions: true,
  interviewerCaptions: true,
  size: "medium",
};

const DEFAULT_PREFS = DEFAULT_SUBTITLE_PREFS;

function isSubtitleSize(value: unknown): value is SubtitleSize {
  return value === "small" || value === "medium" || value === "large";
}

/** Parses persisted subtitle prefs for tests and migration helpers. */
export function parseSubtitlePrefs(raw: string | null, legacySize: string | null = null): SubtitlePrefs {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SubtitlePrefs>;
      return {
        intervieweeCaptions: parsed.intervieweeCaptions ?? DEFAULT_PREFS.intervieweeCaptions,
        interviewerCaptions: parsed.interviewerCaptions ?? DEFAULT_PREFS.interviewerCaptions,
        size: isSubtitleSize(parsed.size) ? parsed.size : DEFAULT_PREFS.size,
      };
    } catch {
      return DEFAULT_PREFS;
    }
  }
  if (isSubtitleSize(legacySize)) {
    return { ...DEFAULT_PREFS, size: legacySize };
  }
  return DEFAULT_PREFS;
}

export function subtitlesEnabled(prefs: SubtitlePrefs): boolean {
  return prefs.intervieweeCaptions || prefs.interviewerCaptions;
}

function readStored(): SubtitlePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return parseSubtitlePrefs(
      window.localStorage.getItem(PREFS_KEY),
      window.localStorage.getItem(LEGACY_SIZE_KEY),
    );
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeStored(prefs: SubtitlePrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Non-fatal; the choice still applies to this session.
  }
}

/** Persisted subtitle visibility and size shared by the lobby picker and caption overlays. */
export function useSubtitleSize() {
  const [prefs, setPrefsState] = useState<SubtitlePrefs>(readStored);

  const updatePrefs = (patch: Partial<SubtitlePrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  };

  const setSize = (size: SubtitleSize) => updatePrefs({ size });
  const setIntervieweeCaptions = (intervieweeCaptions: boolean) => updatePrefs({ intervieweeCaptions });
  const setInterviewerCaptions = (interviewerCaptions: boolean) => updatePrefs({ interviewerCaptions });

  const captionsEnabled = prefs.intervieweeCaptions || prefs.interviewerCaptions;

  return {
    ...prefs,
    captionsEnabled,
    setSize,
    setIntervieweeCaptions,
    setInterviewerCaptions,
  };
}
