"use client";

import { useId, useState } from "react";

// Client-only placeholder: validates and shows a confirmation state, but does
// not persist anywhere yet. Wire this up to a POST /api/waitlist route backed
// by the existing pool in src/lib/db.ts once DATABASE_URL is configured.
export function WaitlistForm({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) {
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <p
        role="status"
        className={`flex items-center gap-2 font-medium text-accent ${
          variant === "compact" ? "text-sm" : "text-base"
        }`}
      >
        <CheckIcon />
        Thanks. We will let you know when practice opens.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@example.com"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? `${inputId}-error` : undefined}
          className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            status === "error" ? "border-red-500" : "border-border"
          }`}
        />
        {status === "error" && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-400">
            Enter a valid email address.
          </p>
        )}
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#03231e] transition-transform duration-150 hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Join the waitlist
      </button>
    </form>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 10.5L8 14.5L16 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
