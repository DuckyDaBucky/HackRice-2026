import { notFound } from "next/navigation";
import { PersistedInterviewSession } from "@/components/PersistedInterviewSession";
import { getPersistedInterviewState } from "@/app/interview/v2-actions";

export default async function PersistedInterviewPage({
  params,
}: PageProps<"/interview/session/[sessionId]">) {
  const { sessionId } = await params;
  const state = await getPersistedInterviewState(sessionId);
  if (!state) notFound();
  return <PersistedInterviewSession initialState={state} />;
}
