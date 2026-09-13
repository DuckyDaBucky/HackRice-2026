import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChartBarIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SkillBars } from "@/components/dashboard/SkillBars";
import { Sparkline } from "@/components/dashboard/Sparkline";
import CountUp from "@/components/dashboard/CountUp";
import { listRecentSessions } from "@/lib/sessions";
import { countUploadedAttemptsBySession } from "@/lib/answer-attempts";
import {
  SKILL_CATEGORIES,
  overallScore,
  readinessDelta,
  readinessLabel,
  sessionScoreWithSkips,
  skillBreakdownWithSkips,
  type SkillScores,
} from "@/lib/dashboard/performance";

export default async function AnalyticsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fanalytics");

  const sessions = await listRecentSessions(user.id, 50);
  const completed = sessions.filter((s) => s.status === "completed");
  const answeredCounts = await countUploadedAttemptsBySession(completed.map((s) => s.id));

  if (completed.length === 0) {
    return (
      <DashboardShell active="Analytics" firstName={user.firstName}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">Analytics</h1>
            <p className="mt-1 text-sm text-dash-text-muted">Your practice activity so far.</p>
          </div>
          <EmptyState
            icon={ChartBarIcon}
            title="No completed interviews yet"
            body="Finish a practice interview to see your score and skill breakdown here."
            ctaLabel="Start practicing"
            ctaHref="/interview/setup"
          />
        </div>
      </DashboardShell>
    );
  }

  // Oldest → newest, for the trend line; reversed for the "recent" list below.
  // Each skipped question scores 0, so skipping drags history + aggregates down.
  const chronological = [...completed].reverse();
  const answeredFor = (s: (typeof completed)[number]) => answeredCounts[s.id] ?? 0;
  const history = chronological.map((s) => sessionScoreWithSkips(s.id, answeredFor(s), s.questionCount));
  const currentScore = history[history.length - 1];
  const previousScore = history.length > 1 ? history[history.length - 2] : null;
  const delta = readinessDelta(previousScore, currentScore);

  const perSessionScores = completed.map((s) => skillBreakdownWithSkips(s.id, answeredFor(s), s.questionCount));
  const aggregate = SKILL_CATEGORIES.reduce((acc, category) => {
    acc[category] = Math.round(
      perSessionScores.reduce((sum, s) => sum + s[category], 0) / perSessionScores.length,
    );
    return acc;
  }, {} as SkillScores);
  const aggregateOverall = overallScore(aggregate);

  const ranked = [...SKILL_CATEGORIES].sort((a, b) => aggregate[b] - aggregate[a]);
  const strengths = ranked.slice(0, 2);
  const needsImprovement = ranked.slice(-2).reverse();

  return (
    <DashboardShell active="Analytics" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">Analytics <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 align-middle text-[11px] font-medium text-amber-600">preview scores</span></h1>
          <p className="mt-1 text-sm text-dash-text-muted">
            Based on your last {completed.length} completed interview{completed.length === 1 ? "" : "s"}. Scores are placeholders until rubric evaluation lands.
          </p>
        </div>

        <section className="rounded-xl border border-dash-border bg-dash-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[180px_1fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <CountUp
                  to={aggregateOverall}
                  duration={1}
                  className="text-4xl font-bold tabular-nums text-dash-text"
                />
                <span className="text-sm text-dash-text-faint">/100</span>
              </div>
              <div className="mt-1 text-xs font-medium text-accent-deep">
                {readinessLabel(aggregateOverall)}
              </div>
              {delta !== null && (
                <div className="mt-2 text-xs text-dash-text-muted">
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% over your last {history.length} interview
                  {history.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
            {history.length > 1 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-dash-text-muted">
                  Performance over time
                </div>
                <div className="mt-3 h-20 w-full max-w-md">
                  <Sparkline values={history} width={360} height={80} showDots />
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
            Skill breakdown
          </h2>
          <SkillBars scores={aggregate} className="mt-3 max-w-sm" />
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-dash-border bg-dash-surface-muted p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
              Strengths
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-dash-text">
              {strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-dash-border bg-dash-surface-muted p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
              Needs work
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-dash-text">
              {needsImprovement.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
            Recent score history
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm font-medium tabular-nums text-dash-text">
            {[...history].reverse().slice(0, 8).map((score, i) => (
              <span key={i}>{score}</span>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
