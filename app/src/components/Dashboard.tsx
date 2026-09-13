import Link from "next/link";
import {
  ArrowRightIcon,
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  CodeIcon,
} from "@phosphor-icons/react/ssr";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SkillBars } from "@/components/dashboard/SkillBars";
import { JoinInterview } from "@/components/dashboard/JoinInterview";
import { WaveformAccent } from "@/components/dashboard/WaveformAccent";
import { EmptyState } from "@/components/dashboard/EmptyState";
import CountUp from "@/components/dashboard/CountUp";
import {
  focusCopy,
  overallScore,
  readinessDelta,
  sessionDurationMinutes,
  sessionScoreWithSkips,
  shortDate,
  skillBreakdownWithSkips,
  skippedCountFor,
  weakestCategory,
} from "@/lib/dashboard/performance";
import { MOOD_OPTIONS } from "@/lib/interview-config";
import type { SessionRecord, SessionStats } from "@/lib/sessions";
import type { InterviewMode } from "@/lib/questions/types";

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
  if (session.isDurable && session.reportStatus === "completed") {
    return { label: "Review report", href: `/interview/session/${session.id}/report` };
  }
  if (session.isDurable && session.reportStatus === "processing") {
    return { label: "Report preparing", href: `/interview/session/${session.id}/report` };
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
  answeredCounts,
  hasResume,
}: {
  firstName: string | null;
  stats: SessionStats;
  sessions: SessionRecord[];
  answeredCounts: Record<string, number>;
  hasResume: boolean;
}) {
  const hasCompleted = stats.completedSessions > 0;
  const completed = sessions.filter((s) => s.status === "completed");

  const scoresFor = (session: SessionRecord) => {
    const answered = answeredCounts[session.id] ?? 0;
    return skillBreakdownWithSkips(session.id, answered, session.questionCount);
  };
  const currentScores = completed[0] ? scoresFor(completed[0]) : null;
  const overall = currentScores ? overallScore(currentScores) : null;
  const previousOverall = completed[1] ? overallScore(scoresFor(completed[1])) : null;
  const delta = overall !== null ? readinessDelta(previousOverall, overall) : null;
  const focus = currentScores ? weakestCategory(currentScores) : null;

  return (
    <DashboardShell active="Home" firstName={firstName}>
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
            {currentScores && overall !== null && (
              <section className="rounded-xl border border-dash-border bg-dash-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Performance <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] normal-case text-amber-600">preview</span>
                </h2>
                <p className="mt-1 text-xs text-dash-text-faint">Placeholder scores — rubric-based evaluation isn&apos;t wired up yet.</p>
                <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-[160px_1fr]">
                  <div>
                    <CountUp
                      to={overall}
                      duration={1}
                      className="text-4xl font-bold tabular-nums text-dash-text"
                    />
                    <div className="mt-1 text-xs text-dash-text-muted">Interview readiness</div>
                    {delta !== null && (
                      <div className={`mt-1.5 text-xs font-medium ${delta >= 0 ? "text-accent-deep" : "text-dash-text-faint"}`}>
                        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs. your previous interview
                      </div>
                    )}
                  </div>
                  <SkillBars scores={currentScores} className="max-w-sm" />
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
                  const answered = answeredCounts[session.id] ?? 0;
                  const isScored = session.status === "completed";
                  const skipped = skippedCountFor(answered, session.questionCount);
                  const score = isScored ? sessionScoreWithSkips(session.id, answered, session.questionCount) : null;
                  return (
                    <li
                      key={session.id}
                      className="flex flex-col gap-2 px-4 py-3.5 transition-colors duration-150 hover:bg-dash-surface-hover sm:flex-row sm:items-center sm:gap-4"
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
                      <div className="flex shrink-0 items-center gap-4 pl-7 sm:pl-0">
                        <span className={`text-xs font-medium ${STATUS_STYLE[session.status]}`}>
                          {STATUS_LABEL[session.status]}
                        </span>
                        {score !== null && (
                          <span
                            className="text-sm font-semibold tabular-nums text-dash-text"
                            title={
                              skipped > 0
                                ? `Preview score — penalized ${skipped} skipped question${skipped === 1 ? "" : "s"} (each skip scores 0)`
                                : "Preview score — rubric-based scoring is not wired up yet"
                            }
                          >
                            {score} <span className="text-[10px] font-normal text-dash-text-faint">preview</span>
                          </span>
                        )}
                        <Link
                          href={action.href}
                          className="text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
                        >
                          {action.label}
                        </Link>
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

            {focus && (
              <section className="rounded-xl border border-dash-border bg-dash-surface-muted px-5 py-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Next focus
                </h2>
                <p className="mt-2 text-sm font-medium text-dash-text">{focus}</p>
                <p className="mt-1 text-sm leading-relaxed text-dash-text-muted">{focusCopy(focus)}</p>
                <Link
                  href="/interview/setup"
                  className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
                >
                  Practice this skill
                  <ArrowRightIcon size={11} />
                </Link>
              </section>
            )}
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
