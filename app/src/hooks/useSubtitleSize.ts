"use client";

import { useState } from "react";

export type SubtitleSize = "small" | "medium" | "large";

/** Caption overlay classes for each size. */
export const SUBTITLE_SIZE_CLASS: Record<SubtitleSize, string> = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

const STORAGE_KEY = "gmh-subtitle-size";

function readStored(): SubtitleSize {
  if (typeof window === "undefined") return "medium";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "small" || value === "medium" || value === "large") return value;
  } catch {
    // Private mode / blocked storage — fall through to default.
  }
  return "medium";
}

/** Persisted subtitle size shared by the lobby picker and caption overlays. */
export function useSubtitleSize() {
  const [size, setSizeState] = useState<SubtitleSize>(readStored);
  const setSize = (next: SubtitleSize) => {
    setSizeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal; the choice still applies to this session.
    }
  };
  return { size, setSize };
}
