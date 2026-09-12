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
import { SAMPLE_EMPLOYER_INVITES } from "@/lib/dashboard/employer-invites";
import {
  focusCopy,
  overallScore,
  readinessDelta,
  sessionDurationMinutes,
  sessionScore,
  shortDate,
  skillBreakdown,
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

function actionFor(session: SessionRecord): { label: string; href: string } {
  if (session.status === "in_progress") {
    return { label: "Resume", href: `/interview/${session.mode}?session=${session.id}` };
  }
  if (session.status === "abandoned") {
    return { label: "Try again", href: "/interview/setup" };
  }
  return { label: "Practice again", href: "/interview/setup" };
}

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
}: {
  firstName: string | null;
  stats: SessionStats;
  sessions: SessionRecord[];
  hasResume: boolean;
}) {
  const hasCompleted = stats.completedSessions > 0;
  const completed = sessions.filter((s) => s.status === "completed");

  const currentScores = completed[0] ? skillBreakdown(completed[0].id) : null;
  const overall = currentScores ? overallScore(currentScores) : null;
  const previousOverall = completed[1] ? overallScore(skillBreakdown(completed[1].id)) : null;
  const delta = overall !== null ? readinessDelta(previousOverall, overall) : null;
  const focus = currentScores ? weakestCategory(currentScores) : null;

  return (
    <DashboardShell active="Home" firstName={firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1120]">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">Practice today. Perform tomorrow.</p>
        </div>

        <section className="relative overflow-hidden rounded-xl border border-[#d7eee8] bg-[#f0fbf8] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold tracking-tight text-[#0b1120]">
                Ready for your next interview?
              </h2>
              <p className="mt-1.5 text-sm text-[#475467]">
                Practice with questions personalized to your resume and target role.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/interview/setup"
                  className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-[#03231e] transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98]"
                >
                  Start practice interview
                </Link>
                <JoinInterview />
              </div>
            </div>
            <WaveformAccent className="hidden shrink-0 sm:flex" />
          </div>
        </section>

        {SAMPLE_EMPLOYER_INVITES.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Employer interviews
            </h2>
            <div className="mt-3 divide-y divide-[#eef1f6] rounded-xl border border-[#eef1f6] bg-white">
              {SAMPLE_EMPLOYER_INVITES.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div>
                    <div className="text-sm font-medium text-[#0b1120]">
                      {invite.role} · {invite.company}
                    </div>
                    <div className="mt-0.5 text-xs text-[#93a1b5]">
                      {invite.stage} · Due {invite.dueDate} · ~{invite.durationMinutes} minutes
                    </div>
                  </div>
                  <Link
                    href="/interview/setup"
                    className="inline-flex h-8 shrink-0 items-center rounded-md border border-[#e3e7ee] px-3 text-sm font-medium text-[#0b1120] transition-colors duration-150 hover:bg-[#f4f5f7]"
                  >
                    Start interview
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

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
              <section className="rounded-xl border border-[#eef1f6] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Performance
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-[160px_1fr]">
                  <div>
                    <div className="text-4xl font-bold tabular-nums text-[#0b1120]">{overall}</div>
                    <div className="mt-1 text-xs text-[#6b7280]">Interview readiness</div>
                    {delta !== null && (
                      <div className={`mt-1.5 text-xs font-medium ${delta >= 0 ? "text-accent-deep" : "text-[#93a1b5]"}`}>
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
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
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

              <ul className="mt-3 divide-y divide-[#eef1f6] rounded-xl border border-[#eef1f6] bg-white">
                {sessions.slice(0, 4).map((session) => {
                  const Icon = MODE_ICON[session.mode];
                  const action = actionFor(session);
                  const duration = sessionDurationMinutes(session.createdAt, session.completedAt);
                  const isScored = session.status === "completed";
                  const score = isScored ? sessionScore(session.id) : null;

                  return (
                    <li
                      key={session.id}
                      className="flex flex-col gap-2 px-4 py-3.5 transition-colors duration-150 hover:bg-[#f9fafb] sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Icon size={16} weight="light" className="shrink-0 text-[#93a1b5]" />
                        <div className="min-w-0">
                          <span className="truncate text-sm font-medium text-[#0b1120]">
                            {MODE_LABEL[session.mode]} practice · {MOOD_LABEL[session.mood] ?? "Neutral"}
                          </span>
                          <div className="mt-0.5 truncate text-xs text-[#93a1b5]">
                            {shortDate(session.createdAt)}
                            {duration ? ` · ${duration} min` : ""} · {session.questionCount} questions
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 pl-7 sm:pl-0">
                        {score !== null && (
                          <span className="text-sm font-semibold tabular-nums text-[#0b1120]">
                            {score}
                          </span>
                        )}
                        <Link
                          href={action.href}
                          className="text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
                        >
                          {action.label}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {focus && (
              <section className="rounded-xl border border-[#eef1f6] bg-[#f6f7f9] px-5 py-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Next focus
                </h2>
                <p className="mt-2 text-sm font-medium text-[#0b1120]">{focus}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#475467]">{focusCopy(focus)}</p>
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

        <section className="flex items-center justify-between border-t border-[#eef1f6] pt-5">
          <div>
            <div className="text-sm font-medium text-[#0b1120]">Resume</div>
            <div className="mt-0.5 text-xs text-[#93a1b5]">
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
