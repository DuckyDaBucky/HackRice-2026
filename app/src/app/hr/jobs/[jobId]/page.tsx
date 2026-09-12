import Link from "next/link";
import { hrGetJob, hrCreateCandidate } from "../../actions";

export default async function HrJobPage({
  params,
  searchParams,
}: PageProps<"/hr/jobs/[jobId]"> & { searchParams: Promise<{ org?: string }> }) {
  const { jobId } = await params;
  const { org } = await searchParams;
  if (!org) return <p className="p-8 text-zinc-500">Missing organization.</p>;

  const job = await hrGetJob(jobId, org);
  if (!job) return <p className="p-8 text-zinc-500">Job not found.</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-zinc-200">
      <Link href={`/hr?org=${org}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Back</Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-50">{job.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{job.description || "No description."}</p>

      <form
        action={async () => {
          "use server";
          const candidacyId = await hrCreateCandidate(org, jobId);
          if (candidacyId) {
            const { redirect } = await import("next/navigation");
            redirect(`/hr/candidates/${candidacyId}?org=${org}`);
          }
        }}
        className="mt-8"
      >
        <button type="submit" className="rounded border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Add candidate
        </button>
      </form>
    </div>
  );
}
