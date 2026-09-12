import { notFound } from "next/navigation";
import { InterviewSession } from "@/components/InterviewSession";
import type { InterviewMode } from "@/lib/questions/types";

function isInterviewMode(value: string): value is InterviewMode {
  return value === "technical" || value === "behavioral";
}

export default async function InterviewModePage({
  params,
}: PageProps<"/interview/[mode]">) {
  const { mode } = await params;

  if (!isInterviewMode(mode)) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <InterviewSession mode={mode} />
    </div>
  );
}
