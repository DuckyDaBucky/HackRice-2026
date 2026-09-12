"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ResumeUploadButton({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "outline";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleFile(file: File) {
    setStatus("uploading");
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const response = await fetch("/api/resume/upload", {
        method: "POST",
        headers: { "x-file-name": file.name, "Content-Type": "application/octet-stream" },
        body: buffer,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Upload failed.");
      setStatus("idle");
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={status === "uploading"}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex h-9 w-fit items-center rounded-md px-4 text-sm font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          variant === "primary"
            ? "bg-accent font-semibold text-dash-on-accent hover:bg-accent-hover"
            : "border border-dash-border-strong text-dash-text hover:bg-dash-nav-hover"
        }`}
      >
        {status === "uploading" ? "Processing…" : label}
      </button>
      {status === "error" && <p className="max-w-xs text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
