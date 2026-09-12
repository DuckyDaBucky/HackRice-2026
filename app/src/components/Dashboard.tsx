import Link from "next/link";
import {
  ArrowRightIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  CodeIcon,
  FireIcon,
  ListChecksIcon,
  PlusIcon,
} from "@phosphor-icons/react/ssr";
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
  if (session.status === "in_progress" || session.status === "paused" || session.status === "planned") {
    return {
      label: session.status === "planned" ? "Start" : "Resume",
      href: session.isDurable ? `/interview/session/${session.id}` : `/interview/${session.mode}?session=${session.id}`,
    };
  }
  if (session.status === "abandoned") {
    return { label: "Try again", href: "/interview/setup" };
  }
  return { label: "Practice again", href: "/interview/setup" };
}

/** Only durable (v2) sessions have the turn/transcript history a report needs. */
function reportHrefFor(session: SessionRecord): string | null {
  if (session.status !== "completed" || !session.isDurable) return null;
  return `/interview/session/${session.id}/report`;
}

const STATUS_LABEL: Record<SessionRecord["status"], string> = {
  completed: "Completed",
  in_progress: "In progress",
  paused: "Paused",
  planned: "Ready to start",
  abandoned: "Abandoned",
};

const STATUS_STYLE: Record<SessionRecord["status"], string> = {
  completed: "bg-emerald-500/10 text-emerald-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  paused: "bg-amber-500/10 text-amber-400",
  planned: "bg-sky-500/10 text-sky-400",
  abandoned: "bg-zinc-500/10 text-zinc-400",
};

export function Dashboard({
  firstName,
  stats,
  sessions,
  answeredCounts,
}: {
  firstName: string | null;
  stats: SessionStats;
  sessions: SessionRecord[];
  answeredCounts: Record<string, number>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10 lg:py-16">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">Dashboard</span>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="text-base text-zinc-400">
          Practice the interview you actually want, then return to the exact session when you are ready.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-10">
          <Link
            href="/interview/setup"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition hover:-translate-y-0.5 hover:border-sky-800 hover:bg-zinc-900 active:scale-[0.98]"
          >
            <div className="flex items-center gap-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-400 transition group-hover:bg-sky-500/20">
                <PlusIcon size={26} weight="light" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-medium text-zinc-50">New practice session</span>
                <p className="text-sm leading-relaxed text-zinc-400">
                  Choose interview tracks, time, role level, interviewer voice, tone, and a focus area.
                </p>
              </div>
            </div>
            <ArrowRightIcon
              size={20}
              className="shrink-0 text-sky-400 transition group-hover:translate-x-0.5"
            />
          </Link>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-400">Recent sessions</h2>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center">
                <ClockCounterClockwiseIcon size={28} weight="light" className="text-zinc-600" />
                <p className="text-sm text-zinc-500">
                  No sessions yet — set one up above and it will show up here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-900 rounded-2xl border border-zinc-800 bg-zinc-900/30">
                {sessions.map((session) => {
                  const Icon = MODE_ICON[session.mode];
                  const answered = answeredCounts[session.id] ?? 0;
                  const action = actionFor(session);
                  const reportHref = reportHrefFor(session);
                  return (
                    <li
                      key={session.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                          <Icon size={18} weight="light" />
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-zinc-200">
                            {MODE_LABEL[session.mode]} practice ·{" "}
                            {MOOD_LABEL[session.mood] ?? "Neutral"}
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {formatRelativeTime(session.createdAt)} · {answered} of{" "}
                            {session.questionCount} answered
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[session.status]}`}
                        >
                          {STATUS_LABEL[session.status]}
                        </span>
                        {reportHref && (
                          <Link
                            href={reportHref}
                            className="text-sm font-medium text-zinc-300 hover:text-zinc-100"
                          >
                            View report
                          </Link>
                        )}
                        <Link
                          href={action.href}
                          className="text-sm font-medium text-sky-400 hover:text-sky-300"
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
        </div>

        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400">Your progress</h2>
          <StatRow icon={ListChecksIcon} label="Sessions" value={stats.totalSessions} />
          <StatRow icon={CheckCircleIcon} label="Completed" value={stats.completedSessions} />
          <StatRow icon={FireIcon} label="This week" value={stats.last7Days} />
        </aside>
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CodeIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
        <Icon size={18} weight="light" />
      </span>
      <div className="flex flex-col">
        <span className="text-2xl font-semibold text-zinc-50 tabular-nums">{value}</span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
