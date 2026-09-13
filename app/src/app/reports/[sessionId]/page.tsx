import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk";

/** Legacy evidence URL; all report content now lives on the canonical review page. */
export default async function LegacyInterviewReportPage({ params }: PageProps<"/reports/[sessionId]">) {
  const { sessionId } = await params;
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/interview/session/${sessionId}/report`)}`);
  redirect(`/interview/session/${sessionId}/report`);
}
