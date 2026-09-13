import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardShellContext } from "@/lib/dashboard/shell-props";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { DeviceSettings } from "@/components/settings/DeviceSettings";
import { AccessibilitySettings } from "@/components/settings/AccessibilitySettings";

export default async function SettingsPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fsettings");

  const shell = await getDashboardShellContext(user.id);

  return (
    <DashboardShell active="Settings" firstName={user.firstName} role={shell.role} dashboardView={shell.dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">Settings</h1>
          <p className="mt-1 text-sm text-dash-text-muted">Your account, devices, and viewing preferences.</p>
        </div>
        <AccountSettings />
        <DeviceSettings />
        <AccessibilitySettings />
      </div>
    </DashboardShell>
  );
}
