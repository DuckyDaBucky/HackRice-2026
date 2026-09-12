import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChartBarIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SkillBars } from "@/components/dashboard/SkillBars";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { listRecentSessions } from "@/lib/sessions";
import {
  SKILL_CATEGORIES,
  overallScore,
  readinessDelta,
  readinessLabel,
  sessionScore,
  skillBreakdown,
  type SkillScores,
} from "@/lib/dashboard/performance";

export default async function AnalyticsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fanalytics");

  const sessions = await listRecentSessions(user.id, 50);
  const completed = sessions.filter((s) => s.status === "completed");

  if (completed.length === 0) {
    return (
      <DashboardShell active="Analytics" firstName={user.firstName}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1120]">Analytics</h1>
            <p className="mt-1 text-sm text-[#6b7280]">Your practice activity so far.</p>
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
  const chronological = [...completed].reverse();
  const history = chronological.map((s) => sessionScore(s.id));
  const currentScore = history[history.length - 1];
  const previousScore = history.length > 1 ? history[history.length - 2] : null;
  const delta = readinessDelta(previousScore, currentScore);

  const perSessionScores = completed.map((s) => skillBreakdown(s.id));
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
          <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1120]">Analytics</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Based on your last {completed.length} completed interview{completed.length === 1 ? "" : "s"}.
          </p>
        </div>

        <section className="rounded-xl border border-[#eef1f6] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[180px_1fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-[#0b1120]">
                  {aggregateOverall}
                </span>
                <span className="text-sm text-[#93a1b5]">/100</span>
              </div>
              <div className="mt-1 text-xs font-medium text-accent-deep">
                {readinessLabel(aggregateOverall)}
              </div>
              {delta !== null && (
                <div className="mt-2 text-xs text-[#6b7280]">
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% over your last {history.length} interview
                  {history.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
            {history.length > 1 && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
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
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Skill breakdown
          </h2>
          <SkillBars scores={aggregate} className="mt-3 max-w-sm" />
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[#eef1f6] bg-[#f6f7f9] p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Strengths
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#0b1120]">
              {strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#eef1f6] bg-[#f6f7f9] p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Needs work
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#0b1120]">
              {needsImprovement.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Recent score history
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm font-medium tabular-nums text-[#0b1120]">
            {[...history].reverse().slice(0, 8).map((score, i) => (
              <span key={i}>{score}</span>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
