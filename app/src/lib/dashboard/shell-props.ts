import "server-only";
import { cookies } from "next/headers";
import { resolveAppUserRole } from "@/lib/user-roles";
import { DASHBOARD_VIEW_COOKIE, resolveDashboardView } from "@/lib/dashboard/view-mode";

export async function getDashboardShellContext(userId: string) {
  const cookieStore = await cookies();
  const role = await resolveAppUserRole(userId);
  const dashboardView = resolveDashboardView(role, cookieStore.get(DASHBOARD_VIEW_COOKIE)?.value);
  return { role, dashboardView };
}
