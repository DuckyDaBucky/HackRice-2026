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
import { clerkEnabled } from "@/lib/clerk";

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
  children,
}: {
  active: (typeof NAV_ITEMS)[number]["label"];
  firstName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#fafbfc]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[#ebedf1] bg-white py-5 lg:flex">
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
                    ? "border-accent bg-[#eef8f6] text-[#0b1120]"
                    : "border-transparent text-[#6b7280] hover:bg-[#f4f5f7] hover:text-[#0b1120]"
                }`}
              >
                <Icon size={17} weight="regular" className={isActive ? "text-accent-deep" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-[#ebedf1] px-5 pt-4">
          {clerkEnabled ? (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-full bg-[#eef1f6]" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-[#0b1120]">
              {firstName ?? "Your account"}
            </span>
            <span className="text-[11px] text-[#93a1b5]">Candidate</span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-9 sm:px-9 lg:px-12">{children}</main>
    </div>
  );
}
