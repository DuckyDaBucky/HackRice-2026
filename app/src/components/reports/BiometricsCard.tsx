"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retrySessionBiometrics } from "@/app/interview/report-actions";
import type { StoredBiometricAnalysis } from "@/lib/biometrics/persistence";

function describeMetrics(metrics: Record<string, unknown>): string {
  const counts = (metrics.eventCounts ?? {}) as Record<string, number>;
  const readouts =
    (metrics.metricReadouts as number | undefined) ??
    (counts["metrics"] ?? 0) + (counts["accumulated_metrics"] ?? 0);
  const total =
    (metrics.biometricEvents as number | undefined) ??
    Object.values(counts).reduce((a, b) => a + b, 0);
  return `${total} biometric events · ${readouts} metric readouts · SDK ${String(metrics.sdkVersion ?? "?")}`;
}

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

  const completed = analyses.filter((analysis) => analysis.status === "completed");
  const pending = analyses.some((analysis) => analysis.status === "queued" || analysis.status === "processing");
  const failed = analyses.some((analysis) => analysis.status === "retryable_failed" || analysis.status === "terminal_failed");
  const lastError = analyses.find((analysis) => analysis.errorCode)?.errorCode;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-400">Biometric readout (beta)</h2>
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

      {analyses.length === 0 && (
        <p className="text-sm text-zinc-500">
          Biometrics are off for this session or no clips were queued. Enable biometrics when starting a practice
          interview to link delivery signals to each answer below.
        </p>
      )}
      {pending && <p className="text-sm text-zinc-500">Analyzing your recorded clips…</p>}
      {failed && !pending && lastError && (
        <p className="text-sm text-zinc-500">
          Last attempt failed: {lastError === "fetch failed" ? "presage-api isn't reachable from the app." : lastError}
        </p>
      )}
      {completed.length > 0 && (
        <ul className="flex flex-col gap-3">
          {completed.map((analysis, index) => (
            <li key={analysis.id} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-2 font-medium text-zinc-200">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
                Answer {index + 1}
                <span className="font-normal text-zinc-500">· Analyzed</span>
              </span>
              <span className="pl-4 text-xs leading-relaxed text-zinc-500">{describeMetrics(analysis.metrics)}</span>
              <span className="pl-4 text-xs text-zinc-600">
                Feeds the “why” note on this answer&apos;s verdict — biometrics never decide the score on their own.
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
