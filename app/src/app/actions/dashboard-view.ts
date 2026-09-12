"use server";

import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { DASHBOARD_VIEW_COOKIE, type DashboardView } from "@/lib/dashboard/view-mode";
import { resolveAppUserRole } from "@/lib/user-roles";

export async function setDashboardView(view: DashboardView) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required.");

  const role = await resolveAppUserRole(userId);
  if (role !== "developer") throw new Error("Only developers can switch dashboard views.");

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_VIEW_COOKIE, view, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
