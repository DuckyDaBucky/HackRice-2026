import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { candidateGetFeedback } from "../../actions";

export default async function CandidateFeedbackPage({
  params,
}: PageProps<"/candidate/feedback/[sessionId]">) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const report = await candidateGetFeedback(sessionId);
  if (!report) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-zinc-300">
        <h1 className="text-xl font-semibold text-zinc-50">Feedback not available</h1>
        <p className="mt-2 text-sm text-zinc-500">Your recruiter has not released any sections yet, or your access has expired.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-zinc-200">
      <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">Your feedback</span>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Interview feedback</h1>
      <pre className="mt-6 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400">
        {JSON.stringify(report, null, 2)}
      </pre>
    </div>
  );
}
