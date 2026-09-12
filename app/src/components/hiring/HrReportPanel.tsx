"use client";

import { useEffect, useState, useTransition } from "react";
import { hrGetReport, hrReleaseReport, hrUpdateNotes } from "@/app/hr/actions";

export function HrReportPanel({ sessionId, organizationId }: { sessionId: string; organizationId: string }) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void hrGetReport(organizationId, sessionId).then(setReport).catch(() => setReport(null));
  }, [organizationId, sessionId]);

  if (!report) return <p className="mt-6 text-sm text-zinc-500">Report not available or still processing.</p>;

  const summary = report.summary as { items?: Array<Record<string, unknown>> } | undefined;

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded border border-zinc-800 p-4 text-sm">
        <p><span className="text-zinc-500">Candidate:</span> {String(report.confirmed_name)}</p>
        <p><span className="text-zinc-500">Job:</span> {String(report.job_title)}</p>
        <p><span className="text-zinc-500">Verification:</span> {String(report.verification_status ?? "unknown")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Evidence-backed findings</h2>
        {(summary?.items ?? []).map((item, i) => (
          <div key={i} className="rounded border border-zinc-900 p-3 text-sm">
            <p className="text-zinc-500">{String(item.competency)} · {String(item.coverage)}</p>
            <p className="mt-1">{String(item.finding)}</p>
            {item.rating != null && <p className="mt-1 text-zinc-400">Rating: {String(item.rating)}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Private reviewer notes</h2>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-sm" />
        <button type="button" disabled={pending} onClick={() => startTransition(() => hrUpdateNotes(organizationId, sessionId, notes))} className="rounded border border-zinc-700 px-3 py-1.5 text-sm">
          Save notes
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Release to candidate</h2>
        <div className="flex flex-wrap gap-2">
          {(["summary", "rubric", "perQuestion", "transcript", "recordings"] as const).map((key) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => {
                await hrReleaseReport(organizationId, sessionId, {
                  summary: key === "summary",
                  rubric: key === "rubric",
                  perQuestion: key === "perQuestion",
                  transcript: key === "transcript",
                  recordings: key === "recordings",
                });
              })}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-900"
            >
              Release {key}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
