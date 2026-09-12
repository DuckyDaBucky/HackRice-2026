"use client";

import { useRouter } from "next/navigation";
import { BriefcaseIcon, TargetIcon } from "@phosphor-icons/react";
import { setDashboardView } from "@/app/actions/dashboard-view";
import type { DashboardView } from "@/lib/dashboard/view-mode";

export function ViewSwitcher({ currentView }: { currentView: DashboardView }) {
  const router = useRouter();
  const nextView: DashboardView = currentView === "practice" ? "hr" : "practice";

  async function toggleView() {
    await setDashboardView(nextView);
    router.refresh();
  }

  const Icon = currentView === "practice" ? BriefcaseIcon : TargetIcon;
  const label = currentView === "practice" ? "Switch to HR dashboard" : "Switch to practice dashboard";

  return (
    <button
      type="button"
      onClick={() => void toggleView()}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dash-border text-dash-text-muted transition-colors duration-150 hover:bg-dash-nav-hover hover:text-dash-text"
    >
      <Icon size={16} weight="regular" />
    </button>
  );
}
