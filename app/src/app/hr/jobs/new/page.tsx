import { redirect } from "next/navigation";
import { hrCreateJob } from "../../actions";

export default async function NewJobPage({
  searchParams,
}: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  if (!org) return <p className="p-8 text-zinc-500">Missing organization.</p>;

  async function create(formData: FormData) {
    "use server";
    const organizationId = org;
    if (!organizationId) throw new Error("Missing organization.");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const roleFamily = String(formData.get("roleFamily") ?? "software-engineer").trim();
    const jobId = await hrCreateJob(organizationId, { title, description, roleFamily });
    redirect(`/hr/jobs/${jobId}?org=${organizationId}`);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12 text-zinc-200">
      <h1 className="text-xl font-semibold text-zinc-50">New job</h1>
      <form action={create} className="mt-6 space-y-4">
        <input name="title" required placeholder="Job title" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
        <textarea name="description" placeholder="Description" rows={4} className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
        <input name="roleFamily" defaultValue="software-engineer" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm" />
        <button type="submit" className="rounded border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">Create</button>
      </form>
    </div>
  );
}
