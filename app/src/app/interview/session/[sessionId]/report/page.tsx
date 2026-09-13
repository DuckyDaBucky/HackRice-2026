import { notFound } from "next/navigation";
import Link from "next/link";
import { getReportPageData } from "@/app/interview/report-actions";
import { BiometricsCard } from "@/components/reports/BiometricsCard";
import { GenerateReportButton } from "@/components/reports/GenerateReportButton";
import { InterviewReview } from "@/components/reports/InterviewReview";

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
  const data = await getReportPageData(sessionId);
  if (!data) notFound();
  const { report, review, biometrics } = data;
  const canReview = review.answers.length > 0;
  const needsReview = canReview && (!report || report.status === "failed" || report.usedFallback);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Interview review</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Step through each answer to see where it went wrong, why, and what to say instead. Use ← and → to move
            between answers.
          </p>
        </div>
        {canReview && (
          <GenerateReportButton
            sessionId={sessionId}
            label={needsReview ? (report ? "Retry review" : "Generate review") : "Re-evaluate strictly"}
          />
        )}
      </div>

      {report?.usedFallback && (
        <p
          role="status"
          className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
        >
          {FALLBACK_REASON[report.providerError ?? ""] ?? "The reviewer was unavailable, so these answers weren't reviewed."}{" "}
          Try again in a moment.
        </p>
      )}
      {report?.status === "failed" && (
        <p className="text-sm text-red-400">The last review attempt failed. You can retry above.</p>
      )}
      {!report && canReview && (
        <p className="text-sm text-zinc-500">No review yet. Generate one to get a verdict on every answer.</p>
      )}

      <InterviewReview
        review={review}
        overview={report && !report.usedFallback ? report.overview : report?.overview ?? null}
        sessionId={sessionId}
        aside={<BiometricsCard key="biometrics" sessionId={sessionId} analyses={biometrics} />}
      />
    </div>
  );
}
