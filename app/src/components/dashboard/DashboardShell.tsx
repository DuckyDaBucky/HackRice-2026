"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  HouseIcon,
  TargetIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/marketing/Logo";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { ViewSwitcher } from "@/components/dashboard/ViewSwitcher";
import { clerkEnabled } from "@/lib/clerk";
import { roleLabel, type AppUserRole } from "@/lib/user-roles.shared";
import type { DashboardView } from "@/lib/dashboard/view-mode";
import { canSwitchDashboardView } from "@/lib/dashboard/view-mode";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/interview/setup", label: "Practice", icon: TargetIcon },
  { href: "/interviews", label: "Interviews", icon: ClockCounterClockwiseIcon },
  { href: "/resume", label: "Resume", icon: FileTextIcon },
  { href: "/analytics", label: "Analytics", icon: ChartBarIcon },
] as const;

export function DashboardShell({
  active,
  firstName,
  role = "candidate",
  dashboardView = "practice",
  children,
}: {
  active: (typeof NAV_ITEMS)[number]["label"];
  firstName: string | null;
  role?: AppUserRole;
  dashboardView?: DashboardView;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-dash-bg">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-dash-border bg-dash-sidebar py-5 lg:flex">
        <Link href="/" className="px-5">
          <Logo size="sm" onLight />
        </Link>

        <nav className="mt-7 flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.label === active || pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-r-md border-l-2 py-1.5 pl-3 pr-3 text-[13.5px] font-medium transition-colors duration-150 ${
                  isActive
                    ? "border-accent bg-dash-nav-active text-dash-text"
                    : "border-transparent text-dash-text-muted hover:bg-dash-nav-hover hover:text-dash-text"
                }`}
              >
                <Icon size={17} weight="regular" className={isActive ? "text-accent-deep" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {canSwitchDashboardView(role) && (
          <div className="mx-3 mb-3 mt-auto">
            <ViewSwitcher currentView={dashboardView} />
          </div>
        )}

        <div className="flex items-center gap-2.5 border-t border-dash-border px-5 pt-4">
          {clerkEnabled ? (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-full bg-dash-border" />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-dash-text">
              {firstName ?? "Your account"}
            </span>
            <span className="text-[11px] text-dash-text-faint">{roleLabel(role)}</span>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-dash-bg px-6 py-9 sm:px-9 lg:px-12">{children}</main>
    </div>
  );
}
