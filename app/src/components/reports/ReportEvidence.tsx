import { FileTextIcon, VideoCameraIcon } from "@phosphor-icons/react/ssr";
import { ReportPlayback } from "@/components/ReportPlayback";
import type { EvidenceLinkedReport } from "@/lib/interviews/persistence";

export function ReportEvidence({
  sessionId,
  report,
}: {
  sessionId: string;
  report: EvidenceLinkedReport;
}) {
  const observed = report.items.filter((item) => item.coverage === "observed");
  const hasMedia = report.summary.artifactCount > 0 || report.summary.transcriptCount > 0;

  return (
    <section
      aria-labelledby="session-evidence-title"
      className="rounded-xl border border-dash-border bg-dash-surface px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="session-evidence-title" className="text-lg font-semibold tracking-tight text-dash-text">
            Session evidence
          </h2>
          <p className="mt-1 text-sm text-dash-text-muted">Review the recordings and caption evidence saved from this interview.</p>
        </div>
        <p className="text-xs tabular-nums text-dash-text-faint">
          {report.summary.answeredCount} answered · {report.summary.skippedCount} skipped · {report.summary.artifactCount} clips · {report.summary.transcriptCount} captions
        </p>
      </div>

      {!hasMedia ? (
        <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-lg bg-dash-surface-muted px-5 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dash-surface text-dash-text-muted shadow-sm ring-1 ring-dash-border">
            <VideoCameraIcon size={21} weight="regular" />
          </span>
          <p className="mt-3 text-sm font-semibold text-dash-text">No recording or transcript was captured</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-dash-text-muted">
            The session ended before a response was recorded. Complete an answer next time to unlock playback, transcript evidence, and detailed coaching.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-dash-border border-y border-dash-border">
          {observed.map((item) => (
            <article key={item.id} className="py-5 first:pt-4 last:pb-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent-deep">
                  <FileTextIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold capitalize text-dash-text">{item.competency}</h3>
                  <p className="mt-1 text-sm leading-6 text-dash-text-muted">{item.finding}</p>
                  {item.evidenceText && (
                    <blockquote className="mt-3 border-l-2 border-accent/50 pl-3 text-sm italic leading-6 text-dash-text-muted">
                      {item.evidenceText}
                    </blockquote>
                  )}
                  <p className="mt-3 text-sm leading-6 text-dash-text">
                    <span className="font-semibold text-accent-deep">Next practice:</span> {item.nextStep}
                  </p>
                  {item.artifactId && <ReportPlayback sessionId={sessionId} artifactId={item.artifactId} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
