import Link from "next/link";
import {
  ArrowRightIcon,
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  CodeIcon,
} from "@phosphor-icons/react/ssr";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { JoinInterview } from "@/components/dashboard/JoinInterview";
import { WaveformAccent } from "@/components/dashboard/WaveformAccent";
import { EmptyState } from "@/components/dashboard/EmptyState";
import CountUp from "@/components/dashboard/CountUp";
import { readinessDelta, sessionDurationMinutes, shortDate } from "@/lib/dashboard/performance";
import { MOOD_OPTIONS } from "@/lib/interview-config";
import type { SessionRecord, SessionStats } from "@/lib/sessions";
import type { InterviewMode } from "@/lib/questions/types";
import type { AppUserRole } from "@/lib/user-roles.shared";
import type { DashboardView } from "@/lib/dashboard/view-mode";

const MODE_LABEL: Record<InterviewMode, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

const MODE_ICON: Record<InterviewMode, typeof CodeIcon> = {
  technical: CodeIcon,
  behavioral: ChatCircleDotsIcon,
};

const MOOD_LABEL: Record<string, string> = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.id, option.label]),
);

/** Canonical report route is the chess-style answer review.
 *  Evidence-only /reports/:id remains available as a secondary link. */
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
    return { label: session.score === null ? "Open report" : "View report", href: `/interview/session/${session.id}/report` };
  }
  return { label: "Practice again", href: "/interview/setup" };
}

/** Evidence-only report (clips + captions), secondary to the canonical review. */
function evidenceHrefFor(session: SessionRecord): string | null {
  if (session.status !== "completed" || !session.isDurable) return null;
  return `/reports/${session.id}`;
}

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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard({
  firstName,
  stats,
  sessions,
  hasResume,
  role = "candidate",
  dashboardView = "practice",
}: {
  firstName: string | null;
  stats: SessionStats;
  sessions: SessionRecord[];
  hasResume: boolean;
  role?: AppUserRole;
  dashboardView?: DashboardView;
}) {
  const hasCompleted = stats.completedSessions > 0;
  const completed = sessions.filter((s) => s.status === "completed");
  const scored = completed.filter((session) => session.score !== null);
  const latestScored = scored[0] ?? null;
  const overall = scored[0]?.score ?? null;
  const previousOverall = scored[1]?.score ?? null;
  const delta = overall !== null ? readinessDelta(previousOverall, overall) : null;

  return (
    <DashboardShell active="Home" firstName={firstName} role={role} dashboardView={dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          <p className="mt-1 text-sm text-dash-text-muted">Practice today. Perform tomorrow.</p>
        </div>

        <section className="relative overflow-hidden rounded-xl border border-dash-border bg-dash-surface px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8">
          <div
            className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_100%_at_100%_0%,color-mix(in_srgb,var(--color-accent)_10%,transparent),transparent_60%)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold tracking-tight text-dash-text">
                Ready for your next interview?
              </h2>
              <p className="mt-1.5 text-sm text-dash-text-muted">
                Practice with questions personalized to your resume and target role.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/interview/setup"
                  className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-dash-on-accent transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98]"
                >
                  Start practice interview
                </Link>
                <JoinInterview />
              </div>
            </div>
            <WaveformAccent className="hidden shrink-0 sm:flex" />
          </div>
        </section>

        {!hasCompleted ? (
          <EmptyState
            icon={ClockCounterClockwiseIcon}
            title="No interviews yet"
            body="Complete your first practice interview and your sessions will appear here."
            ctaLabel="Start practicing"
            ctaHref="/interview/setup"
          />
        ) : (
          <>
            {overall !== null && (
              <section className="relative overflow-hidden rounded-2xl bg-[#101817] p-6 text-white shadow-[0_18px_45px_rgba(18,55,50,0.16)] sm:p-7">
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/15 blur-3xl" aria-hidden="true" />
                <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-emerald-200/65 uppercase">Latest interview report</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Your evidence-based result</h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">One score everywhere, calculated from the verdicts in your report. Skipped or unsupported answers count as zero.</p>
                    <div className="mt-5 flex items-end gap-2">
                      <CountUp
                        to={overall}
                        duration={1}
                        className="text-6xl font-semibold leading-none tracking-[-0.06em] tabular-nums text-white"
                      />
                      <span className="pb-1 text-sm text-white/40">/100 accuracy</span>
                    </div>
                    {delta !== null && (
                      <div className={`mt-2 text-xs font-medium ${delta >= 0 ? "text-emerald-300" : "text-white/45"}`}>
                        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs. your previous interview
                      </div>
                    )}
                  </div>
                  {latestScored && (
                    <Link
                      href={`/interview/session/${latestScored.id}/report`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-dash-on-accent transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-0"
                    >
                      Open full report
                      <ArrowRightIcon size={13} weight="bold" />
                    </Link>
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Recent interviews
                </h2>
                <Link
                  href="/interviews"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
                >
                  View all
                  <ArrowRightIcon size={11} />
                </Link>
              </div>

              <ul className="mt-3 divide-y divide-dash-border rounded-xl border border-dash-border bg-dash-surface">
                {sessions.slice(0, 4).map((session) => {
                  const Icon = MODE_ICON[session.mode];
                  const action = actionFor(session);
                  const evidenceHref = evidenceHrefFor(session);
                  const duration = sessionDurationMinutes(session.createdAt, session.completedAt);
                  const answered = session.answeredCount;
                  const isScored = session.status === "completed";
                  const score = isScored ? session.score : null;
                  return (
                    <li
                      key={session.id}
                      className="grid gap-3 px-4 py-4 transition-colors duration-200 hover:bg-dash-surface-hover sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Icon size={16} weight="light" className="shrink-0 text-dash-text-faint" />
                        <div className="min-w-0">
                          <span className="truncate text-sm font-medium text-dash-text">
                            {MODE_LABEL[session.mode]} practice · {MOOD_LABEL[session.mood] ?? "Neutral"}
                          </span>
                          <div className="mt-0.5 truncate text-xs text-dash-text-faint">
                            {shortDate(session.createdAt)}
                            {duration ? ` · ${duration} min` : ""} · {answered} of {session.questionCount}{" "}
                            answered
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-7 sm:justify-end sm:pl-0">
                        <span className={`mr-1 text-xs font-medium ${STATUS_STYLE[session.status]}`}>
                          {STATUS_LABEL[session.status]}
                        </span>
                        {score !== null && (
                          <span
                            className="rounded-md bg-dash-surface-muted px-2.5 py-1 text-sm font-semibold tabular-nums text-dash-text"
                            title="Report score; skipped questions count as zero"
                          >
                            {score}<span className="ml-0.5 text-[10px] font-medium text-dash-text-faint">/100</span>
                          </span>
                        )}
                        <Link
                          href={action.href}
                          className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] ${session.status === "completed" && session.isDurable ? "bg-accent text-dash-on-accent hover:bg-accent-hover" : "text-accent-deep hover:bg-dash-surface-muted hover:text-accent"}`}
                        >
                          {action.label}
                        </Link>
                        {session.status === "completed" && (
                          <Link
                            href="/interview/setup"
                            className="px-2 text-xs font-medium text-dash-text-muted transition-colors duration-200 hover:text-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            Practice again
                          </Link>
                        )}
                        {evidenceHref && (
                          <Link
                            href={evidenceHref}
                            className="text-xs text-dash-text-faint transition-colors duration-150 hover:text-accent"
                          >
                            Evidence
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

          </>
        )}

        <section className="flex items-center justify-between border-t border-dash-border pt-5">
          <div>
            <div className="text-sm font-medium text-dash-text">Resume</div>
            <div className="mt-0.5 text-xs text-dash-text-faint">
              {hasResume ? "On file — personalizing your questions." : "Not added yet."}
            </div>
          </div>
          <Link
            href="/resume"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
          >
            {hasResume ? "View resume" : "Add resume"}
            <ArrowRightIcon size={11} />
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}
