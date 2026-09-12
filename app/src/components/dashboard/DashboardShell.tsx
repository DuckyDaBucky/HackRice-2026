"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  HouseIcon,
  BooksIcon,
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
  { href: "/resources", label: "Resources", icon: BooksIcon },
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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#eef1f6] bg-white px-4 py-6 lg:flex">
        <Link href="/" className="px-2">
          <Logo size="sm" onLight />
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.label === active || pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#0b1120] text-white"
                    : "text-[#5b6474] hover:bg-[#f4f5f7] hover:text-[#0b1120]"
                }`}
              >
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-[#eef1f6] pt-4">
          {clerkEnabled ? (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }} />
          ) : (
            <span className="h-8 w-8 shrink-0 rounded-full bg-[#eef1f6]" />
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-[#0b1120]">
              {firstName ?? "Your account"}
            </span>
            <span className="text-xs text-[#93a1b5]">Candidate</span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}
