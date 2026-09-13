"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retrySessionBiometrics } from "@/app/interview/report-actions";
import type { StoredBiometricAnalysis } from "@/lib/biometrics/persistence";

export function BiometricsCard({
  sessionId,
  analyses,
}: {
  sessionId: string;
  analyses: StoredBiometricAnalysis[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (analyses.length === 0) return null;

  const completed = analyses.filter((analysis) => analysis.status === "completed");
  const pending = analyses.some((analysis) => analysis.status === "queued" || analysis.status === "processing");
  const failed = analyses.some((analysis) => analysis.status === "retryable_failed" || analysis.status === "terminal_failed");
  const lastError = analyses.find((analysis) => analysis.errorCode)?.errorCode;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400">Biometric readout (beta, via presage-api)</h2>
        {failed && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await retrySessionBiometrics(sessionId);
                  router.refresh();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Could not retry biometric analysis.");
                }
              });
            }}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 disabled:opacity-60"
          >
            {isPending ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>
      {pending && <p className="text-sm text-zinc-500">Analyzing your recorded clips…</p>}
      {failed && !pending && lastError && (
        <p className="text-sm text-zinc-500">
          Last attempt failed: {lastError === "fetch failed" ? "presage-api isn't reachable from the app." : lastError}
        </p>
      )}
      {completed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {completed.map((analysis) => {
            const counts = analysis.metrics.eventCounts ?? {};
            const entries = Object.entries(counts);
            const total = entries.reduce((sum, [, n]) => sum + (typeof n === "number" ? n : 0), 0);
            return (
              <li key={analysis.id} className="text-sm text-zinc-300">
                <span className="font-medium text-zinc-100">
                  {total > 0 ? `${total} biometric events` : "Biometric analysis complete"}
                </span>{" "}
                <span className="text-zinc-500">
                  {entries.length > 0
                    ? entries.map(([k, v]) => `${k}: ${v}`).join(" · ")
                    : "heart-rate/breathing summary pending vendor detail"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
