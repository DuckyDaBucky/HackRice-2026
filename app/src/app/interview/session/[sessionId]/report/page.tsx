import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowLeftIcon, ArrowClockwiseIcon } from "@phosphor-icons/react/ssr";
import { getReportPageData } from "@/app/interview/report-actions";
import { BiometricsCard } from "@/components/reports/BiometricsCard";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import { InterviewReview } from "@/components/reports/InterviewReview";
import { ReportEvidence } from "@/components/reports/ReportEvidence";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardShellContext } from "@/lib/dashboard/shell-props";
import { clerkEnabled } from "@/lib/clerk";

const FALLBACK_REASON: Record<string, string> = {
  QUOTA: "The AI reviewer's request quota ran out, so these answers show instant local scores instead.",
  TIMEOUT: "The reviewer took too long to respond, so these answers show instant local scores instead.",
  INVALID_RESPONSE: "The reviewer's response couldn't be read, so these answers show instant local scores instead.",
};

export default async function InterviewReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/interview/session/${sessionId}/report`)}`);

  const [data, shell] = await Promise.all([
    getReportPageData(sessionId),
    getDashboardShellContext(user.id),
  ]);
  if (!data) notFound();
  const { report, review, biometrics, evidence } = data;
  const canReview = review.answers.length > 0;
  const needsReview = canReview && (!report || report.status === "failed" || report.usedFallback);

  return (
    <DashboardShell active="Interviews" firstName={user.firstName} role={shell.role} dashboardView={shell.dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Link
              href="/interviews"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-dash-text-muted transition-colors duration-150 hover:text-dash-text"
            >
              <ArrowLeftIcon size={15} /> Back to interviews
            </Link>
            <h1 className="mt-4 text-[28px] font-semibold tracking-tight text-dash-text">Interview report</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-dash-text-muted">
              Review your score, evidence, and answer-by-answer coaching in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canReview && (
              <GenerateReportButton
                sessionId={sessionId}
                label={needsReview ? (report ? "Retry review" : "Generate review") : "Re-evaluate strictly"}
              />
            )}
            <Link
              href="/interview/setup"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-dash-on-accent transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0"
            >
              <ArrowClockwiseIcon size={16} weight="bold" /> Practice again
            </Link>
          </div>
        </div>

      {report?.usedFallback && (
        <p
          role="status"
          className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700"
        >
          {FALLBACK_REASON[report.providerError ?? ""] ?? "The reviewer was unavailable, so these answers weren't reviewed."}{" "}
          Try again in a moment.
        </p>
      )}
      {report?.status === "failed" && (
        <p className="text-sm text-red-600">The last review attempt failed. You can retry above.</p>
      )}
      {!report && canReview && (
        <p className="text-sm text-dash-text-muted">No review yet. Generate one to get a verdict on every answer.</p>
      )}

      <InterviewReview
        review={review}
        overview={report && !report.usedFallback ? report.overview : report?.overview ?? null}
        sessionId={sessionId}
        evidence={evidence ? <ReportEvidence key="evidence" sessionId={sessionId} report={evidence} /> : null}
        aside={<BiometricsCard key="biometrics" sessionId={sessionId} analyses={biometrics} />}
      />
      </div>
    </DashboardShell>
  );
}
