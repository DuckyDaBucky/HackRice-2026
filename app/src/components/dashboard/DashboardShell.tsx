"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  BriefcaseIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  GearSixIcon,
  HouseIcon,
  TargetIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/marketing/Logo";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { ViewSwitcher } from "@/components/dashboard/ViewSwitcher";
import { clerkEnabled } from "@/lib/clerk";
import { roleLabel, type AppUserRole } from "@/lib/user-roles.shared";
import type { DashboardView } from "@/lib/dashboard/view-mode";
import { canSwitchDashboardView } from "@/lib/dashboard/view-mode";

const CANDIDATE_NAV = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/interview/setup", label: "Practice", icon: TargetIcon },
  { href: "/interviews", label: "Interviews", icon: ClockCounterClockwiseIcon },
  { href: "/resume", label: "Resume", icon: FileTextIcon },
  { href: "/analytics", label: "Analytics", icon: ChartBarIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
] as const;

const HR_NAV = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/hr", label: "Jobs", icon: BriefcaseIcon },
  { href: "/hr/live", label: "Live demo", icon: VideoCameraIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
] as const;

type NavLabel = (typeof CANDIDATE_NAV)[number]["label"] | (typeof HR_NAV)[number]["label"];

export function DashboardShell({
  active,
  firstName,
  role = "candidate",
  dashboardView = "practice",
  children,
}: {
  active: NavLabel;
  firstName: string | null;
  role?: AppUserRole;
  dashboardView?: DashboardView;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  // HR workspace gets the dark-green identity; candidate keeps teal.
  const isHr = dashboardView === "hr";
  const navItems = isHr ? HR_NAV : CANDIDATE_NAV;
  const activeBorder = isHr ? "border-hr-accent" : "border-accent";
  const activeBg = isHr ? "bg-dash-nav-active-hr" : "bg-dash-nav-active";
  const activeIcon = isHr ? "text-hr-accent-deep" : "text-accent-deep";

  return (
    <div className="flex min-h-screen bg-dash-bg">
      {/* Fixed in the viewport with its own scroll — never stretches with page length. */}
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-dash-border bg-dash-sidebar py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Link href="/" className="px-5">
          <Logo size="sm" onLight />
        </Link>

        <nav className="mt-7 flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = item.label === active || pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-r-md border-l-2 py-1.5 pl-3 pr-3 text-[13.5px] font-medium transition-colors duration-150 ${
                  isActive
                    ? `${activeBorder} ${activeBg} text-dash-text`
                    : "border-transparent text-dash-text-muted hover:bg-dash-nav-hover hover:text-dash-text"
                }`}
              >
                <Icon size={17} weight="regular" className={isActive ? activeIcon : ""} />
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

        {/* Profile opens Settings — account management lives there as a section. */}
        <div className="flex items-center gap-2.5 border-t border-dash-border px-5 pt-4">
          <Link
            href="/settings"
            aria-label="Open settings"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition-colors duration-150 hover:bg-dash-nav-hover"
          >
            {clerkEnabled && user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.imageUrl}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-full"
              />
            ) : (
              <span className="h-7 w-7 shrink-0 rounded-full bg-dash-border" />
            )}
            <span className="flex min-w-0 flex-1 flex-col py-0.5 text-left">
              <span className="truncate text-[13px] font-medium text-dash-text">
                {firstName ?? "Your account"}
              </span>
              <span className="text-[11px] text-dash-text-faint">{roleLabel(role)}</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-dash-bg px-6 py-9 sm:px-9 lg:px-12">{children}</main>
    </div>
  );
}
