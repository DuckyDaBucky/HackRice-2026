import { notFound } from "next/navigation";
import { getPersistedInterviewState } from "@/app/interview/v2-actions";
import { HiringRecordedInterview } from "@/components/hiring/HiringRecordedInterview";

export default async function CandidateInterviewPage({
  params,
}: PageProps<"/candidate/interview/[sessionId]">) {
  const { sessionId } = await params;
  const state = await getPersistedInterviewState(sessionId);
  if (!state) notFound();
  return <HiringRecordedInterview initialState={state} />;
}
