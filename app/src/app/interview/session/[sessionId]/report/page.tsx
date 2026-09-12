import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionBiometrics, getSessionReport, getSessionTimelineForReport } from "@/app/interview/report-actions";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import { FindingsPanel, InterviewTimeline } from "@/components/reports/InterviewReportView";
import { BiometricsCard } from "@/components/reports/BiometricsCard";

export default async function InterviewReportPage({
  params,
}: PageProps<"/interview/session/[sessionId]/report">) {
  const { sessionId } = await params;
  const [report, timeline, biometrics] = await Promise.all([
    getSessionReport(sessionId),
    getSessionTimelineForReport(sessionId),
    getSessionBiometrics(sessionId),
  ]);
  if (!timeline) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Interview report</h1>
        </div>
        {(!report || report.status === "failed") && (
          <GenerateReportButton sessionId={sessionId} label={report ? "Retry report" : "Generate report"} />
        )}
      </div>

      {!report && (
        <p className="text-sm text-zinc-500">
          No report has been generated for this session yet. Generating one reads your transcripts and produces
          evidence-linked feedback per competency.
        </p>
      )}
      {report?.status === "pending" && <p className="text-sm text-zinc-500">Generating your report…</p>}
      {report?.status === "failed" && (
        <p className="text-sm text-red-400">The last report attempt failed. You can retry above.</p>
      )}

      {report && report.findings.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400">Findings</h2>
          <FindingsPanel findings={report.findings} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-400">Timeline</h2>
        <InterviewTimeline timeline={timeline} />
      </section>

      <BiometricsCard sessionId={sessionId} analyses={biometrics} />
    </div>
  );
}
