"use client";

import { useState } from "react";

const CONTRAST_KEY = "gmh-contrast";
const MOTION_KEY = "gmh-motion";

function read(key: string, onValue: string): boolean {
  try {
    return window.localStorage.getItem(key) === onValue;
  } catch {
    return document.documentElement.hasAttribute(
      key === CONTRAST_KEY ? "data-contrast" : "data-motion",
    );
  }
}

function write(key: string, attr: "data-contrast" | "data-motion", value: string | null) {
  if (value) document.documentElement.setAttribute(attr, value);
  else document.documentElement.removeAttribute(attr);
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Non-fatal; the choice still applies to this load.
  }
}

/** High-contrast viewing for the whole site. Mirrors the ThemeToggle pattern (DOM-first, no hydration fight). */
export function useHighContrast() {
  const [on, setOn] = useState(() => (typeof window === "undefined" ? false : read(CONTRAST_KEY, "high")));
  return {
    on,
    set: (next: boolean) => {
      setOn(next);
      write(CONTRAST_KEY, "data-contrast", next ? "high" : null);
    },
  };
}

/** Manual reduced-motion kill switch for the whole site (independent of the OS setting). */
export function useReducedMotionSetting() {
  const [on, setOn] = useState(() => (typeof window === "undefined" ? false : read(MOTION_KEY, "reduced")));
  return {
    on,
    set: (next: boolean) => {
      setOn(next);
      write(MOTION_KEY, "data-motion", next ? "reduced" : null);
    },
  };
}
