"use client";

import { useLayoutEffect } from "react";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";

const STORAGE_KEY = "dashboard-theme";

/**
 * The icon swap is driven purely by the `[data-theme=dark]` CSS selector
 * (both icons always render; CSS decides which is visible) rather than
 * React state. A layout effect restores the persisted DOM attribute during
 * hydration; subsequent toggles update the attribute directly, so there is
 * no server/client state mismatch and no render-time script element.
 */
export function ThemeToggle() {
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch {
      // The pre-paint default remains valid when storage is unavailable.
    }
  }, []);

  function toggle() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this load.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dash-text-muted transition-colors duration-150 hover:bg-dash-nav-hover hover:text-dash-text"
    >
      <MoonIcon size={16} weight="regular" className="[html[data-theme=dark]_&]:hidden" />
      <SunIcon size={16} weight="regular" className="hidden [html[data-theme=dark]_&]:block" />
    </button>
  );
}
