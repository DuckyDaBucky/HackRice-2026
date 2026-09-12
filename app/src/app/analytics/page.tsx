import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { CheckCircleIcon, FireIcon, ListChecksIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getSessionStats } from "@/lib/sessions";

export default async function AnalyticsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fanalytics");

  const stats = await getSessionStats(user.id);

  return (
    <DashboardShell active="Analytics" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1120] sm:text-3xl">
            Analytics
          </h1>
          <p className="text-sm text-[#5b6474]">
            Your practice activity so far. Scoring and trend breakdowns are on the way.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat icon={ListChecksIcon} label="Practice interviews" value={stats.totalSessions} />
          <Stat icon={CheckCircleIcon} label="Completed" value={stats.completedSessions} />
          <Stat icon={FireIcon} label="This week" value={stats.last7Days} />
        </div>

        <p className="text-xs text-[#93a1b5]">
          Per-question scoring and evidence-linked feedback are still in development — once
          rubric-based evaluation ships, this page will chart your progress over time.
        </p>
      </div>
    </DashboardShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ListChecksIcon;
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
