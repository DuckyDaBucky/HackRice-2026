import Link from "next/link";
import { HrReportPanel } from "@/components/hiring/HrReportPanel";

export default async function HrInterviewReportPage({
  params,
  searchParams,
}: PageProps<"/hr/interviews/[sessionId]/report"> & { searchParams: Promise<{ org?: string }> }) {
  const { sessionId } = await params;
  const { org } = await searchParams;
  if (!org) return <p className="p-8 text-zinc-500">Missing organization.</p>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-zinc-200">
      <Link href={`/hr?org=${org}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Hiring</Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-50">Interview report</h1>
      <HrReportPanel sessionId={sessionId} organizationId={org} />
    </div>
  );
}
