"use client";

import { useRouter } from "next/navigation";
import { BriefcaseIcon, GraduationCapIcon } from "@phosphor-icons/react";
import { setDashboardView } from "@/app/actions/dashboard-view";
import type { DashboardView } from "@/lib/dashboard/view-mode";

const OPTIONS: { view: DashboardView; label: string; icon: typeof GraduationCapIcon }[] = [
  { view: "practice", label: "Candidate", icon: GraduationCapIcon },
  { view: "hr", label: "HR", icon: BriefcaseIcon },
];

export function ViewSwitcher({ currentView }: { currentView: DashboardView }) {
  const router = useRouter();

  async function selectView(view: DashboardView) {
    if (view === currentView) return;
    await setDashboardView(view);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dash-border bg-dash-surface p-1.5">
      <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-dash-text-faint">
        Workspace
      </p>
      <div className="grid grid-cols-2 gap-1">
        {OPTIONS.map(({ view, label, icon: Icon }) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => void selectView(view)}
              aria-pressed={isActive}
              className={`flex flex-col items-center gap-1 rounded-md px-2 py-2 text-center transition-colors duration-150 ${
                isActive
                  ? "bg-dash-nav-active text-dash-text ring-1 ring-accent/30"
                  : "text-dash-text-muted hover:bg-dash-nav-hover hover:text-dash-text"
              }`}
            >
              <Icon size={16} weight={isActive ? "fill" : "regular"} className={isActive ? "text-accent-deep" : ""} />
              <span className="text-[11px] font-semibold leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
