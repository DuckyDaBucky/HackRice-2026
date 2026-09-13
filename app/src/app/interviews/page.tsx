import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardShellContext } from "@/lib/dashboard/shell-props";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { listRecentSessions } from "@/lib/sessions";
import { sessionDurationMinutes, shortDate } from "@/lib/dashboard/performance";
import { MOOD_OPTIONS } from "@/lib/interview-config";
import type { SessionRecord } from "@/lib/sessions";

const MODE_LABEL: Record<SessionRecord["mode"], string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

const MOOD_LABEL: Record<string, string> = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.id, option.label]),
);

const STATUS_LABEL: Record<SessionRecord["status"] | "deleted", string> = {
  completed: "Completed",
  in_progress: "In progress",
  paused: "Paused",
  planned: "Ready to start",
  abandoned: "Abandoned",
  deleted: "Deleted",
};

const STATUS_STYLE: Record<SessionRecord["status"] | "deleted", string> = {
  completed: "text-dash-success",
  in_progress: "text-amber-600",
  paused: "text-amber-600",
  planned: "text-dash-blue",
  abandoned: "text-dash-text-faint",
  deleted: "text-dash-text-faint",
};

/** Canonical report route is the chess-style answer review. */
function actionFor(session: SessionRecord): { label: string; href: string } {
  if (session.status === "in_progress" || session.status === "paused" || session.status === "planned") {
    return {
      label: session.status === "planned" ? "Start" : "Resume",
      href: session.isDurable
        ? `/interview/session/${session.id}`
        : `/interview/${session.mode}?session=${session.id}`,
    };
  }
  if (session.status === "abandoned") {
    return { label: "Try again", href: "/interview/setup" };
  }
  if (session.isDurable && session.status === "completed") {
    return { label: "View report", href: `/interview/session/${session.id}/report` };
  }
  return { label: "Practice again", href: "/interview/setup" };
}

export default async function InterviewsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Finterviews");

  const sessions = await listRecentSessions(user.id, 50);
  const shell = await getDashboardShellContext(user.id);

  return (
    <DashboardShell active="Interviews" firstName={user.firstName} role={shell.role} dashboardView={shell.dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">
            Your interviews
          </h1>
          <p className="mt-1 text-sm text-dash-text-muted">Every practice session, in one place.</p>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwiseIcon}
            title="No interviews yet"
            body="Complete your first practice interview to start tracking your progress."
            ctaLabel="Start practicing"
            ctaHref="/interview/setup"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-dash-border text-xs text-dash-text-faint">
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Duration</th>
                    <th className="px-4 py-2.5 font-medium">Questions</th>
                    <th className="px-4 py-2.5 font-medium">Report score</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {sessions.map((session) => {
                    const action = actionFor(session);
                    const duration = sessionDurationMinutes(session.createdAt, session.completedAt);
                    const score = session.status === "completed" ? session.score : null;
                    return (
                      <tr key={session.id} className="transition-colors duration-150 hover:bg-dash-surface-hover">
                        <td className="px-4 py-3 text-dash-text">
                          {MODE_LABEL[session.mode]} · {MOOD_LABEL[session.mood] ?? "Neutral"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-dash-text-muted">
                          {shortDate(session.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-dash-text-muted tabular-nums">
                          {duration ? `${duration}m` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-dash-text-muted tabular-nums">
                          {session.answeredCount} / {session.questionCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-dash-text">
                          {score ?? "—"}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 font-medium ${STATUS_STYLE[session.status]}`}>
                          {STATUS_LABEL[session.status]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            href={action.href}
                            className={`inline-flex h-8 items-center rounded-md px-3 font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] ${session.status === "completed" && session.isDurable ? "bg-accent text-dash-on-accent hover:bg-accent-hover" : "text-accent-deep hover:bg-dash-surface-muted hover:text-accent"}`}
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
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
