"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retrySessionBiometrics } from "@/app/interview/report-actions";
import { composureSignalsFor, isDemoMetrics } from "@/lib/biometrics/contracts";
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
    <section className="flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-dash-text">Biometric signals</h2>
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
            className="text-xs font-medium text-accent-deep hover:text-accent disabled:opacity-60"
          >
            {isPending ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>

      {analyses.length === 0 && (
        <p className="text-sm leading-6 text-dash-text-muted">
          No recording was captured, so biometric delivery signals are unavailable for this session.
        </p>
      )}
      {pending && <p className="text-sm text-dash-text-muted">Analyzing your recorded clips…</p>}
      {failed && !pending && lastError && (
        <p className="text-sm text-dash-text-muted">
          Last attempt failed: {lastError === "fetch failed" ? "presage-api isn't reachable from the app." : lastError}
        </p>
      )}
      {completed.length > 0 && (
        <ul className="flex flex-col gap-3">
          {completed.map((analysis, index) => {
            const signals = composureSignalsFor(analysis.metrics);
            return (
              <li key={analysis.id} className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-2 font-medium text-dash-text">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
                  Answer {index + 1}
                  <span className="font-normal text-dash-text-faint">· Analyzed</span>
                  {isDemoMetrics(analysis.metrics) && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                      Demo preview — simulated signals
                    </span>
                  )}
                </span>
                {signals.length > 0 ? (
                  <span className="pl-4 text-xs leading-relaxed text-dash-text-muted">
                    Composure: {signals.join(" · ")}.
                  </span>
                ) : (
                  <span className="pl-4 text-xs leading-relaxed text-dash-text-muted">{describeMetrics(analysis.metrics)}</span>
                )}
                <span className="pl-4 text-xs text-dash-text-faint">
                  Delivery observations only — biometrics never decide the score on their own.
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
