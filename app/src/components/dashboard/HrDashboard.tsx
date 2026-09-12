import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AppUserRole } from "@/lib/user-roles.shared";
import type { DashboardView } from "@/lib/dashboard/view-mode";
import type { HrDashboardJob } from "@/lib/hiring/hr-dashboard-data";

export function HrDashboard({
  firstName,
  role,
  dashboardView,
  orgName,
  orgId,
  jobs,
  hiringEnabled,
}: {
  firstName: string | null;
  role: AppUserRole;
  dashboardView: DashboardView;
  orgName: string | null;
  orgId: string | null;
  jobs: HrDashboardJob[];
  hiringEnabled: boolean;
}) {
  return (
    <DashboardShell active="Home" firstName={firstName} role={role} dashboardView={dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">
            {firstName ? `Hiring workspace, ${firstName}.` : "Hiring workspace."}
          </h1>
          <p className="mt-1 text-sm text-dash-text-muted">
            {orgName ? `${orgName} — jobs and interview activity` : "Manage jobs, candidates, and live demos."}
          </p>
        </div>

        {!hiringEnabled ? (
          <section className="rounded-xl border border-dash-border bg-dash-surface px-6 py-7">
            <h2 className="text-lg font-semibold text-dash-text">Hiring is disabled</h2>
            <p className="mt-2 text-sm text-dash-text-muted">
              Set <code className="text-accent-deep">HIRING_ENABLED=true</code> after migrations and provider setup.
            </p>
          </section>
        ) : !orgId ? (
          <section className="rounded-xl border border-dash-border bg-dash-surface px-6 py-7">
            <h2 className="text-lg font-semibold text-dash-text">Organization required</h2>
            <p className="mt-2 text-sm text-dash-text-muted">
              Select or create a Clerk organization to manage hiring, or sign in with a developer account.
            </p>
          </section>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">Jobs</h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/hr/live"
                  className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-dash-on-accent transition-colors duration-150 hover:bg-accent-hover"
                >
                  Live judge demo
                </Link>
                <Link
                  href={`/hr/jobs/new?org=${orgId}`}
                  className="inline-flex h-9 items-center rounded-md border border-dash-border px-4 text-sm font-medium text-dash-text transition-colors duration-150 hover:bg-dash-nav-hover"
                >
                  New job
                </Link>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-dash-border text-dash-text-muted">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Candidates</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-dash-border last:border-b-0">
                      <td className="px-4 py-3 font-medium text-dash-text">{job.title}</td>
                      <td className="px-4 py-3 text-dash-text-muted">{job.candidate_count}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/hr/jobs/${job.id}?org=${orgId}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-accent-deep transition-colors duration-150 hover:text-accent"
                        >
                          Open
                          <ArrowRightIcon size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-dash-text-faint">
                        No jobs yet. Create one or run the live judge demo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
