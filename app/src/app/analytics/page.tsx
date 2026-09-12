import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SkillBars } from "@/components/dashboard/SkillBars";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { listRecentSessions } from "@/lib/sessions";
import {
  SKILL_CATEGORIES,
  overallScore,
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
            <h1 className="text-[26px] font-semibold tracking-tight text-[#0b1120]">Analytics</h1>
            <p className="mt-1 text-sm text-[#6b7280]">Your practice activity so far.</p>
          </div>
          <div className="rounded-lg border border-[#eef1f6] bg-white px-5 py-6">
            <p className="text-sm font-medium text-[#0b1120]">No completed interviews yet</p>
            <p className="mt-1 text-sm text-[#6b7280]">
              Finish a practice interview to see your score and skill breakdown here.
            </p>
            <Link
              href="/interview/setup"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-deep hover:text-accent"
            >
              Start practicing
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Oldest → newest, for the trend line; reversed for the "recent" list below.
  const chronological = [...completed].reverse();
  const history = chronological.map((s) => sessionScore(s.id));
  const currentScore = history[history.length - 1];
  const previousScore = history.length > 1 ? history[history.length - 2] : currentScore;
  const delta = currentScore - previousScore;

  const perSessionScores = completed.map((s) => skillBreakdown(s.id));
  const aggregate = SKILL_CATEGORIES.reduce((acc, category) => {
    acc[category] = Math.round(
      perSessionScores.reduce((sum, s) => sum + s[category], 0) / perSessionScores.length,
    );
    return acc;
  }, {} as SkillScores);

  const ranked = [...SKILL_CATEGORIES].sort((a, b) => aggregate[b] - aggregate[a]);
  const strengths = ranked.slice(0, 2);
  const needsImprovement = ranked.slice(-2).reverse();

  return (
    <DashboardShell active="Analytics" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-9">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[#0b1120]">Analytics</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Based on your last {completed.length} completed interview{completed.length === 1 ? "" : "s"}.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-8 sm:grid-cols-[160px_1fr]">
          <div>
            <div className="text-4xl font-semibold tabular-nums text-[#0b1120]">
              {overallScore(aggregate)}
            </div>
            <div className="mt-1 text-xs text-[#6b7280]">Overall interview score</div>
            {history.length > 1 && (
              <div className={`mt-1 text-xs font-medium ${delta >= 0 ? "text-accent-deep" : "text-[#93a1b5]"}`}>
                {delta >= 0 ? "+" : ""}
                {delta} vs. previous
              </div>
            )}
          </div>
          {history.length > 1 && (
            <div>
              <div className="text-xs text-[#6b7280]">Performance over time</div>
              <div className="mt-2 h-16 w-full max-w-sm">
                <Sparkline values={history} width={320} height={64} />
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
            Skill breakdown
          </h2>
          <SkillBars scores={aggregate} className="mt-3 max-w-sm" />
        </section>

        <section className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Strengths
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#0b1120]">
              {strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Needs improvement
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
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm tabular-nums text-[#0b1120]">
            {[...history].reverse().slice(0, 8).map((score, i) => (
              <span key={i}>{score}</span>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
