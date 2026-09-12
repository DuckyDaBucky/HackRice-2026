import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hiringEnabled } from "./config";
import { resolveHiringClerkOrgId } from "./superadmin";
import { hrGetOrganization, hrListJobs, setupOrganization } from "@/app/hr/actions";

export type HrDashboardJob = { id: string; title: string; candidate_count: number };

export async function loadHrDashboardData() {
  if (!hiringEnabled()) {
    return { enabled: false as const, org: null, jobs: [] as HrDashboardJob[], orgId: null };
  }

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkOrgId = await resolveHiringClerkOrgId();
  if (!clerkOrgId) {
    return { enabled: true as const, org: null, jobs: [] as HrDashboardJob[], orgId: null };
  }

  let org = await hrGetOrganization(clerkOrgId);
  if (!org) {
    await setupOrganization(clerkOrgId, "Hiring workspace");
    org = await hrGetOrganization(clerkOrgId);
  }

  const jobs = org ? await hrListJobs(org.id) : [];
  return { enabled: true as const, org, jobs, orgId: org?.id ?? null };
}
