import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CodeIcon,
  FireIcon,
  ListChecksIcon,
  TargetIcon,
} from "@phosphor-icons/react/ssr";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { formatRelativeTime } from "@/lib/format-relative-time";
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
  return (
    <DashboardShell active="Home" firstName={firstName}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1120] sm:text-3xl">
            {firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`}
          </h1>
          <p className="text-sm text-[#5b6474]">Practice today. Perform tomorrow.</p>
        </div>

        <Link
          href="/interview/setup"
          className="group flex flex-col items-start justify-between gap-5 rounded-2xl border border-[#eef1f6] bg-white p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_20px_40px_-28px_rgba(11,17,32,0.35)] sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e9f6f1] text-[#0f9d78]">
              <TargetIcon size={22} weight="light" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-base font-medium text-[#0b1120]">
                Start a practice interview
              </span>
              <p className="text-sm leading-relaxed text-[#5b6474]">
                Get personalized questions based on your resume and target role.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0b1120] px-4 py-2 text-sm font-medium text-white transition-opacity group-hover:opacity-90">
            Start practicing
            <ArrowRightIcon size={14} />
          </span>
        </Link>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-[#5b6474]">Your progress</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={ListChecksIcon} label="Practice interviews" value={stats.totalSessions} />
            <StatCard icon={CheckCircleIcon} label="Completed" value={stats.completedSessions} />
            <StatCard icon={FireIcon} label="This week" value={stats.last7Days} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#5b6474]">Recent interviews</h2>
            {sessions.length > 0 && (
              <Link
                href="/interviews"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
              >
                View all
                <ArrowRightIcon size={12} />
              </Link>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e3e7ee] bg-white px-6 py-14 text-center">
              <ClockCounterClockwiseIcon size={28} weight="light" className="text-[#c4cbd6]" />
              <p className="text-sm text-[#5b6474]">
                No sessions yet — start a practice interview above and it will show up here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-[#eef1f6] rounded-2xl border border-[#eef1f6] bg-white">
              {sessions.map((session) => {
                const Icon = MODE_ICON[session.mode];
                const answered = answeredCounts[session.id] ?? 0;
                const action = actionFor(session);
                return (
                  <li
                    key={session.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f5f7] text-[#5b6474]">
                        <Icon size={18} weight="light" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-[#0b1120]">
                          {MODE_LABEL[session.mode]} practice ·{" "}
                          {MOOD_LABEL[session.mood] ?? "Neutral"}
                        </span>
                        <span className="text-xs text-[#93a1b5] tabular-nums">
                          {formatRelativeTime(session.createdAt)} · {answered} of{" "}
                          {session.questionCount} answered
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 pl-[52px] sm:pl-0">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[session.status]}`}
                      >
                        {STATUS_LABEL[session.status]}
                      </span>
                      <Link
                        href={action.href}
                        className="text-sm font-medium text-accent-deep hover:text-accent"
                      >
                        {action.label}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex items-center justify-between gap-4 rounded-2xl border border-[#eef1f6] bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-[#5b6474]">
              <CalendarCheckIcon size={18} weight="light" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#0b1120]">Your resume</span>
              <span className="text-xs text-[#93a1b5]">
                {hasResume ? "On file — used to personalize your questions." : "Not added yet."}
              </span>
            </div>
          </div>
          <Link
            href="/resume"
            className="shrink-0 rounded-lg border border-[#e3e7ee] px-3.5 py-2 text-sm font-medium text-[#0b1120] transition-colors hover:bg-[#f4f5f7]"
          >
            {hasResume ? "View resume" : "Add resume"}
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CodeIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#eef1f6] bg-white px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f6f1] text-[#0f9d78]">
        <Icon size={17} weight="light" />
      </span>
      <div className="flex flex-col">
        <span className="text-xl font-semibold text-[#0b1120] tabular-nums">{value}</span>
        <span className="text-xs text-[#5b6474]">{label}</span>
      </div>
    </div>
  );
}
