import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hiringEnabled } from "@/lib/hiring/config";
import { HrLiveDemo } from "@/components/hiring/HrLiveDemo";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardShellContext } from "@/lib/dashboard/shell-props";
import { setupOrganization, hrGetOrganization } from "../actions";
import { resolveHiringClerkOrgId } from "@/lib/hiring/superadmin";

export default async function HrLiveDemoPage() {
  if (!hiringEnabled()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
        <h1 className="text-xl font-medium">Live demo unavailable</h1>
        <p className="mt-2 text-sm text-zinc-500">Set HIRING_ENABLED=true.</p>
      </div>
    );
  }

  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/hr/live");
  const orgId = await resolveHiringClerkOrgId();
  if (!orgId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
        <h1 className="text-xl font-medium">Select a Clerk organization</h1>
        <p className="mt-2 text-sm text-zinc-500">Use the org switcher in the header, then reload.</p>
      </div>
    );
  }

  let org = await hrGetOrganization(orgId);
  if (!org) {
    await setupOrganization(orgId, "Hiring workspace");
    org = await hrGetOrganization(orgId);
  }

  const shell = await getDashboardShellContext(userId);

  return (
    <DashboardShell active="Live demo" firstName={null} role={shell.role} dashboardView="hr">
      <div className="mx-auto max-w-3xl px-6 py-12 text-zinc-200">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">← Hiring home</Link>
      <header className="mt-4 mb-8">
        <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">Judge demo</span>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Build an interview live</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Nothing is pre-filled. Type what the judge tells you, generate questions from their resume, edit in front of them, then send the invite.
        </p>
      </header>
      <HrLiveDemo />
      </div>
    </DashboardShell>
  );
}
