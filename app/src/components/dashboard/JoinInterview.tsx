"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinInterview() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const inputId = useId();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-dash-border bg-dash-surface px-4 text-sm font-medium text-dash-text transition-colors duration-150 hover:bg-dash-nav-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Join an interview
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        router.push(`/interview/setup?code=${encodeURIComponent(code.trim())}`);
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor={inputId} className="sr-only">
        Interview code
      </label>
      <input
        id={inputId}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter interview code"
        className="h-9 w-44 rounded-md border border-dash-border-strong bg-dash-surface px-3 text-sm text-dash-text placeholder:text-dash-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md bg-dash-solid px-4 text-sm font-medium text-dash-solid-text transition-opacity duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Join
      </button>
    </form>
  );
}
