"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { generateSessionReport } from "@/app/interview/report-actions";

export function GenerateReportButton({ sessionId, label }: { sessionId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await generateSessionReport(sessionId);
              router.refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not generate the report.");
            }
          });
        }}
        className="inline-flex h-10 w-fit items-center rounded-lg border border-dash-border-strong bg-dash-surface px-4 text-sm font-semibold text-dash-text transition-colors duration-150 hover:bg-dash-surface-muted disabled:opacity-60"
      >
        {isPending ? "Generating…" : label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
