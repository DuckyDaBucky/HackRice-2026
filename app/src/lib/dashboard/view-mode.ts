import type { AppUserRole } from "@/lib/user-roles.shared";

export type DashboardView = "practice" | "hr";

export const DASHBOARD_VIEW_COOKIE = "dashboard-view";

export function resolveDashboardView(role: AppUserRole, cookieView: string | undefined): DashboardView {
  if (role === "hr") return "hr";
  if (role === "candidate") return "practice";
  return cookieView === "hr" ? "hr" : "practice";
}

export function canSwitchDashboardView(role: AppUserRole) {
  return role === "developer";
}
