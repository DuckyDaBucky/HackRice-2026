import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hiringEnabled } from "@/lib/hiring/config";
import { hrListJobs, hrGetOrganization, setupOrganization } from "./actions";

export default async function HrHomePage() {
  if (!hiringEnabled()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
        <h1 className="text-xl font-medium text-zinc-100">Hiring workspace</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Hiring is disabled. Set HIRING_ENABLED=true after migrations and provider setup.
        </p>
      </div>
    );
  }

  const { orgId, userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
        <h1 className="text-xl font-medium text-zinc-100">Hiring workspace</h1>
        <p className="mt-2 text-sm text-zinc-500">Select or create a Clerk organization to manage hiring.</p>
      </div>
    );
  }

  let org = await hrGetOrganization(orgId);
  if (!org) {
    await setupOrganization(orgId, "Organization");
    org = await hrGetOrganization(orgId);
  }

  const jobs = org ? await hrListJobs(org.id) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-zinc-200">
      <header className="mb-8 border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-semibold text-zinc-50">Hiring</h1>
        <p className="mt-1 text-sm text-zinc-500">{org?.display_name ?? "Organization"} — jobs and interview activity</p>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400">Jobs</h2>
        {org && (
          <Link href={`/hr/jobs/new?org=${org.id}`} className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900">
            New job
          </Link>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="py-2 font-medium">Title</th>
            <th className="py-2 font-medium">Candidates</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job: { id: string; title: string; candidate_count: number }) => (
            <tr key={job.id} className="border-b border-zinc-900">
              <td className="py-3">{job.title}</td>
              <td className="py-3 text-zinc-500">{job.candidate_count}</td>
              <td className="py-3 text-right">
                <Link href={`/hr/jobs/${job.id}?org=${org?.id}`} className="text-sky-400 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-zinc-600">No jobs yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
