import Link from "next/link";
import { HrCandidateWorkspace } from "@/components/hiring/HrCandidateWorkspace";

export default async function HrCandidatePage({
  params,
  searchParams,
}: PageProps<"/hr/candidates/[candidateId]"> & { searchParams: Promise<{ org?: string }> }) {
  const { candidateId } = await params;
  const { org } = await searchParams;
  if (!org) return <p className="p-8 text-zinc-500">Missing organization.</p>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/hr?org=${org}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Hiring</Link>
      <HrCandidateWorkspace candidacyId={candidateId} organizationId={org} />
    </div>
  );
}
