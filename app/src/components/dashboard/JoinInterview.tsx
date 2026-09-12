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
        className="inline-flex h-9 items-center rounded-md border border-[#e3e7ee] px-4 text-sm font-medium text-[#0b1120] transition-colors hover:bg-[#f4f5f7]"
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
        className="h-9 w-44 rounded-md border border-[#e3e7ee] bg-white px-3 text-sm text-[#0b1120] placeholder:text-[#93a1b5] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md bg-[#0b1120] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Join
      </button>
    </form>
  );
}
