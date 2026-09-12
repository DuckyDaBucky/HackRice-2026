"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";

const STORAGE_KEY = "dashboard-theme";

/**
 * The icon swap is driven purely by the `[data-theme=dark]` CSS selector
 * (both icons always render; CSS decides which is visible) rather than
 * React state — that state would start wrong on the server (no access to
 * localStorage) and have to correct itself after hydration, which is
 * exactly the synchronize-external-state-via-effect pattern React's hooks
 * lint now flags. Reading + writing the DOM attribute directly avoids it.
 */
export function ThemeToggle() {
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
