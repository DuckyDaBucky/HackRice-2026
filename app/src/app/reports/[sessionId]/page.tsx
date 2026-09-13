import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import { ReportPlayback } from "@/components/ReportPlayback";
import { getPersistedInterviewReport } from "@/app/interview/v2-actions";

export default async function InterviewReportPage({ params }: PageProps<"/reports/[sessionId]">) {
  const { sessionId } = await params;
  let report: Awaited<ReturnType<typeof getPersistedInterviewReport>>;
  try {
    report = await getPersistedInterviewReport(sessionId);
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:px-10">
      <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeftIcon size={16} /> Dashboard</Link>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-100">
        <span>Looking for verdicts and what to say instead?</span>
        <Link href={`/interview/session/${sessionId}/report`} className="font-medium underline underline-offset-4 hover:text-white">
          Open answer review (canonical)
        </Link>
      </div>
      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-sky-400">Practice report</span>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Evidence from this interview</h1>
        <p className="max-w-2xl leading-relaxed text-zinc-400">This is a practice report, not a hiring assessment. It only reflects saved question responses and never infers confidence, personality, appearance, or employability.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Report coverage">
        <Metric label="Answered" value={report.summary.answeredCount} />
        <Metric label="Skipped" value={report.summary.skippedCount} />
        <Metric label="Saved clips" value={report.summary.artifactCount} />
        <Metric label="Caption evidence" value={report.summary.transcriptCount} />
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-relaxed text-amber-100">
        <div className="flex items-center gap-2 font-medium"><WarningCircleIcon size={18} /> Transcript coverage note</div>
        <p className="mt-1 text-amber-100/75">Evidence currently uses browser-captured captions. A missing caption means “not enough evidence,” not a weak answer. Final provider transcription is a later enhancement.</p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="evidence-items">
        <h2 id="evidence-items" className="text-lg font-medium text-zinc-100">Question evidence</h2>
        {report.items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-start justify-between gap-4">
              <h3 className="capitalize text-sm font-medium text-zinc-100">{item.competency}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.coverage === "observed" ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{item.coverage === "observed" ? "Evidence saved" : "Insufficient evidence"}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.finding}</p>
            {item.evidenceText && <blockquote className="mt-3 border-l-2 border-sky-500/50 pl-3 text-sm italic leading-relaxed text-zinc-400">{item.evidenceText}</blockquote>}
            <p className="mt-4 text-sm leading-relaxed text-sky-100"><span className="font-medium">Next practice:</span> {item.nextStep}</p>
            {item.artifactId && <ReportPlayback sessionId={sessionId} artifactId={item.artifactId} />}
          </article>
        ))}
      </section>
      <div className="flex items-center gap-2 text-xs text-zinc-500"><CheckCircleIcon size={15} className="text-emerald-400" /> Rubric {report.rubricVersion} · generated from durable session evidence</div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"><div className="text-xl font-semibold tabular-nums text-zinc-50">{value}</div><div className="text-xs text-zinc-500">{label}</div></div>;
}
