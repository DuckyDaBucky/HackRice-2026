import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { listRecentSessions } from "@/lib/sessions";
import { countUploadedAttemptsBySession } from "@/lib/answer-attempts";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { MOOD_OPTIONS } from "@/lib/interview-config";
import type { SessionRecord } from "@/lib/sessions";

const MODE_LABEL: Record<SessionRecord["mode"], string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

const MOOD_LABEL: Record<string, string> = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.id, option.label]),
);

const STATUS_LABEL: Record<SessionRecord["status"], string> = {
  completed: "Completed",
  in_progress: "Incomplete",
  abandoned: "Abandoned",
};

const STATUS_STYLE: Record<SessionRecord["status"], string> = {
  completed: "bg-[#e9f6f1] text-[#0f9d78]",
  in_progress: "bg-amber-50 text-amber-600",
  abandoned: "bg-[#f4f5f7] text-[#93a1b5]",
};

function actionFor(session: SessionRecord): { label: string; href: string } {
  if (session.status === "in_progress") {
    return { label: "Resume", href: `/interview/${session.mode}?session=${session.id}` };
  }
  return { label: "Practice again", href: "/interview/setup" };
}

export default async function InterviewsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Finterviews");

  const sessions = await listRecentSessions(user.id, 50);
  const answeredCounts = await countUploadedAttemptsBySession(sessions.map((s) => s.id));

  return (
    <DashboardShell active="Interviews" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1120] sm:text-3xl">
            Your interviews
          </h1>
          <p className="text-sm text-[#5b6474]">Every practice session, in one place.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e3e7ee] bg-white px-6 py-14 text-center">
            <ClockCounterClockwiseIcon size={28} weight="light" className="text-[#c4cbd6]" />
            <p className="text-sm text-[#5b6474]">
              No sessions yet.{" "}
              <Link href="/interview/setup" className="font-medium text-accent-deep hover:text-accent">
                Start a practice interview
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#eef1f6] bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#eef1f6] text-xs font-medium uppercase tracking-wide text-[#93a1b5]">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f6]">
                {sessions.map((session) => {
                  const answered = answeredCounts[session.id] ?? 0;
                  const action = actionFor(session);
                  return (
                    <tr key={session.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-[#5b6474]">
                        {formatRelativeTime(session.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-[#0b1120]">
                        {MODE_LABEL[session.mode]} · {MOOD_LABEL[session.mood] ?? "Neutral"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[#5b6474] tabular-nums">
                        {answered} of {session.questionCount} answered
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[session.status]}`}
                        >
                          {STATUS_LABEL[session.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <Link
                          href={action.href}
                          className="font-medium text-accent-deep hover:text-accent"
                        >
                          {action.label}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
