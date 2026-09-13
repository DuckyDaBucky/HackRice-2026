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
        className="w-fit rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-60"
      >
        {isPending ? "Generating…" : label}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
