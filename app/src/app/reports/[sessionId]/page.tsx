import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowLeftIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import { ReportPlayback } from "@/components/ReportPlayback";
import { getPersistedInterviewReport } from "@/app/interview/v2-actions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { clerkEnabled } from "@/lib/clerk";

export default async function InterviewReportPage({ params }: PageProps<"/reports/[sessionId]">) {
  const { sessionId } = await params;
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/reports/${sessionId}`)}`);

  let report: Awaited<ReturnType<typeof getPersistedInterviewReport>>;
  try {
    report = await getPersistedInterviewReport(sessionId);
  } catch {
    notFound();
  }

  return (
    <DashboardShell active="Interviews" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <Link
          href="/interviews"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-dash-text-muted transition-colors duration-150 hover:text-dash-text"
        >
          <ArrowLeftIcon size={15} /> Back to interviews
        </Link>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-dash-text">
          <span>Looking for verdicts and what to say instead?</span>
          <Link
            href={`/interview/session/${sessionId}/report`}
            className="font-medium text-accent-deep underline underline-offset-4 hover:text-accent"
          >
            Open answer review (canonical)
          </Link>
        </div>

        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
            Practice report
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-dash-text">
            Evidence from this interview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dash-text-muted">
            This is a practice report, not a hiring assessment. It only reflects saved question
            responses and never infers confidence, personality, appearance, or employability.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Report coverage">
          <Metric label="Answered" value={report.summary.answeredCount} />
          <Metric label="Skipped" value={report.summary.skippedCount} />
          <Metric label="Saved clips" value={report.summary.artifactCount} />
          <Metric label="Caption evidence" value={report.summary.transcriptCount} />
        </section>

        <section className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-medium text-amber-600">
            <WarningCircleIcon size={18} /> Transcript coverage note
          </div>
          <p className="mt-1 text-dash-text-muted">
            Evidence currently uses browser-captured captions. A missing caption means &ldquo;not
            enough evidence,&rdquo; not a weak answer. Final provider transcription is a later
            enhancement.
          </p>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="evidence-items">
          <h2 id="evidence-items" className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
            Question evidence
          </h2>
          {report.items.map((item) => (
            <article key={item.id} className="rounded-xl border border-dash-border bg-dash-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-sm font-medium capitalize text-dash-text">{item.competency}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.coverage === "observed"
                      ? "bg-dash-success/10 text-dash-success"
                      : "bg-dash-surface-muted text-dash-text-faint"
                  }`}
                >
                  {item.coverage === "observed" ? "Evidence saved" : "Insufficient evidence"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-dash-text-muted">{item.finding}</p>
              {item.evidenceText && (
                <blockquote className="mt-3 border-l-2 border-accent/50 pl-3 text-sm italic leading-relaxed text-dash-text-muted">
                  {item.evidenceText}
                </blockquote>
              )}
              <p className="mt-4 text-sm leading-relaxed text-dash-text">
                <span className="font-medium text-accent-deep">Next practice:</span> {item.nextStep}
              </p>
              {item.artifactId && <ReportPlayback sessionId={sessionId} artifactId={item.artifactId} />}
            </article>
          ))}
        </section>

        <div className="flex items-center gap-2 border-t border-dash-border pt-5 text-xs text-dash-text-faint">
          <CheckCircleIcon size={15} className="text-dash-success" /> Rubric {report.rubricVersion} ·
          generated from durable session evidence
        </div>
      </div>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface px-4 py-3">
      <div className="text-xl font-semibold tabular-nums text-dash-text">{value}</div>
      <div className="text-xs text-dash-text-faint">{label}</div>
    </div>
  );
}
