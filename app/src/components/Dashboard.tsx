import Link from "next/link";
import { ArrowRightIcon, ChatCircleDotsIcon, CodeIcon } from "@phosphor-icons/react/ssr";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SkillBars } from "@/components/dashboard/SkillBars";
import { JoinInterview } from "@/components/dashboard/JoinInterview";
import { SAMPLE_EMPLOYER_INVITES } from "@/lib/dashboard/employer-invites";
import {
  overallScore,
  sessionDurationMinutes,
  sessionHighlight,
  sessionScore,
  shortDate,
  skillBreakdown,
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
  const mostRecentCompleted = sessions.find((s) => s.status === "completed");
  const scores = mostRecentCompleted ? skillBreakdown(mostRecentCompleted.id) : null;
  const overall = scores ? overallScore(scores) : null;

  return (
    <DashboardShell active="Home" firstName={firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-9">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[#0b1120]">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">Practice today. Perform tomorrow.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/interview/setup"
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-[#03231e] transition-colors hover:bg-accent-hover"
          >
            Start practice interview
          </Link>
          <JoinInterview />
        </div>

        {SAMPLE_EMPLOYER_INVITES.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Employer interviews
            </h2>
            <div className="mt-3 divide-y divide-[#eef1f6] rounded-lg border border-[#eef1f6]">
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
                    className="inline-flex h-8 shrink-0 items-center rounded-md border border-[#e3e7ee] px-3 text-sm font-medium text-[#0b1120] transition-colors hover:bg-[#f4f5f7]"
                  >
                    Start interview
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {!hasCompleted ? (
          <section className="rounded-lg border border-[#eef1f6] bg-white px-5 py-6">
            <p className="text-sm font-medium text-[#0b1120]">No interviews yet</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              Complete your first practice interview to start tracking your progress.
            </p>
            <Link
              href="/interview/setup"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
            >
              Start practicing
              <ArrowRightIcon size={12} />
            </Link>
          </section>
        ) : (
          <>
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Your performance
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-8 sm:grid-cols-[140px_1fr]">
                <div>
                  <div className="text-4xl font-semibold tabular-nums text-[#0b1120]">{overall}</div>
                  <div className="mt-1 text-xs text-[#6b7280]">Overall score</div>
                </div>
                {scores && <SkillBars scores={scores} className="max-w-sm" />}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Recent interviews
                </h2>
                <Link
                  href="/interviews"
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
                >
                  View all
                  <ArrowRightIcon size={11} />
                </Link>
              </div>

              <ul className="mt-3 divide-y divide-[#eef1f6] rounded-lg border border-[#eef1f6]">
                {sessions.slice(0, 4).map((session) => {
                  const Icon = MODE_ICON[session.mode];
                  const action = actionFor(session);
                  const duration = sessionDurationMinutes(session.createdAt, session.completedAt);
                  const isScored = session.status === "completed";
                  const score = isScored ? sessionScore(session.id) : null;
                  const highlight = isScored ? sessionHighlight(session.id, session.mode) : null;

                  return (
                    <li key={session.id} className="flex items-center gap-4 px-4 py-3.5">
                      <Icon size={16} weight="light" className="shrink-0 text-[#93a1b5]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium text-[#0b1120]">
                            {MODE_LABEL[session.mode]} practice · {MOOD_LABEL[session.mood] ?? "Neutral"}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#93a1b5]">
                          {shortDate(session.createdAt)}
                          {duration ? ` · ${duration} min` : ""}
                          {highlight ? ` · ${highlight.strength}` : ""}
                        </div>
                      </div>
                      {score !== null && (
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#0b1120]">
                          {score}
                        </span>
                      )}
                      <Link
                        href={action.href}
                        className="shrink-0 text-sm font-medium text-accent-deep hover:text-accent"
                      >
                        {action.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-lg border border-[#eef1f6] bg-white px-5 py-4">
              <p className="text-sm leading-relaxed text-[#0b1120]">
                {mostRecentCompleted?.mode === "technical"
                  ? "Balance things out with a behavioral round next — alternating keeps both skill sets sharp."
                  : "Mix in a technical round next — alternating keeps both skill sets sharp."}
              </p>
              <Link
                href="/interview/setup"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
              >
                Go to practice
                <ArrowRightIcon size={11} />
              </Link>
            </section>
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
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
          >
            {hasResume ? "View resume" : "Add resume"}
            <ArrowRightIcon size={11} />
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}
